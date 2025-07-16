// Service Worker for FixFlow App (Debugging Version)
console.log('Service Worker Loaded - v1.0 (Debug)');

// --- CACHE VERSION ---
// Incrementing the version number is crucial for triggering the 'activate' event.
const CACHE_NAME = 'RE-cache-v1.0'; 
const REPO_NAME = '/RE'; // << Your repository name on GitHub

// A list of files to cache for the application shell.
const urlsToCache = [
  `${REPO_NAME}/`,
  `${REPO_NAME}/index.html`,
  `${REPO_NAME}/manifest.json`,
  `${REPO_NAME}/icon-192.png`,
  `${REPO_NAME}/icon-512.png`
];

/**
 * A custom function to cache files individually and log any errors.
 * This helps pinpoint which file is causing the 'addAll' to fail.
 * @param {Cache} cache The cache instance to add files to.
 * @param {string[]} urls An array of URLs to cache.
 * @returns {Promise<boolean>} A promise that resolves to true if all URLs were cached successfully.
 */
async function cacheUrlsIndividually(cache, urls) {
  let allSucceeded = true;
  for (const url of urls) {
    try {
      // Create a new Request object. This is a good practice.
      const request = new Request(url);
      // Fetch and cache the request.
      await cache.add(request);
      console.log(`[SW] Successfully cached: ${url}`);
    } catch (error) {
      // If a single URL fails to cache, log the specific error and continue.
      console.error(`[SW] FAILED to cache: ${url}. Error:`, error);
      allSucceeded = false; // Mark that at least one file failed.
    }
  }
  return allSucceeded;
}


// --- INSTALL EVENT ---
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell individually to find errors...');
        // Use the new debugging function instead of cache.addAll()
        return cacheUrlsIndividually(cache, urlsToCache);
      })
      .then((allSucceeded) => {
        if (allSucceeded) {
          console.log('[SW] All resources cached successfully. Activating worker.');
          // If everything is fine, activate the new service worker immediately.
          return self.skipWaiting();
        } else {
          console.error('[SW] Some resources failed to cache. The service worker will try again on the next load. Please check the file paths and names.');
          // We don't call skipWaiting() if caching failed. This gives it a chance to retry.
        }
      })
  );
});

// --- ACTIVATE EVENT ---
// This event is triggered when the new service worker becomes active.
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// --- FETCH EVENT ---
// Network falling back to cache strategy.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// --- PUSH & NOTIFICATION CLICK EVENTS ---
// (These parts remain unchanged)
self.addEventListener('push', event => {
  console.log('[SW] Push Received.');
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'FixFlow Notification';
  const options = {
    body: data.body || 'You have a new update.',
    icon: `${REPO_NAME}/icon-192.png`, 
    badge: `${REPO_NAME}/icon-192.png`,
    data: { url: data.url || `${REPO_NAME}/` }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || `${REPO_NAME}/`)
  );
});
