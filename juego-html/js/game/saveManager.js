/**
 * Sistema de Guardado Dual (Fase 4 — SPEC_MAESTRA §6):
 *  - 3 ranuras independientes en localStorage: pokefirered_web_slot_1, _2, _3.
 *  - Exportación e importación portátil en formato .json con validación estricta de esquema.
 */

import { createBattlePokemon } from "../battle/battleEngine.js";
import { markCaptured } from "./pokemonProgress.js";

export const SAVE_SCHEMA_VERSION = 1;
export const INITIAL_MONEY = 5000;
export const VALID_PROTAGONISTS = ["ash", "gary", "leaf"];
export const SAVE_SLOTS = [1, 2, 3];
export const SLOT_STORAGE_KEYS = {
  1: "pokefirered_web_slot_1",
  2: "pokefirered_web_slot_2",
  3: "pokefirered_web_slot_3",
};

export function getSlotStorageKey(slot) {
  const num = Number(slot);
  if (!SLOT_STORAGE_KEYS[num]) {
    throw new Error(`Ranura de guardado inválida: ${slot}. Usa 1, 2 o 3.`);
  }
  return SLOT_STORAGE_KEYS[num];
}

function resolveStorage(customStorage = null) {
  if (customStorage) return customStorage;
  if (typeof globalThis !== "undefined" && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  throw new Error("No hay almacenamiento local disponible.");
}

export function createDefaultFlags(protagonist = "ash") {
  return {
    starterChosen: false,
    chosenStarterKey: null,
    rivalCharacter: protagonist === "gary" ? "ash" : "gary",
    rivalStarterKey: protagonist === "ash" ? "EEVEE" : protagonist === "gary" ? "PIKACHU" : null,
    rivalWins: 0,
    rivalLosses: 0,
    ashBulbasaurObtained: false,
    ashCharmanderObtained: false,
    ashSquirtleObtained: false,
    wonGrandPrixP1: false,
    safariRaceWon: false,
    wonLeagueTournament: false,
    unlockedEliteFour: false,
    wonEliteFour: false,
    isChampion: false,
    defeatedGyms: [],
    defeatedFrontierBrains: [],
    lastHealLocation: {
      mapId: "MAP_PALLET_TOWN",
      mapName: "Pueblo Paleta",
      x: 6,
      y: 8,
    },
  };
}

/**
 * Crea un estado completo listo para jugar desde cero (dinero inicial: ₽5,000).
 */
export function createEmptyGameState({
  slot = 1,
  protagonist = "ash",
  playerName = "",
  mapId = "MAP_PALLET_TOWN_PROFESSOR_OAKS_LAB",
  mapName = "Lab. Prof. Oak",
  x = 6,
  y = 6,
  facing = "up",
} = {}) {
  const cleanProtag = VALID_PROTAGONISTS.includes(protagonist) ? protagonist : "ash";
  const defaultNames = { ash: "Ash", gary: "Gary", leaf: "Leaf" };
  const cleanName = String(playerName || "").trim() || defaultNames[cleanProtag];

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    slot: Number(slot) || 1,
    protagonist: cleanProtag,
    playerCharacter: cleanProtag,
    mode: cleanProtag === "ash" ? "anime" : "classic",
    playerName: cleanName.slice(0, 14),
    money: INITIAL_MONEY,
    location: {
      mapId,
      mapName,
      x,
      y,
      facing,
    },
    party: [],
    pcBox: [],
    bag: {
      POKE_BALL: 10,
      POTION: 5,
    },
    pokedex: {
      seen: [],
      captured: [],
    },
    badges: [],
    frontierSymbols: [],
    flags: createDefaultFlags(cleanProtag),
    stats: {
      battlesWon: 0,
      wildCaught: 0,
      playSeconds: 0,
    },
    savedAt: new Date().toISOString(),
  };
}

