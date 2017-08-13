// Service worker installation
self.addEventListener('install', e => {
	e.waitUntil(
		caches.open('doublespeak').then(cache => {
			return cache.addAll([
				'/',
				'/index.html',
				'/index.css',
				'/index.js',
				'/lib/doublespeak.js'
			]).then(() => self.skipWaiting());
		})
	);
});

// Service worker activation
self.addEventListener('activate', e => {
	e.waitUntil(self.clients.claim());
});

// Service worker fetch
self.addEventListener('fetch', e => {
	// Respond with cache
	e.respondWith(
		caches.open('doublespeak').then(cache => {
			return cache.match(e.request);
		})
	);
	// Update cache
	e.waitUntil(
		caches.open('doublespeak').then(cache => {
			return fetch(e.request).then(response => {
				return cache.put(e.request, response);
			});
		})
	);
});
