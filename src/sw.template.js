/* woolmer offline worker: keeps the app working with no signal.
 * Pages: network first, then the copy saved last time you opened them.
 * places.json: served from the phone straight away, refreshed in the background.
 * Styles, scripts, icons and fonts: cached once per release.
 * Live data from Supabase (sign-in, reviews, claims, counts) is never cached.
 * VERSION is stamped by the build, so every deploy replaces the old cache. */
const VERSION = 'wb-__VERSION__';
const SHELL = ['/', '/near/', '/saved/', '/search/', '/offline/', '/places.json', '/assets/site.css', '/assets/site.js', '/assets/app.js', '/assets/search.js', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('wb-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;                       // live data, never cached
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {          // fonts: cache once
    e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  if (/^\/(admin|account|claim)\//.test(url.pathname)) return;            // signed-in pages: always live
  if (url.pathname === '/places.json') {                                  // instant, then refresh
    e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || fresh;
    })));
    return;
  }
  if (req.mode === 'navigate') {                                          // pages: network first
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copy)); }
      return res;
    }).catch(() => caches.match(url.pathname).then((hit) => hit || caches.match('/offline/'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && /^\/(assets|icons)\//.test(url.pathname)) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});

// alerts: show them, and open the right page when tapped
self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { title: 'woolmer', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'woolmer', {
    body: m.body || '', tag: m.tag || undefined,
    icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url: m.url || '/' }
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const w = wins.find((c) => new URL(c.url).origin === self.location.origin);
    if (w) { w.navigate(target).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(target);
  }));
});
