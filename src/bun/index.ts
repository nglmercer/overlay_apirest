let viteHost: string | null = null;
{
    const viteHostArg = process.argv.find((arg) => arg.startsWith('--vitehost'));
    viteHost = viteHostArg?.split('=')[1]!;
}

import {create, events, registerMethodMap} from 'buntralino';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import tasks from './routes/tasks.ts';
import media from './routes/media.ts';
import QRrouter from './routes/qr.ts';
import path from 'path';
import { loadConfig, saveConfig, checkServerLock, createServerLock, cleanupLock, localIP,CONFIG_FILE } from './server/config.ts'
import { existsSync, writeFileSync } from "fs";
import selfsigned from 'selfsigned'; // Necesitamos el export por defecto
//@ts-ignore
import CERT_FILE from '../../cert.pem' with { type: 'text' };
//@ts-ignore
import KEY_FILE from '../../key.pem' with { type: 'text' };

// 1. Verificar si los certificados existen. Si no, los creamos.
if (!existsSync(CERT_FILE) || !existsSync(KEY_FILE)) {
  console.log("⏳ Certificados no encontrados. Creando nuevos...");

  // 2. Definir los atributos para el certificado
  // Puedes personalizarlos según tus necesidades. 'localhost' es común para desarrollo.
  const attrs = [{ name: "commonName", value: "localhost" }];
  
  // 3. Opciones de generación (ej. duración de 1 año)
  const options = {
    days: 365, // Válido por 365 días
    algorithm: "sha256",
    keySize: 2048,
  };

  // 4. Generar los PEM (Privacy-Enhanced Mail)
  const pems = selfsigned.generate(attrs, options);

  // 5. Escribir los archivos en el disco
  // pems.private contiene la clave privada
  // pems.cert contiene el certificado público
  try {
    writeFileSync(KEY_FILE, pems.private);
    writeFileSync(CERT_FILE, pems.cert);
    console.log("✅ ¡Certificados creados con éxito!");
  } catch (err) {
    console.error("❌ Error al escribir los archivos del certificado:", err);
  }
} else {
  console.log("✅ Certificados encontrados. No se requiere ninguna acción.");
}

const app = new Hono({});
app.use('*', cors({
  origin: '*', // Cambia esto en producción
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Proxy-Target', 'Proxy-Authorization'],
}));
app.all('*', async (c, next) => {
  const targetUrl = c.req.header('X-Proxy-Target');

  // Si el header existe, actúa como proxy
  if (targetUrl) {
    // --- INICIO DE TU LÓGICA DE PROXY (SIN CAMBIOS) ---

    // Parsear URL objetivo (Mejora: Usar new URL para validar)
    let parsedUrl: URL | any;
    try {
      // Es más seguro y robusto parsear directamente a un objeto URL
      parsedUrl = new URL(decodeURIComponent(targetUrl));
    } catch {
      return c.text('Invalid X-Proxy-Target URL format', 400);
    }

    // Copiar headers
    const headers = new Headers();
    // c.req.header() devuelve un objeto, es mejor iterar sobre c.req.raw.headers
    for (const [key, value] of c.req.raw.headers) {
      if (key.toLowerCase() === 'host') continue; // Evita el header host del proxy
      headers.set(key, value);
    }

    // Autenticación proxy básica
    const authHeader = c.req.header('Proxy-Authorization');
    if (authHeader?.startsWith('Basic ')) {
      headers.set('Authorization', authHeader); // Reenviar al destino si es necesario
    }

    // Copiar body si existe
    let body: any | null = null;
    if (!['GET', 'HEAD'].includes(c.req.method)) {
      // El body de la petición original ya es un stream, podemos pasarlo directamente
      // Esto es más eficiente que leerlo todo en memoria (text, formData, arrayBuffer)
      body = c.req.raw.body;
    }

    // Timeout configurado
    const timeout = Number(c.req.header('X-Proxy-Timeout')) || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(parsedUrl.toString(), {
        method: c.req.method,
        headers,
        body,
        signal: controller.signal,
        // Hono usa Cloudflare Workers, que no soporta redirect: 'manual' por defecto.
        // Si corres en otro entorno como Node.js, podrías añadirlo.
        // redirect: 'manual' 
      });

      clearTimeout(timeoutId);

      // Copiar respuesta
      const responseHeaders = new Headers(res.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*'); // Permite CORS
      responseHeaders.set('Access-Control-Allow-Headers', '*');

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      // Diferenciar entre un timeout y otros errores de red
      if ((error as Error).name === 'AbortError') {
        return c.text('Proxy error: Target timed out', 504); // Gateway Timeout
      }
      return c.text(`Proxy error: ${(error as Error).message}`, 502); // Bad Gateway
    }
    // --- FIN DE TU LÓGICA DE PROXY ---
  }

  // Si el header NO existe, pasa al siguiente manejador (otras rutas API)
  await next();
});
// Monta las rutas
app.route('/tasks', tasks);
app.route('/', media);
app.route('/', QRrouter);
console.log({
  KEY_FILE,
  CERT_FILE,
})

