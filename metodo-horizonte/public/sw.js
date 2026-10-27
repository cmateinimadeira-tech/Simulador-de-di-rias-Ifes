// Service worker do Método Horizonte: guarda as telas do app para uso sem internet.
// Os dados do plano já ficam no aparelho; aqui só tratamos as páginas e os arquivos do app.
const CACHE = "horizonte-v2";
const ESSENCIAIS = ["/", "/mes", "/grade", "/cenarios", "/novo", "/importar", "/conta", "/manifest.webmanifest", "/icone.svg"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ESSENCIAIS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

async function guardar(pedido, resposta) {
  if (resposta.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(pedido, resposta.clone());
  }
  return resposta;
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  if (pedido.method !== "GET" || url.origin !== self.location.origin) return;

  // Páginas: rede primeiro (versão mais nova), cache quando estiver sem internet.
  if (pedido.mode === "navigate") {
    evento.respondWith(
      fetch(pedido)
        .then((r) => guardar(pedido, r))
        .catch(async () => (await caches.match(pedido, { ignoreSearch: true })) ?? (await caches.match("/"))),
    );
    return;
  }

  // Arquivos do build têm nome com hash: cache primeiro.
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(caches.match(pedido).then((c) => c ?? fetch(pedido).then((r) => guardar(pedido, r))));
    return;
  }

  // Demais arquivos: rede primeiro, cache como reserva.
  evento.respondWith(
    fetch(pedido)
      .then((r) => guardar(pedido, r))
      .catch(() => caches.match(pedido)),
  );
});
