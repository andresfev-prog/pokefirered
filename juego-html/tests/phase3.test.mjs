import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AssetLoader } from "../js/overworld/assetLoader.js";
import {
  detectTimeOfDay,
  filterEncountersByTimeAndEnv,
  getAllowedActivityPeriods,
  rollWildEncounter,
} from "../js/overworld/encounterManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");

function parsePngIhdr(filePath) {
  const buf = fs.readFileSync(filePath);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buf.subarray(0, 8).equals(sig), `Cabecera PNG inválida: ${filePath}`);
  const chunkType = buf.subarray(12, 16).toString("ascii");
  assert.equal(chunkType, "IHDR", `Falta IHDR en ${filePath}`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf.readUInt8(24),
    colorType: buf.readUInt8(25), // 6 = RGBA
    sizeBytes: buf.length,
    raw: buf,
  };
}

test("1. Protagonistas (Ash, Gary, Leaf) y NPCs clave son PNG RGBA transparentes válidos y diferenciados", () => {
  const charDir = path.join(WEB_ROOT, "assets/sprites/characters");
  const ash = parsePngIhdr(path.join(charDir, "ash.png"));
  const gary = parsePngIhdr(path.join(charDir, "gary.png"));
  const leaf = parsePngIhdr(path.join(charDir, "leaf.png"));

  for (const [name, info] of Object.entries({ ash, gary, leaf })) {
    assert.equal(info.width, 384, `${name}.png debe tener ancho 384`);
    assert.equal(info.height, 96, `${name}.png debe tener alto 96`);
    assert.equal(info.colorType, 6, `${name}.png debe ser RGBA transparente`);
  }

  assert.ok(!ash.raw.equals(gary.raw), "gary.png debe diferenciarse visualmente de ash.png");
  assert.ok(!ash.raw.equals(leaf.raw), "leaf.png debe diferenciarse de ash.png");

  const keyNpcs = [
    "prof_oak.png",
    "nurse_joy.png",
    "officer_jenny.png",
    "brock.png",
    "misty.png",
    "lt_surge.png",
    "erika.png",
    "koga.png",
    "sabrina.png",
    "blaine.png",
    "giovanni.png",
    "rocket_m.png",
    "rocket_f.png",
  ];
  for (const npcFile of keyNpcs) {
    const p = path.join(charDir, "npcs", npcFile);
    assert.ok(fs.existsSync(p), `Falta NPC sprite clave: ${npcFile}`);
    const info = parsePngIhdr(p);
    assert.equal(info.colorType, 6, `${npcFile} debe ser RGBA transparente`);
    assert.ok(info.width >= 16 && info.height >= 16);
  }
});

test("2. Existen los 302 sprites Pokémon (001_front..151_back) en formato PNG RGBA 64x64 transparente", () => {
  const pkmDir = path.join(WEB_ROOT, "assets/sprites/pokemon");
  let count = 0;
  for (let id = 1; id <= 151; id++) {
    const dex = String(id).padStart(3, "0");
    for (const side of ["front", "back"]) {
      const file = path.join(pkmDir, `${dex}_${side}.png`);
      assert.ok(fs.existsSync(file), `Falta sprite ${dex}_${side}.png`);
      const ihdr = parsePngIhdr(file);
      assert.equal(ihdr.width, 64, `${dex}_${side}.png ancho`);
      assert.equal(ihdr.height, 64, `${dex}_${side}.png alto`);
      assert.equal(ihdr.colorType, 6, `${dex}_${side}.png RGBA`);
      count++;
    }
  }
  assert.equal(count, 302);
});

