'use strict';

// Vercel's published OpenAPI caps aggregate queries at 100 distinct groups.
// https://vercel.com/openapi.json
const LIMIT = 100;
const DAY_MS = 86400000;
const SCREEN_NAMES = [
  'Первый экран', 'Выбор Women / Men / Both', 'Видеокарусель', 'Выбор типажа', 'Видеочат'
];
const BUCKETS = ['<5s', '5-15s', '15-30s', '30-60s', '1-2m', '>=2m'];
const COUNTRY_CODES = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));

class AnalyticsError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AnalyticsError';
    this.status = status;
    this.code = code;
  }
}

function invalidQuery(message) {
  throw new AnalyticsError(400, 'INVALID_QUERY', message);
}

function dateValue(value, field) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalidQuery(`Поле ${field} должно быть датой YYYY-MM-DD.`);
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) {
    invalidQuery(`В поле ${field} указана несуществующая дата.`);
  }
  return time;
}

function parseRange(params, now = new Date()) {
  const allowed = new Set(['data', 'since', 'until', 'country', 'environment']);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) invalidQuery('Неподдерживаемые или повторяющиеся параметры запроса.');
  }
  if (params.get('data') !== '1') invalidQuery('Для загрузки данных нужен параметр data=1.');
  const until = params.get('until') ?? now.toISOString().slice(0, 10);
  const end = dateValue(until, 'until');
  const since = params.get('since') ?? new Date(end - 6 * DAY_MS).toISOString().slice(0, 10);
  const start = dateValue(since, 'since');
  if (start > end || (end - start) / DAY_MS + 1 > 31) invalidQuery('Выберите период от 1 до 31 дня включительно.');
  const environment = params.get('environment') ?? 'production';
  if (!['production', 'preview'].includes(environment)) invalidQuery('Среда должна быть production или preview.');
  const country = params.get('country') ?? '';
  if (country && !COUNTRY_CODES.has(country)) invalidQuery('Страна должна быть двухбуквенным кодом ISO 3166-1, например US.');
  return { since, until, country, environment };
}

function apiError() {
  return new AnalyticsError(502, 'VERCEL_API_ERROR', 'Vercel вернул неожиданный ответ. Попробуйте обновить данные позже.');
}

function metric(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw apiError();
  return value;
}

// Current REST responses expose a selected custom property's value as eventData.
// Also accept keyed objects, should Vercel return structured JSON dimensions.
function eventValue(row, property) {
  if (Object.hasOwn(row, `eventData/${property}`)) return row[`eventData/${property}`];
  if (row.eventData && typeof row.eventData === 'object' && !Array.isArray(row.eventData)) {
    return row.eventData[property];
  }
  return row.eventData;
}

function screenNumber(value) {
  return /^[1-5]$/.test(String(value)) ? Number(value) : null;
}

function addSafe(left, right) {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < 0) throw apiError();
  return value;
}

