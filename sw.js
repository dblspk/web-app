self.addEventListener('install', e => {
	e.waitUntil(
		caches.open('doublespeak').then(cache => {
			return cache.addAll([
				'/doublespeak/',
				'/doublespeak/index.html',
				'/doublespeak/index.css',
				'/doublespeak/index.js'
			]).then(() => self.skipWaiting());
		})
	);
});

self.addEventListener('activate', e => {
	e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
	e.respondWith(
		caches.open('doublespeak').then((cache) => {
			return fetch(e.request).then((response) => {
				cache.put(e.request, response.clone());
				return response;
			});
		})
	);
});
