/* МАСТЕРСКАЯ v2.5 — только статический интерфейс; пользовательские данные не кэшируются. */
const CACHE_NAME = 'masterskaya-static-v2-5';
const APP_SHELL = [
  './', './index.html', './style.css', './app.js', './pwa.js',
  './site.webmanifest', './favicon.svg', './favicon.ico',
  './favicon-32.png', './apple-touch-icon.png', './icon-192.png', './icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('masterskaya-static-') && key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  // Не кэшируем ничего, кроме известных файлов приложения.
  const allowed = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).pathname));
  if (!allowed.has(url.pathname)) return;
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(request, {ignoreSearch:true})) || (request.mode === 'navigate' ? await cache.match('./index.html') : Response.error());
    })
  );
});
