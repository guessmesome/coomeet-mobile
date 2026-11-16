// Unified funnel stream: the shared client, identical in every landing.
// The canonical copy lives in funnel-hub/tracker; copy it as is, do not edit per funnel (docs/TRACKING.md).
//
//   const stream = window.FunnelStream.init({
//     funnel: 'lablue-mobile', version: '1', build: '__BUILD__',
//     endpoint: 'https://<hub>/api/e', screen: () => currentScreenId
//   });
//   stream.track('view', { sc: 'hook' });
(() => {
  'use strict';

  // The tracker's sub id slot (and URL parameter) that carries the session id; the hub reads the same slot (lib/keitaro.js).
  const SESSION_PARAM = 'sub_id_10';

  function init(config) {
    const host = location.hostname;
    const local = ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'].includes(host) || host.endsWith('.localhost');
    // A local preview may point the stream at a local collector; a published page uses the configured address only.
    const endpoint = String((local && window.FUNNEL_STREAM_ENDPOINT) || config.endpoint || '');
    const active = Boolean(endpoint) && ['https:', 'http:'].includes(location.protocol)
      && (!local || window.FUNNEL_TRACK_LOCAL === true);
    const currentScreen = () => { try { return config.screen?.(); } catch { return undefined; } };

    // The session id lives in memory only: no cookie and no storage, a reload starts a new session.
    let sid;
    try { sid = crypto.randomUUID(); } catch {
      const part = () => Math.random().toString(36).slice(2, 12).padEnd(10, '0');
      sid = `${Date.now().toString(36)}-${part()}-${part()}`;
    }
    const context = {};
    try { const subid = new URLSearchParams(location.search).get('subid'); if (subid) context.subid = subid.slice(0, 64); } catch { /* No join key then. */ }
    try { context.lang = String(navigator.language || '').slice(0, 16); } catch { /* Optional. */ }
    try { context.tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* Optional. */ }
    try {
      context.tzo = -new Date().getTimezoneOffset();
      context.sw = screen.width; context.sh = screen.height;
      context.vw = window.innerWidth; context.vh = window.innerHeight;
      context.dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
      if (document.referrer) context.ref = new URL(document.referrer).hostname.slice(0, 80);
    } catch { /* Optional. */ }

    let seq = 0, queue = [], timer = 0, errors = 0, readySent = false;

    // The address of the offer with this session's id added. Landings send visitors on to a tracker link, so
    // the tracker's click is born after the landing; with the id in the link the tracker keeps it next to the
    // click (sub id slot SESSION_PARAM) and the hub can join a registration or a purchase to this session.
    // The rest of the address is left byte for byte as it was; anything unexpected comes back untouched.
    function tag(url) {
      if (!active || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return url;
      const cut = url.indexOf('#');
      const head = cut === -1 ? url : url.slice(0, cut);
      if (new RegExp(`[?&]${SESSION_PARAM}=`).test(head)) return url;
      const joiner = !head.includes('?') ? '?' : /[?&]$/.test(head) ? '' : '&';
      return `${head}${joiner}${SESSION_PARAM}=${encodeURIComponent(sid)}${cut === -1 ? '' : url.slice(cut)}`;
    }

    function flush() {
      clearTimeout(timer); timer = 0;
      if (!queue.length) return;
      const body = JSON.stringify({
        v: 1, fid: config.funnel, fv: String(config.version), b: config.build, sid, ctx: context, e: queue
      });
      queue = [];
      try {
        // text/plain keeps the beacon a simple cross-origin request; the collector parses the JSON itself.
        if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
      } catch { /* Fall back to fetch. */ }
      try {
        fetch(endpoint, {
          method: 'POST', body, keepalive: true, credentials: 'omit', mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
        }).catch(() => { });
      } catch { /* Collection must not interrupt the landing. */ }
    }

    // ev: view | leave | click | answer | input | outbound | return | error | perf.
    // fields: sc (screen id), el (element id), val, ms, fa. urgent sends at once (the page is leaving).
    function track(ev, fields, urgent) {
      if (!active) return;
      if (ev === 'error' && ++errors > 10) return;
      const item = { q: seq++, t: Date.now(), ev };
      for (const [key, value] of Object.entries(fields || {})) {
        if (value !== undefined && value !== null && value !== '') item[key] = value;
      }
      queue.push(item);
      if (urgent || queue.length >= 20) flush();
      else if (!timer) timer = setTimeout(flush, 400);
    }

    // Call once when the first screen is shown: reports the loading speed.
    function ready() {
      if (readySent) return;
      readySent = true;
      try {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation?.responseStart > 0) track('perf', { el: 'ttfb', ms: Math.round(navigation.responseStart) });
        if (navigation?.domContentLoadedEventEnd > 0) track('perf', { el: 'dcl', ms: Math.round(navigation.domContentLoadedEventEnd) });
      } catch { /* Navigation timing is optional. */ }
      track('perf', { el: 'ready', ms: Math.round(performance.now()) });
    }

    if (active) {
      // Script errors and assets that failed to load, so a broken screen is not mistaken for a weak one.
      window.addEventListener('error', e => {
        const target = e.target;
        if (target && target !== window && target.tagName) {
          const file = String(target.currentSrc || target.src || target.href || '').split(/[?#]/)[0].split('/').pop();
          track('error', { sc: currentScreen(), el: target.tagName === 'IMG' ? 'img' : 'asset', val: file.slice(0, 80) });
        } else {
          track('error', { sc: currentScreen(), el: 'js', val: String(e.message || 'error').slice(0, 80) });
        }
      }, true);
      window.addEventListener('unhandledrejection', e => {
        track('error', { sc: currentScreen(), el: 'promise', val: String(e.reason?.message || e.reason || 'rejection').slice(0, 80) });
      });
    }

    return { track, flush, ready, tag, active };
  }

  window.FunnelStream = { init };
})();
