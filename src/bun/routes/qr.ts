import { Hono } from 'hono';
import QRCode from 'qrcode';
import os from 'os';

const app = new Hono();

// helper: pick first non-internal IPv4
function getLocalIP(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

app.get('/qr', async (c) => {
  const { text } = c.req.query();
  const port = c.req.header('host')?.split(':')?.[1] ?? '3001';
  const defaultURL = `http://${getLocalIP()}:${port}/qr`;
  const toEncode = text || defaultURL;

  try {
    // PNG buffer, 200×200
    const png = await QRCode.toBuffer(toEncode, { type: 'png', width: 200 });
    c.header('Content-Type', 'image/png');
    c.header('Cache-Control', 'public, max-age=60');
    //@ts-ignore
    return c.body(png);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'QR generation failed' }, 500);
  }
});

export default app;