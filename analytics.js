(() => {
  'use strict';
  const local = ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'].includes(location.hostname) || location.hostname.endsWith('.localhost');
  const enabled = window.COOMEET_CONFIG?.analytics?.enabled !== false && ['https:', 'http:'].includes(location.protocol) && !local;
  const types = { karolina: 'Karolina', hanna: 'Hanna', helen: 'Helen', laura: 'Laura' };
  const preferences = ['Women', 'Men'];
  let currentScreen = null;
  let visibleSince = null;
  let viewed = false;
  let suspended = false;
  const validScreen = screen => Number.isInteger(screen) && screen >= 1 && screen <= 5;

  // Unified funnel stream: one schema for every funnel, sent to the shared hub collector.
  // funnel-stream.js is the shared client; its canonical copy and the schema live in the funnel-hub repository.
  // funnel.json is the landing's description of itself: id, version and screen ids in order.
  // scripts/build.mjs inlines it here; the hub reads the same file from a pull request before a change is merged.
  // The version there goes up by one with every visible change of the funnel.
  let FUNNEL = { id: 'coomeet-mobile', version: '0', screens: [] };
  try { FUNNEL = JSON.parse('__FUNNEL__'); } catch { /* Not built: the stream stays off. */ }
  const BUILD = '__BUILD__'; // Replaced with the commit by scripts/build.mjs.
  const STREAM_ENDPOINT = 'https://funnel-hub-phi.vercel.app/api/e'; // The hub collector. Empty string: the stream is off.
  const idOf = screen => FUNNEL.screens[screen - 1]; // Screen number in the page -> screen id of the funnel.
  const screenId = () => idOf(currentScreen);
  const stream = window.FunnelStream?.init({
    funnel: FUNNEL.id, version: FUNNEL.version, build: BUILD, endpoint: FUNNEL.screens.length ? STREAM_ENDPOINT : '', screen: screenId
  }) || { track() { }, flush() { }, ready() { }, tag: url => url };
  let visibleTotal = 0, acted = false;

  // Visible time from the screen view to the first tap or keystroke on it.
  function firstAction() {
    if (acted || !viewed) return undefined;
    acted = true;
    return Math.round(visibleTotal + (visibleSince === null ? 0 : performance.now() - visibleSince));
  }

  function send(command, payload) {
    if (!enabled) return;
    try { window.va(command, payload); } catch { /* Analytics must not interrupt the landing. */ }
  }
  function event(name, data) { send('event', { name, data }); }
  function pageview() {
    const path = `/onboarding/${currentScreen}`;
    send('pageview', { path, route: path });
    viewed = true;
    visibleTotal = 0; acted = false;
    stream.track('view', { sc: screenId() });
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
    if (duration > 0) {
      event(`screen_time_${currentScreen}`, { duration_ms: duration, duration_bucket: durationBucket(duration) });
      visibleTotal += duration;
      stream.track('leave', { sc: screenId(), ms: duration });
    }
  }
  function enter(screen) {
    if (!validScreen(screen)) return;
    stream.ready();
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
    stream.track('click', { sc: idOf(screen), el: 'cta', fa: firstAction() });
    // Screens 2 and 4 open with an option already selected. A visitor who goes on without touching one
    // leaves with that default: the answer is reported with the mark "_default".
    if (screen === 2 && !preferenceTouched && preferences.includes(choice)) stream.track('answer', { sc: idOf(2), el: 'preference_default', val: choice.toLowerCase() });
    if (screen === 4 && !typeTouched && Object.hasOwn(types, choice)) stream.track('answer', { sc: idOf(4), el: 'type_default', val: choice });
  }
  let preferenceTouched = false, typeTouched = false;
  function preference(value) {
    if (!preferences.includes(value)) return;
    event('preference_select', { value });
    preferenceTouched = true;
    stream.track('answer', { sc: idOf(2), el: 'preference_option', val: value.toLowerCase(), fa: firstAction() });
  }
  function type(id) {
    if (!Object.hasOwn(types, id)) return;
    event('type_select', { value: types[id] });
    typeTouched = true;
    stream.track('answer', { sc: idOf(4), el: 'type_card', val: id, fa: firstAction() });
  }
  // Only the stage of the input is reported to the stream, never the address itself.
  let emailWasStarted = false;
  function emailStarted() {
    if (emailWasStarted || currentScreen !== 5) return;
    emailWasStarted = true;
    stream.track('input', { sc: idOf(5), el: 'email', val: 'started', fa: firstAction() });
  }
  function emailEntered() {
    event('email_entered', { screen: 5 });
    stream.track('input', { sc: idOf(5), el: 'email', val: 'valid' });
  }
  function emailSubmitted() {
    event('email_submit', { screen: 5 });
    stream.track('input', { sc: idOf(5), el: 'email', val: 'submit' });
  }
  // The offer link with this session's id added for the tracker (funnel-stream.js, tag()). The tracker's click is
  // born when the visitor leaves the landing, so this id is what lets the hub join a registration or a purchase
  // to the visit. Never throws: a link that cannot be tagged goes out as it was.
  let offerTagged = false;
  function tagOffer(url) {
    let tagged = url;
    try { if (stream.tag) tagged = stream.tag(url); } catch { /* The link goes out as it was. */ }
    offerTagged = tagged !== url;
    return tagged;
  }
  function outboundRedirect() {
    event('outbound_redirect', { screen: 5 });
    // Sent at once: the page is already leaving for the offer. val "sid": the link carried the session id.
    stream.track('outbound', { sc: idOf(5), el: 'cta', val: offerTagged ? 'sid' : undefined }, true);
  }
  // The offer link could not be resolved or opened: the visitor stays on the last screen.
  function redirectError() {
    stream.track('error', { sc: idOf(5), el: 'redirect' });
    resume();
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { endVisible(); stream.flush(); } else beginVisible();
  });
  window.addEventListener('pagehide', () => { finish(); stream.flush(); });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { viewed = false; resume(); }
  });
  window.COOMEET_ANALYTICS = { enter, cta, preference, type, emailStarted, emailEntered, emailSubmitted, tagOffer, outboundRedirect, redirectError, finish, resume };
})();
