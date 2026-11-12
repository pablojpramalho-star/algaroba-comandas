const CACHE = 'algaroba-shell-2.9.7.70-pwa23';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './mesa-clientes.js',
  './conferencias.js',
  './estoque-queijo-coalho.js',
  './estoque-pedidos-auditoria.js',
  './bebidas-caldos-v63.js',
  './caixa-turnos.js',
  './cervejas-litrinho-v66.js',
  './clientes-conta-prazo.js',
  './sincronizacao-segura-v68.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Não interfere nas requisições externas, como Supabase.
  if (url.origin !== self.location.origin) return;

  // Para navegação, tenta sempre a versão atual da rede primeiro.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Scripts e estilos: rede primeiro para não executar correções obsoletas.
  // Em modo offline, mantém a última cópia válida sem tocar no localStorage.
  if (/\\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw new Error('Arquivo indisponível offline');
      })
    );
    return;
  }

  // Arquivos estáticos: cache primeiro, rede como alternativa.
  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;

        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        });
      })
  );
});
