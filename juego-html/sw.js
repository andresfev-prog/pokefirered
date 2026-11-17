/**
 * Service Worker PWA 100% Offline para Pokémon FireRed · Kanto Web Edition.
 * Diseñado exclusivamente con rutas relativas (./) para funcionar bajo cualquier
 * subruta de despliegue (por ejemplo /pokefirered/juego-html/ en GitHub Pages).
 */

const CACHE_PREFIX = "pokefirered-kanto-offline-";
const CACHE_NAME = "pokefirered-kanto-offline-v1";
const OFFLINE_MANIFEST_PATH = "./data/offline_assets.json";

const CORE_SHELL_PATHS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/game.css",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./data/offline_assets.json",
  "./js/game/mainApp.js",
  "./js/game/saveManager.js",
  "./js/game/pokemonProgress.js",
  "./js/game/storyEvents.js",
  "./js/game/leagueAndFrontier.js",
  "./js/overworld/assetLoader.js",
  "./js/overworld/encounterManager.js",
  "./js/overworld/overworldEngine.js",
  "./js/battle/battleEngine.js",
  "./js/battle/levelScaler.js",
  "./js/battle/damageCalculator.js",
  "./js/battle/battleAI.js",
  "./data/species.json",
  "./data/moves.json",
  "./data/type_chart.json",
  "./data/items.json",
  "./data/evolutions.json",
  "./data/wild_encounters.json",
  "./data/maps/maps_index.json",
  "./assets/tilesets/tilesets_manifest.json",
  "./assets/sprites/characters/characters_manifest.json",
  "./assets/sprites/characters/npcs/npcs_manifest.json"
];

function getScopeBase() {
  if (self.registration && self.registration.scope) {
    return self.registration.scope;
  }
  return new URL("./", self.location.href).href;
}

function toScopedUrl(relPath) {
  return new URL(relPath, getScopeBase()).href;
}

function stripSearch(urlStr) {
  const u = new URL(urlStr);
  u.search = "";
  return u.href;
}

async function cacheUrlsBatched(cache, relPaths, { batchSize = 12, forceRefresh = false, onBatch = null } = {}) {
  const uniquePaths = Array.from(new Set(relPaths));
  const total = uniquePaths.length;
  let completed = 0;
  let failed = 0;
  let newlyCached = 0;
  const failedAssets = [];

  for (let i = 0; i < uniquePaths.length; i += batchSize) {
    const batch = uniquePaths.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (rel) => {
        const fullUrl = toScopedUrl(rel);
        try {
          if (!forceRefresh) {
            const existing = await cache.match(fullUrl, { ignoreSearch: true });
            if (existing) {
              completed += 1;
              return;
            }
          }
          const req = new Request(fullUrl, { cache: forceRefresh ? "reload" : "default" });
          const res = await fetch(req);
          if (!res || !res.ok) {
            throw new Error(`HTTP ${res ? res.status : "ERR"}`);
          }
          await cache.put(fullUrl, res);
          newlyCached += 1;
          completed += 1;
        } catch (_err) {
          failed += 1;
          completed += 1;
          failedAssets.push(rel);
        }
      })
    );

    if (onBatch) {
      await onBatch({
        completed,
        total,
        failed,
        newlyCached,
        percent: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 100
      });
    }
  }

  return { completed, total, failed, newlyCached, failedAssets };
}

async function broadcastToClients(payload, preferredSource = null) {
  if (preferredSource && typeof preferredSource.postMessage === "function") {
    try {
      preferredSource.postMessage(payload);
    } catch (_err) {
      // Ignorar si el cliente ya no está activo
    }
  }
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    if (preferredSource && client.id === preferredSource.id) continue;
    try {
      client.postMessage(payload);
    } catch (_err) {
      // Ignorar errores de canal cerrado
    }
  }
}

async function loadOfflineManifest(cache) {
  const manifestUrl = toScopedUrl(OFFLINE_MANIFEST_PATH);
  try {
    const netRes = await fetch(new Request(manifestUrl, { cache: "no-cache" }));
    if (netRes && netRes.ok) {
      await cache.put(manifestUrl, netRes.clone());
      return await netRes.json();
    }
  } catch (_err) {
    // Sin red: leer versión cacheada
  }

  const cachedRes = await cache.match(manifestUrl, { ignoreSearch: true });
  if (cachedRes) {
    return await cachedRes.json();
  }
  return { version: "core-only", assets: CORE_SHELL_PATHS };
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cacheUrlsBatched(cache, CORE_SHELL_PATHS, { batchSize: 10, forceRefresh: false });
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const scopeBase = getScopeBase();
  const reqUrl = new URL(req.url);
  if (reqUrl.origin !== self.location.origin || !reqUrl.href.startsWith(scopeBase)) {
    return;
  }

  // Estrategia Cache-First con respaldo en red y almacenamiento automático
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) {
        return cached;
      }

      try {
        const netRes = await fetch(req);
        if (netRes && netRes.ok && netRes.type === "basic") {
          await cache.put(req, netRes.clone());
        }
        return netRes;
      } catch (_err) {
        if (req.mode === "navigate") {
          const fallback = await cache.match(toScopedUrl("./index.html"), { ignoreSearch: true });
          if (fallback) return fallback;
        }
        return new Response("Recurso no disponible sin conexión.", {
          status: 503,
          statusText: "Offline Unavailable",
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "CHECK_OFFLINE_STATUS") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const manifest = await loadOfflineManifest(cache);
        const assetList = Array.isArray(manifest.assets) ? manifest.assets : CORE_SHELL_PATHS;
        const cachedReqs = await cache.keys();
        const cachedSet = new Set(cachedReqs.map((r) => stripSearch(r.url)));

        let cachedCount = 0;
        for (const rel of assetList) {
          if (cachedSet.has(stripSearch(toScopedUrl(rel)))) {
            cachedCount += 1;
          }
        }
        const totalCount = assetList.length;
        await broadcastToClients(
          {
            type: "OFFLINE_STATUS",
            cachedCount,
            totalCount,
            ready: totalCount > 0 && cachedCount >= totalCount,
            version: manifest.version || "v1"
          },
          event.source
        );
      })()
    );
    return;
  }

  if (data.type === "CACHE_ALL_OFFLINE_ASSETS") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const manifest = await loadOfflineManifest(cache);
        const rawList = Array.isArray(manifest.assets) ? manifest.assets : CORE_SHELL_PATHS;
        const fullList = ["./", OFFLINE_MANIFEST_PATH].concat(rawList);

        const result = await cacheUrlsBatched(cache, fullList, {
          batchSize: 12,
          forceRefresh: Boolean(data.forceRefresh),
          onBatch: async (progress) => {
            await broadcastToClients(
              {
                type: "OFFLINE_CACHE_PROGRESS",
                completed: progress.completed,
                total: progress.total,
                failed: progress.failed,
                newlyCached: progress.newlyCached,
                percent: progress.percent,
                version: manifest.version || "v1"
              },
              event.source
            );
          }
        });

        await broadcastToClients(
          {
            type: "OFFLINE_CACHE_COMPLETE",
            completed: result.completed,
            total: result.total,
            failed: result.failed,
            newlyCached: result.newlyCached,
            failedAssets: result.failedAssets,
            ready: result.failed === 0,
            version: manifest.version || "v1"
          },
          event.source
        );
      })()
    );
  }
});
