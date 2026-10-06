(() => {
  'use strict';
  const config = window.COOMEET_CONFIG?.redirect || {};
  let cachedOfferUrl = null;
  let offerRequest = null;

  function requireHttpsUrl(value) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Offer URL is unavailable.');
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('Offer URL must use HTTPS.');
    if (url.username || url.password) throw new Error('Offer URL must not contain credentials.');
    return value;
  }

  function getOfferUrl() {
    if (cachedOfferUrl) return Promise.resolve(cachedOfferUrl);
    if (offerRequest) return offerRequest;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    offerRequest = Promise.resolve().then(() => fetch(requireHttpsUrl(config.endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`
      },
      body: JSON.stringify({ key: config.landingKey }),
      signal: controller.signal
    })).then(async response => {
      if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
      const data = await response.json();
      if (!data.success) throw new Error('Offer URL is unavailable.');
      cachedOfferUrl = requireHttpsUrl(data.url);
      return cachedOfferUrl;
    }).finally(() => {
      clearTimeout(timeout);
      offerRequest = null;
    });
    return offerRequest;
  }

  function buildFinalUrl(baseUrl, email) {
    const params = new URLSearchParams(window.location.search);
    const tracking = Object.fromEntries(['subid', 'p7', 'clickid', 'subid2'].map(key => [key, encodeURIComponent(params.get(key) || '')]));
    const resolvedUrl = requireHttpsUrl(baseUrl).replace(/\{(subid|p7|clickid|subid2)\}|%7[bB](subid|p7|clickid|subid2)%7[dD]/g, (_, raw, encoded) => tracking[raw || encoded]);
    const bytes = new TextEncoder().encode(JSON.stringify({ email: email.trim() }));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    const finalUrl = new URL(requireHttpsUrl(resolvedUrl));
    finalUrl.searchParams.set('myfdata', btoa(binary));
    return finalUrl.href;
  }

  window.COOMEET_REDIRECT = { getOfferUrl, buildFinalUrl };
})();