// 3. Ahora puedes acceder a la información del servidor desde el objeto 'server'
async function startServer() {
  try {
    // Verificar si ya hay un servidor corriendo
    if (await checkServerLock()) {
      console.log('❌ Ya hay un servidor corriendo. Terminando...');
      process.exit(1);
    }

    // Cargar configuración
    const config = await loadConfig();
    
    await create(viteHost ?? '/', {
        name: 'main',
        injectGlobals: true,
    });

    // Configurar limpieza al cerrar
    const cleanup = async () => {
      await cleanupLock();
      console.log('\n🧹 Limpieza completada');
      process.exit();
    };

    // Manejar cierre de ventana
    events.on('close', (windowName: string) => {
        if (windowName === 'main') {
            cleanup();
        }
    });

    // Manejar señales de terminación
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('beforeExit', cleanup);

    let serverPort = config.port;
    let server: any;

    try {
      // Intentar usar el puerto configurado
      server = Bun.serve({
        fetch: app.fetch,
        port: serverPort,
        hostname: config.hostname || '0.0.0.0',
        key:  KEY_FILE,
        cert: CERT_FILE,
      });
    } catch (error) {
      console.log(`⚠️  Puerto ${serverPort} ocupado, buscando puerto disponible...`);
      
      // Si falla, buscar un puerto disponible
      server = Bun.serve({
        fetch: app.fetch,
        port: serverPort++,
        hostname: config.hostname || '0.0.0.0',
      });

      // Actualizar configuración con el nuevo puerto
      config.port = serverPort;
      await saveConfig(config);
    }

    // Crear lock file
    await createServerLock(serverPort);

    console.log(`🚀 Servidor iniciado exitosamente!`);
    console.log(`📡 Puerto: ${serverPort}`);
    console.log(`🌐 Local: http://localhost:${serverPort}`);
    if (localIP) {
      console.log(`🌍 Red: http://${localIP}:${serverPort}`);
    }
    console.log(`⚙️  Configuración: ${path.resolve(CONFIG_FILE)}`);
    console.log(`📝 PID: ${process.pid}`);

    return server;
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    await cleanupLock();
    process.exit(1);
  }
}

// Iniciar servidor
const server = await startServer(); //production server
/* const server = Bun.serve({
        fetch: app.fetch,
        port: '3001',
        hostname:'0.0.0.0',
        key:  Bun.file(KEY_FILE),
        cert: Bun.file(CERT_FILE),
      }); //development server */
const functionMap = {
    getURL: async (payload: {
        message?: string
    }) => {
        //await Bun.sleep(1000);
        return {
            payload,
            host: 'localhost',
            port: server.port,
            url: server.url,
            protocol: CERT_FILE ? 'https' : 'http',
        }
    }
};

registerMethodMap(functionMap);