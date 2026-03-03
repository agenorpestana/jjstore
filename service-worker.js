const CACHE_NAME = 'rastreae-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptação de requisições (Network First strategy)
self.addEventListener('fetch', (event) => {
  // Ignorar requisições que não sejam GET ou que sejam para outras origens (como APIs externas)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Ignorar requisições para a API
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta for válida, clonar e salvar no cache (opcional, mas bom para performance)
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // Se falhar a rede, tenta buscar no cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Se for uma navegação e não estiver no cache, retorna o index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }

        // Se chegarmos aqui, não temos o que retornar. 
        // Não podemos retornar undefined, então deixamos a requisição falhar naturalmente
        // ou retornamos uma resposta de erro básica.
        return new Response('Network error occurred', {
          status: 408,
          statusText: 'Network error occurred',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        });
      })
  );
});