function sanitizePokemonForSave(mon) {
  if (!mon || typeof mon !== "object") return null;
  const moves = Array.isArray(mon.moves)
    ? mon.moves.slice(0, 4).map((m) => ({
        id: m.id,
        key: m.key,
        name: m.name,
        type: m.type,
        category: m.category,
        power: m.power ?? 0,
        accuracy: m.accuracy ?? 100,
        pp: m.maxPp ?? m.pp ?? 10,
        priority: m.priority ?? 0,
        effect: m.effect || "EFFECT_HIT",
        effectChance: m.effectChance ?? 0,
        target: m.target || "MOVE_TARGET_SELECTED",
        makesContact: Boolean(m.makesContact),
        currentPp: Math.max(0, Number(m.currentPp ?? m.maxPp ?? m.pp ?? 10)),
        maxPp: Math.max(1, Number(m.maxPp ?? m.pp ?? 10)),
      }))
    : [];

  return {
    uid: String(mon.uid || `${mon.speciesKey || "PKM"}_${Math.random().toString(36).slice(2, 7)}`),
    speciesId: Number(mon.speciesId),
    speciesKey: String(mon.speciesKey),
    name: String(mon.name || mon.speciesName || mon.speciesKey),
    speciesName: String(mon.speciesName || mon.name || mon.speciesKey),
    types: Array.isArray(mon.types) ? [...mon.types] : ["NORMAL"],
    baseStats: mon.baseStats ? { ...mon.baseStats } : { hp: 45, attack: 45, defense: 45, speed: 45, spAttack: 45, spDefense: 45 },
    catchRate: Number(mon.catchRate ?? 45),
    safariZoneFleeRate: Number(mon.safariZoneFleeRate ?? 0),
    expYield: Number(mon.expYield ?? 64),
    growthRate: String(mon.growthRate || "GROWTH_MEDIUM_FAST"),
    ability: String(mon.ability || "NONE"),
    level: Math.max(1, Math.min(100, Number(mon.level || 5))),
    baseLevel: Math.max(1, Math.min(100, Number(mon.baseLevel ?? mon.level ?? 5))),
    exp: Math.max(0, Number(mon.exp ?? 0)),
    ivs: mon.ivs ? { ...mon.ivs } : { hp: 15, attack: 15, defense: 15, speed: 15, spAttack: 15, spDefense: 15 },
    evs: mon.evs ? { ...mon.evs } : { hp: 0, attack: 0, defense: 0, speed: 0, spAttack: 0, spDefense: 0 },
    stats: mon.stats ? { ...mon.stats } : { hp: Number(mon.maxHp || 20), attack: 10, defense: 10, speed: 10, spAttack: 10, spDefense: 10 },
    maxHp: Math.max(1, Number(mon.maxHp ?? mon.stats?.hp ?? 20)),
    currentHp: Math.max(0, Math.min(Number(mon.maxHp ?? mon.stats?.hp ?? 20), Number(mon.currentHp ?? mon.maxHp ?? 20))),
    status: mon.status || null,
    sleepTurns: Number(mon.sleepTurns || 0),
    toxicCounter: Number(mon.toxicCounter || 1),
    confused: false,
    confusionTurns: 0,
    flinched: false,
    focusEnergy: false,
    foresight: false,
    statStages: {
      attack: 0,
      defense: 0,
      spAttack: 0,
      spDefense: 0,
      speed: 0,
      accuracy: 0,
      evasion: 0,
    },
    moves,
  };
}

function rehydratePokemon(mon, dataMaps = null) {
  const clean = sanitizePokemonForSave(mon);
  if (!clean) return null;
  if (!dataMaps?.speciesMap || !dataMaps?.movesMap) return clean;
  const sp = dataMaps.speciesMap[clean.speciesKey] || dataMaps.speciesMap[clean.speciesId];
  if (!sp) return clean;

  const built = createBattlePokemon(sp, clean.level, dataMaps.movesMap, {
    uid: clean.uid,
    nickname: clean.name,
    ivs: clean.ivs,
    evs: clean.evs,
    exp: clean.exp,
    currentHp: clean.currentHp,
    status: clean.status,
    baseLevel: clean.baseLevel,
    moveKeys: clean.moves.map((m) => m.key).filter(Boolean),
  });
  built.moves = built.moves.map((mv, idx) => {
    const savedMv = clean.moves[idx];
    if (savedMv && savedMv.key === mv.key && typeof savedMv.currentPp === "number") {
      return { ...mv, currentPp: Math.min(mv.maxPp, Math.max(0, savedMv.currentPp)) };
    }
    return mv;
  });
  return built;
}

