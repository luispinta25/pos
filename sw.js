// =====================================================
// SERVICE WORKER - FERRISOLUCIONES POS
// Version: 2.0.8
// Strategy: Network First
// =====================================================

const CACHE_NAME = 'ferrisoluciones-pos-v2-0-8';
const RUNTIME_CACHE = 'ferrisoluciones-runtime-v2-0-8';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/css/cxc-styles.css',
    '/css/print.css',
    '/js/app.js',
    '/js/auth.js',
    '/js/config.js',
    '/js/ingreso-factura.js',
    '/img/favicon.ico',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// =====================================================
// INSTALL EVENT
// =====================================================

self.addEventListener('install', (event) => {
    console.log('🔧 [SW] Installing Service Worker v2.0.8...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 [SW] Caching static assets...');
                return cache.addAll(STATIC_ASSETS)
                    .catch(err => {
                        console.warn('⚠️ [SW] Some assets failed to cache:', err);
                        // Continue even if some assets fail
                        return Promise.resolve();
                    });
            })
            .then(() => {
                console.log('✅ [SW] Installation complete');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('❌ [SW] Installation failed:', err);
            })
    );
});

// =====================================================
// ACTIVATE EVENT
// =====================================================

self.addEventListener('activate', (event) => {
    console.log('🚀 [SW] Activating Service Worker v2.0.8...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Delete old caches
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            console.log('🗑️ [SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ [SW] Activation complete');
                return self.clients.claim();
            })
    );
});

// =====================================================
// FETCH EVENT - NETWORK FIRST STRATEGY
// =====================================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Network First Strategy
    event.respondWith(
        fetch(request)
            .then(response => {
                // Check if valid response
                if (!response || response.status !== 200 || response.type === 'basic' && response.url.includes('chrome-extension')) {
                    return response;
                }

                // Clone response for caching
                const responseClone = response.clone();
                
                // Cache successful responses
                caches.open(RUNTIME_CACHE)
                    .then(cache => {
                        cache.put(request, responseClone);
                    })
                    .catch(err => {
                        console.warn('⚠️ [SW] Failed to cache:', url.pathname, err);
                    });

                return response;
            })
            .catch(err => {
                console.log('📡 [SW] Network request failed, using cache for:', url.pathname);
                
                // Try to get from cache
                return caches.match(request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }

                        // Return offline page or placeholder
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html')
                                .then(response => {
                                    return response || new Response(
                                        '<h1>Offline</h1><p>No connection and no cached version available</p>',
                                        {
                                            status: 503,
                                            statusText: 'Service Unavailable',
                                            headers: new Headers({
                                                'Content-Type': 'text/html'
                                            })
                                        }
                                    );
                                });
                        }

                        // For other requests, return error response
                        return new Response(
                            'Network request failed and no cache available',
                            {
                                status: 503,
                                statusText: 'Service Unavailable'
                            }
                        );
                    });
            })
    );
});

// =====================================================
// MESSAGE EVENT - For updating SW and cache control
// =====================================================

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(RUNTIME_CACHE)
            .then(() => {
                console.log('✅ [SW] Runtime cache cleared');
                event.ports[0].postMessage({ success: true });
            });
    }

    if (event.data && event.data.type === 'GET_CACHE_SIZE') {
        caches.open(RUNTIME_CACHE)
            .then(cache => {
                cache.keys().then(requests => {
                    event.ports[0].postMessage({ 
                        success: true, 
                        size: requests.length,
                        version: '2.0.8'
                    });
                });
            });
    }
});

console.log('✅ Service Worker v2.0.8 loaded (Network First Strategy)');
