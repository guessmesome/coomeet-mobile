'use strict';

const { createHash, timingSafeEqual } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { AnalyticsError, parseRange, fetchDashboard } = require('../server/analytics-data');

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function authenticated(header, username, password) {
  if (typeof header !== 'string' || header.length > 8192 || !/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(header)) return false;
  const encoded = header.slice(6);
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded) return false;
  const credentials = bytes.toString('utf8');
  if (!Buffer.from(credentials, 'utf8').equals(bytes)) return false;
  const split = credentials.indexOf(':');
  if (split < 0) return false;
  const usernameMatches = timingSafeEqual(digest(credentials.slice(0, split)), digest(username));
  const passwordMatches = timingSafeEqual(digest(credentials.slice(split + 1)), digest(password));
  return Boolean(usernameMatches & passwordMatches);
}

function secureHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
}

function sendError(res, status, code, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (code === 'VERCEL_RATE_LIMIT') res.setHeader('Retry-After', '60');
  res.end(JSON.stringify({ error: { code, message } }));
}

function dashboardCsp(html) {
  const hashes = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi), match => `'sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}'`);
  return [
    "default-src 'none'", `script-src ${hashes.length ? hashes.join(' ') : "'none'"}`,
    "style-src 'unsafe-inline'", "img-src 'self' data:", "connect-src 'self'",
    "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'"
  ].join('; ');
}

module.exports = async function analytics(req, res) {
  secureHeaders(res);
  const password = process.env.ANALYTICS_PASSWORD;
  if (!password) return sendError(res, 503, 'ANALYTICS_NOT_CONFIGURED', 'Доступ к аналитике закрыт: настройте серверную переменную ANALYTICS_PASSWORD в Vercel.');
  if (!authenticated(req.headers?.authorization, process.env.ANALYTICS_USERNAME || 'admin', password)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Coomeet Analytics", charset="UTF-8"');
    return sendError(res, 401, 'UNAUTHORIZED', 'Введите логин и пароль для доступа к аналитике.');
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Поддерживается только метод GET.');
  }
  try {
    const url = new URL(req.url, 'https://analytics.internal');
    if (url.searchParams.has('data')) {
      const range = parseRange(url.searchParams);
      const data = await fetchDashboard(range);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(data));
    }
    // Vercel includes server/** relative to the function's project root.
    const html = await fs.readFile(path.join(process.cwd(), 'server', 'analytics-dashboard.html'), 'utf8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', dashboardCsp(html));
    res.end(html);
  } catch (error) {
    if (error instanceof AnalyticsError) return sendError(res, error.status, error.code, error.message);
    return sendError(res, 500, 'ANALYTICS_ERROR', 'Не удалось открыть аналитику. Проверьте настройки deployment.');
  }
};
