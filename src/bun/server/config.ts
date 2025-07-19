import { networkInterfaces } from 'os';
import fs from 'fs/promises';
import { Hono } from 'hono';
// Configuración del archivo de configuración
const CONFIG_FILE = 'server-config.json';
const LOCK_FILE = 'server.lock';

interface ServerConfig {
  port: number;
  hostname?: string;
}
const configApi = new Hono();

configApi.post('/config/port', async (c) => {
  try {
    const { port } = await c.req.json();
    
    if (!port || typeof port !== 'number' || port < 1 || port > 65535) {
      return c.json({ error: 'Puerto inválido. Debe ser un número entre 1 y 65535' }, 400);
    }

    const config = await loadConfig();
    config.port = port;
    await saveConfig(config);
    
    return c.json({ 
      message: 'Puerto actualizado correctamente. Reinicie el servidor para aplicar los cambios.',
      newPort: port 
    });
  } catch (error) {
    return c.json({ error: 'Error al actualizar la configuración' }, 500);
  }
});
configApi.get('/config', async (c) => {
  const config = await loadConfig();
  return c.json(config);
});
// Configuración por defecto
const DEFAULT_CONFIG: ServerConfig = {
  port: 3001,
  hostname: '0.0.0.0'
};
// Función para cargar configuración desde archivo
async function loadConfig(): Promise<ServerConfig> {
  try {
    const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    // Si no existe el archivo, crear uno con la configuración por defecto
    await saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

// Función para guardar configuración
async function saveConfig(config: ServerConfig): Promise<void> {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}
// Función para verificar si ya hay un servidor corriendo
async function checkServerLock(): Promise<boolean> {
  try {
    const lockData = await fs.readFile(LOCK_FILE, 'utf-8');
    const { pid, port, timestamp } = JSON.parse(lockData);
    
    // Verificar si el proceso aún existe
    try {
      process.kill(pid, 0); // No mata el proceso, solo verifica si existe
      console.log(`Servidor ya corriendo en PID ${pid}, puerto ${port}`);
      return true;
    } catch {
      // El proceso no existe, eliminar el lock file obsoleto
      await fs.unlink(LOCK_FILE);
      return false;
    }
  } catch {
    // No existe lock file
    return false;
  }
}

// Función para crear lock file
async function createServerLock(port: number): Promise<void> {
  const lockData = {
    pid: process.pid,
    port,
    timestamp: new Date().toISOString()
  };
  await fs.writeFile(LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf-8');
}

// Función para limpiar lock file al terminar
async function cleanupLock(): Promise<void> {
  try {
    await fs.unlink(LOCK_FILE);
  } catch {
    // Ignorar errores si el archivo no existe
  }
}

function getLocalIP(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}
const localIP = getLocalIP();
export { loadConfig, saveConfig, checkServerLock, createServerLock, cleanupLock, localIP,CONFIG_FILE };
export default configApi;