/**
 * Valida estrictamente la estructura de una partida (tanto localStorage como archivo .json importado).
 */
export function validateSaveSchema(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["El archivo de guardado no es un objeto JSON válido."] };
  }

  const protag = raw.protagonist || raw.playerCharacter;
  if (!VALID_PROTAGONISTS.includes(protag)) {
    errors.push(`Protagonista inválido: "${protag}". Debe ser ash, gary o leaf.`);
  }

  if (typeof raw.playerName !== "string" || raw.playerName.trim().length === 0) {
    errors.push("Falta el nombre del jugador (playerName).");
  }

  if (typeof raw.money !== "number" || !Number.isFinite(raw.money) || raw.money < 0) {
    errors.push("El dinero (money) debe ser un número finito mayor o igual a 0.");
  }

  if (!raw.location || typeof raw.location !== "object") {
    errors.push("Faltan los datos de ubicación (location).");
  } else {
    if (typeof raw.location.mapId !== "string" || !raw.location.mapId.startsWith("MAP_")) {
      errors.push("location.mapId inválido.");
    }
    if (!Number.isInteger(raw.location.x) || raw.location.x < 0) {
      errors.push("location.x debe ser un entero >= 0.");
    }
    if (!Number.isInteger(raw.location.y) || raw.location.y < 0) {
      errors.push("location.y debe ser un entero >= 0.");
    }
  }

  const validateMonList = (list, label) => {
    if (!Array.isArray(list)) {
      errors.push(`${label} debe ser un arreglo.`);
      return;
    }
    list.forEach((m, idx) => {
      if (!m || typeof m !== "object") {
        errors.push(`${label}[${idx}] es inválido.`);
        return;
      }
      if (!Number.isInteger(m.speciesId) || m.speciesId < 1 || m.speciesId > 151) {
        errors.push(`${label}[${idx}].speciesId inválido (${m.speciesId}).`);
      }
      if (typeof m.speciesKey !== "string" || !m.speciesKey) {
        errors.push(`${label}[${idx}].speciesKey faltante.`);
      }
      if (typeof m.level !== "number" || m.level < 1 || m.level > 100) {
        errors.push(`${label}[${idx}].level fuera de rango (1..100).`);
      }
      if (typeof m.maxHp !== "number" || m.maxHp < 1 || typeof m.currentHp !== "number" || m.currentHp < 0) {
        errors.push(`${label}[${idx}] tiene PS inválidos.`);
      }
      if (!Array.isArray(m.moves) || m.moves.length > 4) {
        errors.push(`${label}[${idx}].moves inválido.`);
      }
    });
  };

  if (!Array.isArray(raw.party) || raw.party.length > 6) {
    errors.push("party debe ser un arreglo de máximo 6 Pokémon.");
  } else {
    validateMonList(raw.party, "party");
  }

  validateMonList(raw.pcBox ?? [], "pcBox");

  if (!raw.bag || typeof raw.bag !== "object" || Array.isArray(raw.bag)) {
    errors.push("bag debe ser un objeto con cantidades.");
  } else {
    for (const [k, v] of Object.entries(raw.bag)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        errors.push(`Cantidad inválida en bag["${k}"]: ${v}`);
      }
    }
  }

  if (!raw.pokedex || typeof raw.pokedex !== "object" || !Array.isArray(raw.pokedex.seen) || !Array.isArray(raw.pokedex.captured)) {
    errors.push("pokedex debe contener arreglos seen y captured.");
  }

  if (!Array.isArray(raw.badges)) errors.push("badges debe ser un arreglo.");
  if (!Array.isArray(raw.frontierSymbols)) errors.push("frontierSymbols debe ser un arreglo.");
  if (!raw.flags || typeof raw.flags !== "object" || Array.isArray(raw.flags)) {
    errors.push("flags debe ser un objeto.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const defaults = createDefaultFlags(protag);
  const normalized = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    slot: SAVE_SLOTS.includes(Number(raw.slot)) ? Number(raw.slot) : 1,
    protagonist: protag,
    playerCharacter: protag,
    mode: protag === "ash" ? "anime" : "classic",
    playerName: raw.playerName.trim().slice(0, 14),
    money: Math.floor(raw.money),
    location: {
      mapId: raw.location.mapId,
      mapName: String(raw.location.mapName || raw.location.mapId),
      x: raw.location.x,
      y: raw.location.y,
      facing: ["down", "up", "left", "right"].includes(raw.location.facing) ? raw.location.facing : "down",
    },
    party: raw.party.map(sanitizePokemonForSave).filter(Boolean),
    pcBox: (raw.pcBox || []).map(sanitizePokemonForSave).filter(Boolean),
    bag: { ...raw.bag },
    pokedex: {
      seen: [...new Set(raw.pokedex.seen.map(Number).filter((n) => n >= 1 && n <= 151))].sort((a, b) => a - b),
      captured: [...new Set(raw.pokedex.captured.map(Number).filter((n) => n >= 1 && n <= 151))].sort((a, b) => a - b),
    },
    badges: [...new Set(raw.badges.map(String))],
    frontierSymbols: [...new Set(raw.frontierSymbols.map(String))],
    flags: { ...defaults, ...raw.flags },
    stats: {
      battlesWon: Number(raw.stats?.battlesWon || 0),
      wildCaught: Number(raw.stats?.wildCaught || 0),
      playSeconds: Number(raw.stats?.playSeconds || 0),
    },
    savedAt: typeof raw.savedAt === "string" && raw.savedAt ? raw.savedAt : new Date().toISOString(),
  };

  for (const mon of [...normalized.party, ...normalized.pcBox]) {
    markCaptured(normalized, mon.speciesId);
  }

  return { valid: true, errors: [], data: normalized };
}

