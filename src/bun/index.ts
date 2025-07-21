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
import { ProxyManager } from './proxy/ProxyManager.ts';
import { loadConfig, saveConfig, checkServerLock, createServerLock, cleanupLock, localIP,CONFIG_FILE } from './server/config.ts'
//@ts-ignore
import CERT_FILE from '../../localhost+3.pem' with { type: 'text' };
//@ts-ignore
import KEY_FILE from '../../localhost+3-key.pem' with { type: 'text' };
const proxyManager = new ProxyManager({
  http: {
    timeout: 30000,
    allowOrigins: ['*'],
    maxRedirects: 5
  },
  websocket: {
    timeout: 30000,
    maxConnections: 1000,
    heartbeatInterval: 30000
  },
  enableStats: true
});
const app = new Hono({});
app.use('*', cors({
  origin: '*', // Cambia esto en producción
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Proxy-Target', 'Proxy-Authorization'],
}));
app.use('*', proxyManager.middleware);
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