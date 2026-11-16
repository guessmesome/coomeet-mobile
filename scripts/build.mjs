import { copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'public');
const frontend = ['index.html', 'styles.css', 'app.js', 'config.js', 'redirect.js', 'analytics.js', 'funnel-stream.js'];
const mediaExtensions = new Set(['.webp', '.mp4', '.svg', '.jpg', '.jpeg', '.png', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf']);

// funnel.json as a JavaScript string literal, checked so that a broken file fails the build, not the landing.
async function funnelLiteral() {
  const config = JSON.parse(await readFile(join(root, 'funnel.json'), 'utf8'));
  const id = /^[a-z0-9_]+$/;
  if (typeof config.id !== 'string' || !/^\d+$/.test(config.version) || !Array.isArray(config.screens) || !config.screens.length || !config.screens.every(screen => id.test(screen))) {
    throw new Error('funnel.json: expected { id, version: "<number>", screens: [screen ids] }');
  }
  return JSON.stringify(JSON.stringify({ id: config.id, version: config.version, screens: config.screens }));
}

// Only explicitly public frontend files and media enter the static deployment.
// Private dashboard templates, server code, documentation and env files stay outside.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of frontend) {
  const source = join(root, file);
  if (!(await lstat(source)).isFile()) throw new Error(`Invalid frontend file: ${file}`);
  if (file === 'analytics.js') {
    // Every event of the unified funnel stream names the build that produced it and the funnel version from funnel.json.
    const build = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'local';
    await writeFile(join(output, file), (await readFile(source, 'utf8')).replaceAll('__BUILD__', build).replace("'__FUNNEL__'", await funnelLiteral()));
  } else {
    await copyFile(source, join(output, file));
  }
}
let mediaCount = 0;
async function copyMedia(relative) {
  const source = join(root, relative);
  const stats = await lstat(source);
  if (stats.isSymbolicLink()) throw new Error(`Symlinks are not public assets: ${relative}`);
  if (stats.isDirectory()) {
    for (const name of await readdir(source)) await copyMedia(join(relative, name));
  } else if (stats.isFile() && mediaExtensions.has(extname(relative).toLowerCase())) {
    const destination = join(output, relative);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    mediaCount++;
  }
}
await copyMedia('assets');
console.log(`Built public frontend: ${frontend.length} files, ${mediaCount} media assets. Private dashboard is served by the authenticated function.`);
