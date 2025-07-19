let viteHost: string | null = null;
{
    const viteHostArg = process.argv.find((arg) => arg.startsWith('--vitehost'));
    viteHost = viteHostArg?.split('=')[1]!;
}

import {create, events, registerMethodMap} from 'buntralino';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import tasks from './routes/tasks.ts';
import media from './routes/media.ts'
import QRrouter from './routes/qr.ts'
import { networkInterfaces } from 'os';

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
const app = new Hono({});
app.use('/*', cors({ origin: '*' }));
// Monta las rutas
app.route('/tasks', tasks);
app.route('/', media);
app.route('/', QRrouter); // → http://localhost:3000/qr

await create(viteHost ?? '/', {
    // Name windows to easily manipulate them and distinguish them in events
    name: 'main',
    // We need this option to add Neutralino globals to the Vite-hosted page
    injectGlobals: true,
    // Any options for Neutralino.window.create can go here
});

// Exit the app completely when the main window is closed without the `shutdown` command.
events.on('close', (windowName: string) => {
    if (windowName === 'main') {
        // eslint-disable-next-line no-process-exit
        process.exit();
    }
});
console.log("Server started")
// 2. Llama a Bun.serve() y guarda el objeto servidor resultante
const server = Bun.serve({
  fetch: app.fetch,
  port: 0,
  hostname: '0.0.0.0',
});
const functionMap = {
    getURL: async (payload: {
        message?: string
    }) => {
        //await Bun.sleep(1000);
        return {
            payload,
            host: localIP,
            port: server.port
        }
    }
};

registerMethodMap(functionMap);
// 3. Ahora puedes acceder a la información del servidor desde el objeto 'server'
console.log(`Servidor corriendo en http://${server.hostname}:${server.port}`,localIP);