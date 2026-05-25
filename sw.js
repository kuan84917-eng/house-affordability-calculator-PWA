// 購屋能力評估試算工具 — Service Worker
// 版本號：更新此值可強制清除舊快取
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `home-calc-${CACHE_VERSION}`;

// 需要預先快取的資源
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/apple-touch-icon.png',
  // Google Fonts（嘗試快取，失敗則跳過）
  'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&family=Noto+Sans+TC:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap',
  // html2canvas CDN
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

// ── Install：預先快取核心資源 ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 逐一快取，失敗的第三方資源不阻斷安裝
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW] 無法快取：${url}`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate：清除舊版快取 ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => key.startsWith('home-calc-') && key !== CACHE_NAME)
          .map(key => {
            console.log(`[SW] 刪除舊快取：${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch：快取優先策略（離線可用）────────────────────────
self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 第三方字體 / CDN：網路優先，失敗則用快取
  const isExternal = url.origin !== self.location.origin;
  if (isExternal) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 本地資源：快取優先，有快取直接用；無快取才上網取並存
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