test("3. Integridad de tilesets PNG, mapas de Kanto, matrices de colisión (0-4) y warps", () => {
  const tilesetManifest = JSON.parse(
    fs.readFileSync(path.join(WEB_ROOT, "assets/tilesets/tilesets_manifest.json"), "utf8")
  );
  for (const [key, meta] of Object.entries(tilesetManifest)) {
    const imgPath = path.join(WEB_ROOT, meta.file);
    assert.ok(fs.existsSync(imgPath), `Falta atlas de tileset ${key}`);
    const ihdr = parsePngIhdr(imgPath);
    assert.equal(ihdr.width, meta.atlasWidth);
    assert.equal(ihdr.height, meta.atlasHeight);
    assert.equal(ihdr.colorType, 6);
  }

  const mapsIndex = JSON.parse(
    fs.readFileSync(path.join(WEB_ROOT, "data/maps/maps_index.json"), "utf8")
  );
  assert.ok(mapsIndex.count >= 250, `Esperados >= 250 mapas de Kanto, encontrados ${mapsIndex.count}`);

  const loadedMaps = {};
  for (const entry of mapsIndex.maps) {
    const mapData = JSON.parse(
      fs.readFileSync(path.join(WEB_ROOT, `data/maps/${entry.id}.json`), "utf8")
    );
    loadedMaps[entry.id] = mapData;
    const cells = mapData.width * mapData.height;
    assert.equal(mapData.metatiles.length, cells, `metatiles en ${entry.id}`);
    assert.equal(mapData.collisions.length, cells, `collisions en ${entry.id}`);
    assert.ok(tilesetManifest[mapData.tileset], `tileset faltante en ${entry.id}`);
    for (const c of mapData.collisions) {
      assert.ok(c >= 0 && c <= 4, `Valor de colisión inválido ${c} en ${entry.id}`);
    }
  }

  // Verificar todas las zonas salvajes de Kanto presentes
  const wildData = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/wild_encounters.json"), "utf8"));
  for (const z of wildData.zones.filter((x) => x.region === "kanto")) {
    assert.ok(loadedMaps[z.mapId], `Falta mapa de encuentros salvajes de Kanto: ${z.mapId}`);
    assert.equal(loadedMaps[z.mapId].environment, z.environment);
  }

  // Verificar colisiones y warps específicos clave
  const pallet = loadedMaps.MAP_PALLET_TOWN;
  assert.equal(pallet.environment, "outdoor");
  assert.ok(pallet.connections.some((c) => c.map === "MAP_ROUTE1" && c.direction === "up"));
  assert.ok(pallet.warps.some((w) => w.destMap === "MAP_PALLET_TOWN_PROFESSOR_OAKS_LAB"));
  assert.ok(loadedMaps.MAP_ROUTE1.collisions.includes(2), "Ruta 1 debe tener hierba alta (2)");
  assert.ok(loadedMaps.MAP_ROUTE1.collisions.includes(4), "Ruta 1 debe tener desniveles/ledges (4)");
  assert.ok(loadedMaps.MAP_PALLET_TOWN.collisions.includes(3), "Pueblo Paleta debe tener agua (3)");
  assert.equal(loadedMaps.MAP_MT_MOON_1F.environment, "cave");
  assert.ok(loadedMaps.MAP_MT_MOON_1F.collisions.includes(2), "Mt. Moon debe tener suelo de encuentro (2)");

  // Verificar warps bidireccionales válidos dentro de Kanto
  for (const mp of Object.values(loadedMaps)) {
    for (const wp of mp.warps) {
      const target = loadedMaps[wp.destMap];
      if (target) {
        assert.ok(
          wp.destWarpId < target.warps.length,
          `Warp inválido ${mp.id}#${wp.warpId} -> ${wp.destMap}#${wp.destWarpId}`
        );
      }
    }
  }
});