function durationValue(value) {
  if (typeof value === 'string' && !/^\d+$/.test(value)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function selectionRows(rows, confirmations, allowed, warnings, label) {
  const counts = new Map(allowed.map(value => [value, { count: 0, confirmedCount: 0 }]));
  let unclassified = 0;
  let unclassifiedConfirmed = 0;
  for (const row of rows) {
    const count = metric(row.count);
    const value = eventValue(row, 'value');
    if (counts.has(value)) counts.get(value).count = addSafe(counts.get(value).count, count);
    else unclassified = addSafe(unclassified, count);
  }
  for (const row of confirmations) {
    const count = metric(row.count);
    const value = eventValue(row, 'choice');
    if (counts.has(value)) counts.get(value).confirmedCount = addSafe(counts.get(value).confirmedCount, count);
    else unclassifiedConfirmed = addSafe(unclassifiedConfirmed, count);
  }
  const result = Array.from(counts, ([value, count]) => ({ value, ...count }));
  if (unclassified) {
    warnings.push(`${label}: есть события с неизвестным значением или группа Others.`);
  }
  if (unclassifiedConfirmed) warnings.push(`${label}: часть подтверждённых кнопкой выборов неизвестна или объединена в Others.`);
  if (unclassified || unclassifiedConfirmed) result.push({ value: 'Другое / неизвестно', count: unclassified, confirmedCount: unclassifiedConfirmed });
  return result;
}

function assembleDashboard(range, results, now = new Date()) {
  const warnings = [];
  const screens = SCREEN_NAMES.map((name, index) => ({
    screen: index + 1, name, views: 0, visitors: 0, clicks: 0, ctr: null,
    timeSegments: 0, totalVisibleMs: 0, averageVisibleMs: null, timePartial: false
  }));
  for (const row of results.views) {
    const views = metric(row.pageviews);
    const visitors = metric(row.visitors);
    const match = /^\/onboarding\/([1-5])$/.exec(row.requestPath);
    if (!match) {
      if (views || visitors) warnings.push('Просмотры: часть данных Vercel объединил в Others или неизвестный путь.');
      continue;
    }
    const screen = screens[Number(match[1]) - 1];
    screen.views = addSafe(screen.views, views);
    screen.visitors = addSafe(screen.visitors, visitors);
  }
  for (const row of results.clicks) {
    const count = metric(row.count);
    const number = screenNumber(eventValue(row, 'screen'));
    if (number === null) {
      if (count) warnings.push('Клики: есть события без номера экрана или группа Others.');
      continue;
    }
    screens[number - 1].clicks = addSafe(screens[number - 1].clicks, count);
  }
  const durations = [];
  const bucketTotals = new Map();
  for (const row of results.buckets) {
    const count = metric(row.count);
    const match = /^screen_time_([1-5])$/.exec(row.eventName);
    const bucket = eventValue(row, 'duration_bucket');
    if (!match || !BUCKETS.includes(bucket)) {
      if (count) warnings.push('Интервалы времени: есть неизвестные группы или Others.');
      continue;
    }
    const key = `${match[1]}:${bucket}`;
    bucketTotals.set(key, addSafe(bucketTotals.get(key) ?? 0, count));
  }
  for (const screen of screens) {
    let total = 0;
    let partial = false;
    let segments = 0;
    for (const row of results[`time${screen.screen}`]) {
      const count = metric(row.count);
      segments = addSafe(segments, count);
      const duration = durationValue(eventValue(row, 'duration_ms'));
      if (duration === null) {
        if (count) partial = true;
        continue;
      }
      const weighted = duration * count;
      if (!Number.isSafeInteger(weighted)) { partial = true; continue; }
      const next = total + weighted;
      if (!Number.isSafeInteger(next)) { partial = true; continue; }
      total = next;
    }
    screen.ctr = screen.views ? screen.clicks / screen.views : null;
    screen.timeSegments = segments;
    screen.totalVisibleMs = total;
    screen.timePartial = partial;
    screen.averageVisibleMs = !partial && segments && screen.views ? total / screen.views : null;
    if (partial) warnings.push(`Экран ${screen.screen}: точное время доступно не для всех событий (Others или неизвестные значения). Среднее время не рассчитано; сумма времени неполная.`);
    for (const bucket of BUCKETS) {
      durations.push({ screen: screen.screen, bucket, count: bucketTotals.get(`${screen.screen}:${bucket}`) ?? 0 });
    }
  }
  const countries = results.countries.map(row => {
    const country = typeof row.country === 'string' ? row.country : '';
    return {
      country: COUNTRY_CODES.has(country) ? country : country === 'Others' ? 'Others' : 'Unknown',
      views: metric(row.pageviews), visitors: metric(row.visitors)
    };
  }).sort((left, right) => right.views - left.views);
  if (countries.some(row => row.country === 'Others')) warnings.push('География: показаны первые 100 стран; остальные объединены Vercel в Others.');
  return {
    range, generatedAt: now.toISOString(), screens,
    preferences: selectionRows(results.preferences, results.preferencesConfirmed, ['Women', 'Men', 'Both'], warnings, 'Выбор партнёра'),
    types: selectionRows(results.types, results.typesConfirmed, ['Karolina', 'Hanna', 'Helen', 'Laura'], warnings, 'Выбор типажа'),
    countries, durations, warnings: Array.from(new Set(warnings))
  };
}

function jobsFor(range) {
  const base = `environment eq '${range.environment}'`;
  const filtered = range.country ? `${base} and country eq '${range.country}'` : base;
  const paths = `(${[1, 2, 3, 4, 5].map(screen => `requestPath eq '/onboarding/${screen}'`).join(' or ')})`;
  const jobs = [
    { key: 'views', dataset: 'visits', by: ['requestPath'], filter: `${filtered} and ${paths}` },
    { key: 'countries', dataset: 'visits', by: ['country'], filter: `${base} and ${paths}` },
    { key: 'clicks', dataset: 'events', by: ['eventData/screen'], filter: `${filtered} and eventName eq 'cta_click'` },
    { key: 'preferences', dataset: 'events', by: ['eventData/value'], filter: `${filtered} and eventName eq 'preference_select'` },
    { key: 'types', dataset: 'events', by: ['eventData/value'], filter: `${filtered} and eventName eq 'type_select'` },
    { key: 'preferencesConfirmed', dataset: 'events', by: ['eventData/choice'], filter: `${filtered} and eventName eq 'cta_click' and eventData/screen eq '2'` },
    { key: 'typesConfirmed', dataset: 'events', by: ['eventData/choice'], filter: `${filtered} and eventName eq 'cta_click' and eventData/screen eq '4'` },
    { key: 'buckets', dataset: 'events', by: ['eventName', 'eventData/duration_bucket'], filter: `${filtered} and (${[1, 2, 3, 4, 5].map(screen => `eventName eq 'screen_time_${screen}'`).join(' or ')})` }
  ];
  for (let screen = 1; screen <= 5; screen++) {
    jobs.push({ key: `time${screen}`, dataset: 'events', by: ['eventData/duration_ms'], filter: `${filtered} and eventName eq 'screen_time_${screen}'` });
  }
  return jobs;
}

function upstreamError(status) {
  if (status === 401 || status === 403) return new AnalyticsError(502, 'VERCEL_ACCESS_DENIED', 'Vercel отклонил доступ к аналитике. Проверьте токен и его доступ к проекту и команде.');
  if (status === 402) return new AnalyticsError(502, 'VERCEL_PLAN_REQUIRED', 'Текущий тариф или лимиты Vercel не позволяют получить эти данные. Проверьте настройки Web Analytics.');
  if (status === 429) return new AnalyticsError(503, 'VERCEL_RATE_LIMIT', 'Достигнут лимит запросов Vercel. Подождите минуту перед обновлением.');
  if (status === 410) return new AnalyticsError(502, 'VERCEL_RANGE_UNAVAILABLE', 'Данные за выбранный период недоступны в Vercel. Выберите более свежий период.');
  return new AnalyticsError(502, 'VERCEL_API_ERROR', 'Не удалось загрузить аналитику из Vercel. Проверьте проект, Web Analytics и доступность API.');
}

async function query(job, range, settings) {
  const url = new URL(`https://api.vercel.com/v1/query/web-analytics/${job.dataset}/aggregate`);
  url.searchParams.set('projectId', settings.projectId);
  if (settings.teamId) url.searchParams.set('teamId', settings.teamId);
  for (const dimension of job.by) url.searchParams.append('by', dimension);
  url.searchParams.set('since', `${range.since}T00:00:00.000Z`);
  url.searchParams.set('until', `${range.until}T23:59:59.999Z`);
  url.searchParams.set('limit', String(LIMIT));
  url.searchParams.set('filter', job.filter);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: 'GET', headers: { Authorization: `Bearer ${settings.token}`, Accept: 'application/json' },
      signal: controller.signal, redirect: 'error', cache: 'no-store'
    });
    if (!response.ok) throw upstreamError(response.status);
    const body = await response.json();
    if (!body || !Array.isArray(body.data) || body.data.length > LIMIT + 1 || body.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw apiError();
    return body.data;
  } catch (error) {
    if (controller.signal.aborted) throw new AnalyticsError(504, 'VERCEL_TIMEOUT', 'Vercel не ответил вовремя. Попробуйте обновить данные позже.');
    if (error instanceof AnalyticsError) throw error;
    throw apiError();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDashboard(range, env = process.env) {
  const settings = {
    token: env.VERCEL_ANALYTICS_TOKEN,
    projectId: env.VERCEL_ANALYTICS_PROJECT_ID || env.VERCEL_PROJECT_ID,
    teamId: env.VERCEL_ANALYTICS_TEAM_ID
  };
  if (!settings.token || !settings.projectId) {
    throw new AnalyticsError(503, 'ANALYTICS_NOT_CONFIGURED', 'В Vercel нужно настроить серверные переменные VERCEL_ANALYTICS_TOKEN и VERCEL_ANALYTICS_PROJECT_ID.');
  }
  const jobs = jobsFor(range);
  const results = {};
  let next = 0;
  let failure = null;
  async function worker() {
    while (!failure && next < jobs.length) {
      const job = jobs[next++];
      try { results[job.key] = await query(job, range, settings); }
      catch (error) { if (!failure) failure = error; }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  if (failure) throw failure;
  return assembleDashboard(range, results);
}

module.exports = { AnalyticsError, parseRange, fetchDashboard, assembleDashboard, jobsFor };
