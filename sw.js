const V = 'v6';
const SHELL = ['./', 'a.bin', 'manifest.webmanifest', 'icon-192.png?v=3', 'apple-touch-icon.png?v=3'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
async function netFirst(req, key, ms) {
  const cache = await caches.open(V);
  const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r && r.ok) cache.put(key, r.clone()); return r; });
  const cached = await cache.match(key);
  if (!cached) return net;
  const slow = new Promise(res => setTimeout(() => res(null), ms));
  try { return (await Promise.race([net, slow])) || cached; } catch (e) { return cached; }
}
async function netSave(req, key) {
  const r = await fetch(req, { cache: 'no-store' });
  if (r && r.ok) { const cache = await caches.open(V); await cache.put(key, r.clone()); }
  return r;
}
async function staleWhile(req) {
  const cache = await caches.open(V);
  const cached = await cache.match(req);
  const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => cached);
  return cached || net;
}
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (r.headers.has('range')) return;
  if (u.origin !== location.origin) return;
  if (r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('index.html')) { e.respondWith(netFirst(r, './', 1200)); return; }
  if (u.pathname.endsWith('/a.bin')) { e.respondWith(netFirst(r, 'a.bin', 1200)); return; }
  if (u.pathname.endsWith('/d.bin')) { e.respondWith(netSave(r, 'd.bin')); return; }
  if (/\.(png|webmanifest)$/.test(u.pathname)) e.respondWith(staleWhile(r));
});
