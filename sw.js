// sw.js -- offline shell. spec §7
//
// The whole app is static files and localStorage, so there is nothing to sync
// and no network path worth preferring: cache-first, always. A gym basement
// with no signal is the design target, not the edge case.
//
// ------------------------------------------------------------------------
// BUMP VERSION ON EVERY DEPLOY.
//
// Nothing bumps it automatically -- there is no build step. A deploy that
// changes index.html, style.css, any js/ file or exercises.json while VERSION
// stays the same ships bytes that installed phones will never fetch: they hold
// the old copy in the old cache and go on serving it. The browser only looks
// for a new worker when sw.js itself differs, and VERSION is what makes it
// differ. Forgetting this is the one way to ship an invisible update.
// ------------------------------------------------------------------------

const VERSION = 'v45';
const CACHE = `gymbuddy-${VERSION}`;

// Relative, every one of them. GitHub Pages serves this from /GymBuddy/, not
// from the domain root, so a leading slash would resolve to the wrong origin
// path and precaching would 404 on the real host while passing on localhost.
const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/app.js',
  './js/ui.js',
  './js/storage.js',
  './js/generator.js',
  './js/rules.js',
  './js/templates.js',
  './js/calendar.js',
  './data/exercises.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// --------------------------------------------------------------------------
// Install
// --------------------------------------------------------------------------

// No skipWaiting, deliberately. A new worker taking over mid-session would
// swap the code under a workout being read between sets. The update lands on
// the next launch instead, which for a 1-3x/week app is soon enough.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // {cache: 'reload'} on every entry, and it is not optional.
    //
    // A bare addAll() fetches through the browser's ordinary HTTP cache, which
    // will happily hand back the copy it picked up on the previous visit. The
    // result is a freshly-installed worker that precaches the PREVIOUS
    // deploy's files -- version bumped, cache renamed, old bytes inside. It
    // then serves those confidently until the next deploy, and the bug looks
    // like "the update did not ship" rather than anything to do with the
    // worker. Caught doing exactly this on 2026-08-21.
    await cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })));
  })());
});

// --------------------------------------------------------------------------
// Activate
// --------------------------------------------------------------------------

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => n.startsWith('gymbuddy-') && n !== CACHE)
           .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

// --------------------------------------------------------------------------
// Fetch
// --------------------------------------------------------------------------

self.addEventListener('fetch', event => {
  const req = event.request;

  // Non-GET and cross-origin go straight to the network untouched. The app
  // makes neither today; this is here so that adding one later cannot
  // silently start being served stale from cache.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // A navigation offline must land on the shell rather than the browser's
  // dinosaur, whatever path the home-screen icon was saved with.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html', { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(req);
      } catch {
        return new Response('GymBuddy is offline and not installed yet.', {
          status: 503, headers: { 'Content-Type': 'text/plain' }
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // Opaque responses have status 0 and cache as permanent failures, so
      // only store what came back genuinely OK.
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    } catch {
      // Cache miss with no network. Nothing useful to return -- but a 504 the
      // app can see beats a hung promise.
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
