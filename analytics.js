(() => {
  'use strict';
  const local = ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'].includes(location.hostname) || location.hostname.endsWith('.localhost');
  const enabled = window.COOMEET_CONFIG?.analytics?.enabled !== false && ['https:', 'http:'].includes(location.protocol) && !local;
  const types = { karolina: 'Karolina', hanna: 'Hanna', helen: 'Helen', laura: 'Laura' };
  const preferences = ['Women', 'Men', 'Both'];
  let currentScreen = null;
  let visibleSince = null;
  let viewed = false;
  let suspended = false;
  const validScreen = screen => Number.isInteger(screen) && screen >= 1 && screen <= 5;

  function send(command, payload) {
    if (!enabled) return;
    try { window.va(command, payload); } catch { /* Analytics must not interrupt the landing. */ }
  }
  function event(name, data) { send('event', { name, data }); }
  function pageview() {
    const path = `/onboarding/${currentScreen}`;
    send('pageview', { path, route: path });
    viewed = true;
  }
  function beginVisible() {
    if (currentScreen === null || document.hidden || suspended) return;
    if (!viewed) pageview();
    if (visibleSince === null) visibleSince = performance.now();
  }
  function durationBucket(ms) {
    if (ms < 5000) return '<5s';
    if (ms < 15000) return '5-15s';
    if (ms < 30000) return '15-30s';
    if (ms < 60000) return '30-60s';
    if (ms < 120000) return '1-2m';
    return '>=2m';
  }
  function endVisible() {
    if (visibleSince === null) return;
    const duration = Math.max(0, Math.round(performance.now() - visibleSince));
    visibleSince = null;
    if (duration > 0) event(`screen_time_${currentScreen}`, { duration_ms: duration, duration_bucket: durationBucket(duration) });
  }
  function enter(screen) {
    if (!validScreen(screen)) return;
    if (currentScreen !== screen) {
      endVisible();
      currentScreen = screen;
      viewed = false;
      suspended = false;
    }
    beginVisible();
  }
  function cta(screen, choice) {
    if (!validScreen(screen)) return;
    const data = { screen };
    if (screen === 2 && preferences.includes(choice)) data.choice = choice;
    if (screen === 4 && Object.hasOwn(types, choice)) data.choice = types[choice];
    event('cta_click', data);
  }
  function preference(value) {
    if (preferences.includes(value)) event('preference_select', { value });
  }
  function type(id) {
    if (Object.hasOwn(types, id)) event('type_select', { value: types[id] });
  }
  function finish() { endVisible(); suspended = true; }
  function resume() { suspended = false; beginVisible(); }

  if (enabled) {
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    send('beforeSend', analyticsEvent => {
      try {
        const url = new URL(analyticsEvent.url, location.origin);
        url.search = '';
        url.hash = '';
        return { ...analyticsEvent, url: url.href };
      } catch { return null; }
    });
    const script = document.createElement('script');
    script.src = '/_vercel/insights/script.js';
    script.async = true;
    script.dataset.disableAutoTrack = '1';
    document.head.append(script);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) endVisible(); else beginVisible(); });
  window.addEventListener('pagehide', finish);
  window.addEventListener('pageshow', event => {
    if (event.persisted) { viewed = false; resume(); }
  });
  window.COOMEET_ANALYTICS = { enter, cta, preference, type, finish, resume };
})();