test("4. Ciclo horario y filtrado de encuentros (outdoor filtra diurno/nocturno, cave permite todo)", () => {
  assert.equal(detectTimeOfDay(10).key, "day");
  assert.equal(detectTimeOfDay(17).key, "evening");
  assert.equal(detectTimeOfDay(22).key, "night");
  assert.equal(detectTimeOfDay(3).key, "night");

  assert.deepEqual(getAllowedActivityPeriods("day"), ["diurnal", "any"]);
  assert.deepEqual(getAllowedActivityPeriods("night"), ["nocturnal", "any"]);

  const species = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/species.json"), "utf8"));
  const wildData = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/wild_encounters.json"), "utf8"));
  const speciesByKey = Object.fromEntries(species.map((s) => [s.key, s]));
  const wildZonesByMapId = Object.fromEntries(
    wildData.zones.filter((z) => z.region === "kanto").map((z) => [z.mapId, z])
  );

  // Exterior: Ruta 3 tiene especies diurnas (Pidgey, Spearow, Nidoran, Mankey) y Jigglypuff nocturno
  const route3 = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/maps/MAP_ROUTE3.json"), "utf8"));
  const r3Day = filterEncountersByTimeAndEnv({
    zone: wildZonesByMapId.MAP_ROUTE3,
    method: "land",
    speciesByKey,
    timeKey: "day",
    mapEnvironment: route3.environment,
  });
  const r3DayKeys = r3Day.entries.map((e) => e.speciesKey);
  assert.ok(!r3DayKeys.includes("JIGGLYPUFF"), "Jigglypuff (nocturnal) NO debe salir en Ruta 3 de Día");
  assert.ok(r3DayKeys.includes("PIDGEY") && r3DayKeys.includes("MANKEY"));

  const r3Night = filterEncountersByTimeAndEnv({
    zone: wildZonesByMapId.MAP_ROUTE3,
    method: "land",
    speciesByKey,
    timeKey: "night",
    mapEnvironment: route3.environment,
  });
  const r3NightKeys = r3Night.entries.map((e) => e.speciesKey);
  assert.deepEqual(r3NightKeys, ["JIGGLYPUFF"], "De noche en Ruta 3 solo debe aparecer Jigglypuff");

  // Determinismo de rollWildEncounter en exterior de noche
  const nightRoll = rollWildEncounter({
    map: route3,
    tileCollision: 2,
    timeKey: "night",
    wildZonesByMapId,
    speciesByKey,
    forceTrigger: true,
    rng: () => 0.4,
  });
  assert.equal(nightRoll.species.key, "JIGGLYPUFF");
  assert.ok(nightRoll.level >= 3 && nightRoll.level <= 7);

  // Cueva: Mt. Moon 1F ignora el horario (Zubat/Clefairy/Paras nocturnos y Geodude any salen siempre)
  const mtMoon = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/maps/MAP_MT_MOON_1F.json"), "utf8"));
  for (const period of ["day", "evening", "night"]) {
    const caveRes = filterEncountersByTimeAndEnv({
      zone: wildZonesByMapId.MAP_MT_MOON_1F,
      method: "land",
      speciesByKey,
      timeKey: period,
      mapEnvironment: mtMoon.environment,
    });
    assert.equal(caveRes.ignoresTime, true);
    const keys = caveRes.entries.map((e) => e.speciesKey);
    assert.ok(keys.includes("ZUBAT") && keys.includes("CLEFAIRY") && keys.includes("GEODUDE"));
  }
});

test("5. Integridad de IDs del DOM en overworld-test.html y AssetLoader con fetch local", async () => {
  const html = fs.readFileSync(path.join(WEB_ROOT, "overworld-test.html"), "utf8");
  const uiJs = fs.readFileSync(path.join(WEB_ROOT, "js/overworld/overworldTestUI.js"), "utf8");

  const idsInJs = [...uiJs.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(idsInJs.length > 15);
  for (const id of idsInJs) {
    assert.ok(
      html.includes(`id="${id}"`),
      `El id "${id}" referenciado en overworldTestUI.js falta en overworld-test.html`
    );
  }

  // Test AssetLoader JSON loading with local mock fetch
  const localFetch = async (url) => {
    const rel = url.replace(/^\.\//, "");
    const abs = path.join(WEB_ROOT, rel);
    return {
      ok: fs.existsSync(abs),
      status: fs.existsSync(abs) ? 200 : 404,
      json: async () => JSON.parse(fs.readFileSync(abs, "utf8")),
    };
  };

  const loader = new AssetLoader({ basePath: ".", fetchFn: localFetch });
  const core = await loader.loadCoreData();
  assert.equal(core.species.length, 151);
  assert.ok(core.mapsById.MAP_PALLET_TOWN);
  assert.equal(loader.getPokemonSpritePath(25, "front"), "assets/sprites/pokemon/025_front.png");
});