export function serializeSaveState(state) {
  const cloned = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    slot: SAVE_SLOTS.includes(Number(state.slot)) ? Number(state.slot) : 1,
    protagonist: state.protagonist || state.playerCharacter || "ash",
    playerCharacter: state.protagonist || state.playerCharacter || "ash",
    mode: (state.protagonist || state.playerCharacter) === "ash" ? "anime" : "classic",
    playerName: String(state.playerName || "Entrenador"),
    money: Math.max(0, Math.floor(Number(state.money ?? INITIAL_MONEY))),
    location: {
      mapId: state.location?.mapId || "MAP_PALLET_TOWN",
      mapName: state.location?.mapName || "Pueblo Paleta",
      x: Number(state.location?.x ?? 6),
      y: Number(state.location?.y ?? 8),
      facing: state.location?.facing || "down",
    },
    party: (state.party || []).slice(0, 6).map(sanitizePokemonForSave).filter(Boolean),
    pcBox: (state.pcBox || []).map(sanitizePokemonForSave).filter(Boolean),
    bag: { ...(state.bag || {}) },
    pokedex: {
      seen: [...(state.pokedex?.seen || [])],
      captured: [...(state.pokedex?.captured || [])],
    },
    badges: [...new Set(state.badges || [])],
    frontierSymbols: [...new Set(state.frontierSymbols || [])],
    flags: { ...createDefaultFlags(state.protagonist || "ash"), ...(state.flags || {}) },
    stats: {
      battlesWon: Number(state.stats?.battlesWon || 0),
      wildCaught: Number(state.stats?.wildCaught || 0),
      playSeconds: Number(state.stats?.playSeconds || 0),
    },
    savedAt: new Date().toISOString(),
  };

  const check = validateSaveSchema(cloned);
  if (!check.valid) {
    throw new Error(`Estado de partida inválido al serializar: ${check.errors.join("; ")}`);
  }
  return check.data;
}

