// Local preview with the unified funnel stream switched on. Events go to the local hub collector
// (run `node scripts/dev.mjs` in the funnel-hub repository as well). Usage: node scripts/dev.mjs
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 4173;
const hub = process.env.FUNNEL_HUB || 'http://localhost:4180/api/e';
const frontend = new Set(['index.html', 'styles.css', 'app.js', 'config.js', 'redirect.js', 'analytics.js', 'funnel-stream.js']);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf'
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const relative = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)).replace(/^[/\\]+/, '');
    const file = join(root, relative);
    // The same public files as scripts/build.mjs: the frontend and media, nothing from the server side.
    const served = (frontend.has(relative) || /^assets[/\\]/.test(relative)) && file.startsWith(root + sep);
    if (!served || !(await stat(file)).isFile()) throw new Error('Not found');
    res.setHeader('Content-Type', types[extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    if (relative === 'index.html') {
      // Collection is off on localhost unless these are set before the stream starts.
      const flags = `<script>window.FUNNEL_TRACK_LOCAL = true; window.FUNNEL_STREAM_ENDPOINT = ${JSON.stringify(hub)};</script>`;
      return res.end((await readFile(file, 'utf8')).replace('<script src="funnel-stream.js', `${flags}\n  <script src="funnel-stream.js`));
    }
    if (relative === 'analytics.js') {
      // The same substitutions as scripts/build.mjs.
      const funnel = JSON.stringify(JSON.stringify(JSON.parse(await readFile(join(root, 'funnel.json'), 'utf8'))));
      return res.end((await readFile(file, 'utf8')).replaceAll('__BUILD__', 'dev').replace("'__FUNNEL__'", funnel));
    }
    createReadStream(file).pipe(res);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Coomeet mobile preview: http://localhost:${port}`);
  console.log(`Events go to the hub collector at ${hub}`);
});
