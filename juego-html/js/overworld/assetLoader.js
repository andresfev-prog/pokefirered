/**
 * Cargador asíncrono con caché para recursos de Overworld y Combate:
 * - JSONs base (especies, movimientos, tipos, objetos, encuentros)
 * - Mapas de Kanto y manifiestos de sprites/tilesets
 * - Hojas PNG de protagonistas, NPCs, Pokémon (front/back) y tilesets
 */

export class AssetLoader {
  constructor(options = {}) {
    this.basePath = (options.basePath || ".").replace(/\/$/, "");
    this.fetchFn = options.fetchFn || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    this.jsonCache = new Map();
    this.imageCache = new Map();
    this.corePromise = null;
  }

  resolveUrl(relPath) {
    const clean = relPath.replace(/^\.\//, "");
    return `${this.basePath}/${clean}`;
  }

  loadJson(relPath) {
    if (this.jsonCache.has(relPath)) {
      return this.jsonCache.get(relPath);
    }
    if (!this.fetchFn) {
      return Promise.reject(new Error(`No hay fetch disponible para cargar ${relPath}`));
    }
    const url = this.resolveUrl(relPath);
    const promise = this.fetchFn(url).then((res) => {
      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status} al cargar ${url}`);
      }
      return res.json();
    });
    this.jsonCache.set(relPath, promise);
    return promise;
  }

  loadImage(relPath) {
    if (!relPath) return Promise.resolve(null);
    if (this.imageCache.has(relPath)) {
      return this.imageCache.get(relPath);
    }
    const url = this.resolveUrl(relPath);
    const promise = new Promise((resolve, reject) => {
      if (typeof Image === "undefined") {
        reject(new Error(`Image constructor no disponible para ${url}`));
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar la imagen ${url}`));
      img.src = url;
    });
    this.imageCache.set(relPath, promise);
    return promise;
  }

  getPokemonSpritePath(speciesId, side = "front") {
    const padded = String(speciesId).padStart(3, "0");
    const validSide = side === "back" ? "back" : "front";
    return `assets/sprites/pokemon/${padded}_${validSide}.png`;
  }

  async loadCoreData() {
    if (this.corePromise) return this.corePromise;
    this.corePromise = (async () => {
      const [
        tilesetsManifest,
        charactersManifest,
        npcsManifest,
        mapsIndex,
        wildEncounters,
        species,
        moves,
        typeChart,
        items,
        evolutions,
      ] = await Promise.all([
        this.loadJson("assets/tilesets/tilesets_manifest.json"),
        this.loadJson("assets/sprites/characters/characters_manifest.json"),
        this.loadJson("assets/sprites/characters/npcs/npcs_manifest.json"),
        this.loadJson("data/maps/maps_index.json"),
        this.loadJson("data/wild_encounters.json"),
        this.loadJson("data/species.json"),
        this.loadJson("data/moves.json"),
        this.loadJson("data/type_chart.json"),
        this.loadJson("data/items.json"),
        this.loadJson("data/evolutions.json"),
      ]);

      const wildZonesByMapId = {};
      for (const z of wildEncounters.zones || []) {
        if (z.region === "kanto") {
          wildZonesByMapId[z.mapId] = z;
        }
      }

      const speciesByKey = {};
      const speciesById = {};
      for (const sp of species) {
        speciesByKey[sp.key] = sp;
        speciesById[sp.id] = sp;
      }

      const mapsById = {};
      for (const m of mapsIndex.maps || []) {
        mapsById[m.id] = m;
      }

      const evolutionsByKey = {};
      const evolutionsById = {};
      for (const ev of evolutions || []) {
        evolutionsByKey[ev.speciesKey] = ev;
        evolutionsById[ev.speciesId] = ev;
      }

      const itemsByKey = {};
      for (const it of items || []) {
        itemsByKey[it.key] = it;
        if (it.itemId) itemsByKey[it.itemId] = it;
        itemsByKey[it.id] = it;
      }

      return {
        tilesetsManifest,
        charactersManifest,
        npcsManifest,
        mapsIndex,
        mapsById,
        wildEncounters,
        wildZonesByMapId,
        species,
        speciesByKey,
        speciesById,
        moves,
        typeChart,
        items,
        itemsByKey,
        evolutions,
        evolutionsByKey,
        evolutionsById,
      };
    })();
    return this.corePromise;
  }

  async loadCharacterSprite(charKey) {
    const core = await this.loadCoreData();
    const meta = core.charactersManifest.characters[charKey] || core.charactersManifest.characters.ash;
    const image = await this.loadImage(meta.file);
    return { key: charKey, meta, manifest: core.charactersManifest, image };
  }

  async loadMapBundle(mapId, options = {}) {
    const core = await this.loadCoreData();
    const mapData = await this.loadJson(`data/maps/${mapId}.json`);
    const tsMeta = core.tilesetsManifest[mapData.tileset];
    const tilesetImage = tsMeta ? await this.loadImage(tsMeta.file) : null;

    // Precargar sprites de NPCs del mapa
    const uniqueSprites = [...new Set((mapData.npcs || []).map((n) => n.spriteFile).filter(Boolean))];
    const npcSprites = {};
    await Promise.all(
      uniqueSprites.map(async (rel) => {
        try {
          npcSprites[rel] = await this.loadImage(rel);
        } catch {
          npcSprites[rel] = null;
        }
      })
    );

    // Precarga en segundo plano de mapas conectados
    if (options.prefetchConnections !== false && Array.isArray(mapData.connections)) {
      for (const conn of mapData.connections) {
        if (core.mapsById[conn.map] && !this.jsonCache.has(`data/maps/${conn.map}.json`)) {
          this.loadMapBundle(conn.map, { prefetchConnections: false }).catch(() => {});
        }
      }
    }

    return {
      map: mapData,
      tilesetMeta: tsMeta,
      tilesetImage,
      npcSprites,
    };
  }
}
