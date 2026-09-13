/* Push to Play — service worker.
   Goal: the app opens instantly and works with no signal (a gym basement is the
   normal case), while still picking up new versions when there is a connection. */

const VERSION = 'ptp-v12';

/* Without these two the app is not an app, so a failure to cache them must fail
   the install and leave the previous version in place. */
const CRITICAL = [
  './',
  './index.html'
];
/* Nice to have offline. A 404 on one icon should not cost the user their app. */
const OPTIONAL = [
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

/* How long a launch waits for the network before falling back to the cache.
   The failure this guards is not "offline" — navigator.onLine catches that — but
   a connection that accepts and never answers, which is what gym wifi and captive
   portals actually do. */
const NAV_TIMEOUT_MS = 2500;

/* A response is only fit to become the offline copy of the app if it is a real
   same-origin 200. A 500, a 404 or a captive portal's sign-in page is also an
   HTTP response, and caching one of those replaces the app with it — permanently,
   because install (the only thing that re-adds the shell) runs on version change
   alone. */
function isCacheableShell(res) {
  return !!res && res.ok && res.status === 200 && res.type === 'basic';
}

/* A captive portal answers a same-origin GET with 200 and its own sign-in page.
   Status and type cannot tell that apart from a deploy, so the body has to say so:
   the page carries a <meta name="ptp-app"> sentinel and nothing else does. Without
   this check the portal's HTML becomes the cached app — permanently, since install
   is the only thing that re-adds the shell and it runs on a version change alone. */
function looksLikeTheApp(res) {
  return res.clone().text()
    .then((t) => t.indexOf('name="ptp-app"') > -1)
    .catch(() => false);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      /* addAll is all-or-nothing: if the shell cannot be fetched, this install
         rejects, the new worker never activates, and the old cache survives. */
      Promise.all(CRITICAL.map((url) =>
        fetch(new Request(url, { cache: 'reload' })).then((res) => {
          if (!isCacheableShell(res)) throw new Error('shell fetch failed');
          return looksLikeTheApp(res).then((isApp) => {
            if (!isApp) throw new Error('shell is not this app');
            return cache.put(url, res);
          });
        })))
        .then(() => Promise.all(
          OPTIONAL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))
        ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function cachedShell() {
  return caches.match('./index.html').then((r) => r || caches.match('./'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  /* The page itself: network first so a deployed update is picked up on the next
     launch with signal — but on a timer, and only trusting a real 200. */
  if (req.mode === 'navigate') {
    event.respondWith(
      new Promise((resolve) => {
        let settled = false;
        const done = (r) => { if (!settled) { settled = true; resolve(r); } };

        const timer = setTimeout(() => {
          cachedShell().then((hit) => { if (hit) done(hit); });
        }, NAV_TIMEOUT_MS);

        fetch(req).then((res) => {
          clearTimeout(timer);
          if (!isCacheableShell(res)) {
            /* A real response, but not one worth keeping. Prefer the good copy we
               already have; show the server's answer only if we have none. */
            cachedShell().then((hit) => done(hit || res));
            return;
          }
          looksLikeTheApp(res).then((isApp) => {
            if (isApp) {
              const copy = res.clone();
              event.waitUntil(caches.open(VERSION).then((c) => c.put('./index.html', copy)));
              done(res);
            } else {
              cachedShell().then((hit) => done(hit || res));
            }
          });
        }).catch(() => {
          clearTimeout(timer);
          cachedShell().then((hit) => done(hit || Response.error()));
        });
      })
    );
    return;
  }

  /* Icons and the manifest never change within a version: cache first. */
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          event.waitUntil(caches.open(VERSION).then((c) => c.put(req, copy)));
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  /* Google Fonts only — never a blanket third-party cache. Serve from cache when
     present and refresh in the background; if it is missing and there is no
     signal, the CSS fallback stack takes over. */
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!isFont) return;

  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          event.waitUntil(caches.open(VERSION).then((c) => c.put(req, copy)));
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
