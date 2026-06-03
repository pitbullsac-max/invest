// ── SERVICE WORKER — Dashboard de Investimentos ───────────────
// Versão do cache — incremente ao fazer deploy para forçar update
const CACHE_VERSION = 'invest-v2.4.0';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;

// Arquivos que sempre ficam em cache
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
];

// ── INSTALL: pré-carrega arquivos essenciais ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      // Tenta cachear cada arquivo individualmente para não travar tudo
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(e => console.warn('Cache miss:', url, e)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpa caches antigos ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estratégia Network First com fallback para cache ───
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-GET e APIs externas (Firebase, CoinGecko, Anthropic)
  if (request.method !== 'GET') return;
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('firestore') ||
      url.hostname.includes('coingecko') ||
      url.hostname.includes('anthropic') ||
      url.hostname.includes('brapi')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        // Salva cópia no cache se a resposta for válida
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sem internet? Serve do cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // Fallback final: index.html para navegação
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ── MENSAGENS: força update do SW quando solicitado ───────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