export function saveToSlot(slot, state, storage = null) {
  const store = resolveStorage(storage);
  const key = getSlotStorageKey(slot);
  const snapshot = serializeSaveState({ ...state, slot: Number(slot) });
  store.setItem(key, JSON.stringify(snapshot));
  return snapshot;
}

export function loadFromSlot(slot, storage = null, dataMaps = null) {
  const store = resolveStorage(storage);
  const key = getSlotStorageKey(slot);
  const rawStr = store.getItem(key);
  if (!rawStr) return null;

  let parsed;
  try {
    parsed = JSON.parse(rawStr);
  } catch (err) {
    throw new Error(`Ranura ${slot} dañada (JSON inválido): ${err.message}`);
  }

  const check = validateSaveSchema(parsed);
  if (!check.valid) {
    throw new Error(`Ranura ${slot} incompatible: ${check.errors.join("; ")}`);
  }

  const loaded = { ...check.data, slot: Number(slot) };
  if (dataMaps) {
    loaded.party = loaded.party.map((m) => rehydratePokemon(m, dataMaps));
    loaded.pcBox = loaded.pcBox.map((m) => rehydratePokemon(m, dataMaps));
  }
  return loaded;
}

export function deleteSlot(slot, storage = null) {
  const store = resolveStorage(storage);
  const key = getSlotStorageKey(slot);
  store.removeItem(key);
}

export function listSaveSlots(storage = null) {
  const store = resolveStorage(storage);
  return SAVE_SLOTS.map((slot) => {
    const key = getSlotStorageKey(slot);
    const rawStr = store.getItem(key);
    if (!rawStr) {
      return { slot, key, isEmpty: true, state: null, summary: null, error: null };
    }
    try {
      const state = loadFromSlot(slot, store);
      const lead = state.party[0];
      return {
        slot,
        key,
        isEmpty: false,
        state,
        error: null,
        summary: {
          protagonist: state.protagonist,
          playerName: state.playerName,
          mode: state.mode,
          mapName: state.location.mapName,
          money: state.money,
          badgesCount: state.badges.length,
          frontierCount: state.frontierSymbols.length,
          pokedexCaught: state.pokedex.captured.length,
          partyCount: state.party.length,
          leadSpeciesKey: lead?.speciesKey || null,
          leadSpeciesId: lead?.speciesId || null,
          leadLevel: lead?.level || null,
          savedAt: state.savedAt,
        },
      };
    } catch (err) {
      return {
        slot,
        key,
        isEmpty: false,
        state: null,
        summary: null,
        error: err.message,
      };
    }
  });
}

export function exportSaveJson(state) {
  const snapshot = serializeSaveState(state);
  return JSON.stringify(snapshot, null, 2);
}

export function createExportFilename(state) {
  const name = (state?.playerName || "entrenador").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const stamp = new Date().toISOString().slice(0, 10);
  return `pokefirered_${state?.protagonist || "ash"}_${name}_${stamp}.json`;
}

export function importSaveJson(jsonString, targetSlot, storage = null, dataMaps = null) {
  if (typeof jsonString !== "string" || !jsonString.trim()) {
    return { ok: false, errors: ["El archivo importado está vacío."], message: "El archivo importado está vacío." };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      ok: false,
      errors: [`JSON malformado: ${err.message}`],
      message: "El archivo seleccionado no es un JSON válido.",
    };
  }

  const check = validateSaveSchema(parsed);
  if (!check.valid) {
    return {
      ok: false,
      errors: check.errors,
      message: `Archivo de guardado inválido: ${check.errors[0]}`,
    };
  }

  const saved = saveToSlot(targetSlot, { ...check.data, slot: Number(targetSlot) }, storage);
  const finalState = dataMaps ? loadFromSlot(targetSlot, storage, dataMaps) : saved;
  return {
    ok: true,
    slot: Number(targetSlot),
    state: finalState,
    message: `Partida de ${finalState.playerName} importada correctamente en la Ranura ${targetSlot}.`,
  };
}
