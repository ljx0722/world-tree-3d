import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const host = process.env.WORLD_TREE_HOST ?? '127.0.0.1';
const port = Number(process.env.WORLD_TREE_PORT ?? process.env.PORT ?? 8123);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const local = relative(root, path);
    const type = contentTypes[extname(path)];
    if (!type || local.startsWith('..') || local.split(sep).some((part) => part.startsWith('.'))) {
      response.writeHead(404).end();
      return;
    }
    const file = await stat(path);
    if (!file.isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': file.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Permissions-Policy': 'camera=(self), microphone=()',
    });
    if (request.method === 'HEAD') {
      response.end();
    } else {
      const stream = createReadStream(path);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    }
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404).end();
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已在使用。若游戏已经启动，可访问 http://127.0.0.1:${port}/`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`世界树急救队 · http://${host}:${port}/`);
  if (host === '127.0.0.1') console.log('保持此窗口打开。按 Ctrl+C 停止。');
});
