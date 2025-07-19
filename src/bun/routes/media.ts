// media.ts
import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';

const app = new Hono();

const MIME = Object.freeze({
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  '.apng': 'image/apng',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}) as Record<string, string>;

app.get('/media/*', async (c) => {
  const raw = c.req.path.replace('/media/', '');
  const relativePath = path.normalize(decodeURIComponent(raw));
  const filePath = path.join(relativePath);

  try {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) return c.json({ error: 'Not a file' }, 404);

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext];
    if (!contentType) return c.json({ error: 'Unsupported type' }, 415);

    const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
    if (c.req.header('If-None-Match') === etag) {
      return c.body(null, 304);
    }

    const stream = fs.createReadStream(filePath);
    c.header('Content-Type', contentType);
    c.header('Cache-Control', 'public, max-age=86400');
    c.header('ETag', etag);
    c.header('Last-Modified', stats.mtime.toUTCString());
    //@ts-ignore
    return c.body(stream);
  } catch (err: any) {
    if (err.code === 'ENOENT') return c.json({ error: 'Not found' }, 404);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;