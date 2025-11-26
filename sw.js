
// Service Worker — network-first pour app.js pour éviter les versions obsolètes
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('ev6-cache').then(cache => cache.addAll([
    '/', '/index.html', '/style.css', '/manifest.json'
  ])));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname === '/app.js') {
    // network-first pour app.js
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open('ev6-cache').then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(resp => resp || fetch(e.request)));
  }
});
