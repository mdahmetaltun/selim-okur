// Çevrimdışı çalışma: uygulama kabuğu ağ-öncelikli (güncellemeler hemen görünsün), ses/yazı tipi/simge önbellek-öncelikli.
const VERSION = 'selim-okur-v12';
const SHELL = ['./', 'index.html', 'style.css', 'game.css', 'app.js', 'manifest.json', 'fonts/fonts.css',
    'js/platform.js', 'js/curriculum.js', 'js/judge.js', 'js/dsp.js', 'js/verify.js', 'js/store.js', 'js/templates.js', 'js/learn.js', 'js/backup.js', 'js/mic.js', 'js/audio.js', 'js/recognizer.js'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isStatic = (url) => /\/(audio|fonts|icons)\//.test(url.pathname);

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;
    if (isStatic(url)) {
        e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
            if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
            return res;
        })));
        return;
    }
    e.respondWith(fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
});
