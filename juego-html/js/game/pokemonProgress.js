/**
 * Progresión Pokémon, Pokédex, Caja del PC, Mochila y Evoluciones (Fase 4).
 * Reemplaza por completo las evoluciones por intercambio por objetos (Cordón Unión / Piedras).
 */

import { calculatePokemonStats } from "../battle/damageCalculator.js";
import { createEmptyStatStages } from "../battle/battleEngine.js";

export const ITEM_LABELS_ES = {
  FIRE_STONE: "Piedra Fuego",
  WATER_STONE: "Piedra Agua",
  THUNDER_STONE: "Piedra Trueno",
  LEAF_STONE: "Piedra Hoja",
  MOON_STONE: "Piedra Lunar",
  LINKING_CORD: "Cordón Unión",
};

/**
 * Normaliza llaves de objeto como "ITEM_LINKING_CORD" <-> "LINKING_CORD".
 */
export function normalizeItemKey(keyOrId) {
  if (!keyOrId) return "";
  const raw = String(keyOrId).trim().toUpperCase();
  return raw.startsWith("ITEM_") ? raw.slice(5) : raw;
}

export function getBagItemCount(state, keyOrId) {
  if (!state?.bag) return 0;
  const norm = normalizeItemKey(keyOrId);
  if (typeof state.bag[norm] === "number") return Math.max(0, state.bag[norm]);
  const withPrefix = `ITEM_${norm}`;
  if (typeof state.bag[withPrefix] === "number") return Math.max(0, state.bag[withPrefix]);
  return 0;
}

export function addBagItem(state, keyOrId, qty = 1) {
  if (!state.bag) state.bag = {};
  const norm = normalizeItemKey(keyOrId);
  const amount = Math.max(1, Math.floor(qty));
  const current = getBagItemCount(state, norm);
  delete state.bag[`ITEM_${norm}`];
  state.bag[norm] = current + amount;
  return state.bag[norm];
}

export function consumeBagItem(state, keyOrId, qty = 1) {
  if (!state.bag) return false;
  const norm = normalizeItemKey(keyOrId);
  const current = getBagItemCount(state, norm);
  if (current < qty) return false;
  delete state.bag[`ITEM_${norm}`];
  const next = current - qty;
  if (next > 0) {
    state.bag[norm] = next;
  } else {
    delete state.bag[norm];
  }
  return true;
}

export function ensurePokedexShape(state) {
  if (!state.pokedex) state.pokedex = { seen: [], captured: [] };
  if (!Array.isArray(state.pokedex.seen)) state.pokedex.seen = [];
  if (!Array.isArray(state.pokedex.captured)) state.pokedex.captured = [];
}

export function markSeen(state, speciesId) {
  ensurePokedexShape(state);
  const id = Number(speciesId);
  if (!Number.isInteger(id) || id < 1 || id > 151) return false;
  if (!state.pokedex.seen.includes(id)) {
    state.pokedex.seen.push(id);
    state.pokedex.seen.sort((a, b) => a - b);
    return true;
  }
  return false;
}

export function markCaptured(state, speciesId) {
  ensurePokedexShape(state);
  const id = Number(speciesId);
  if (!Number.isInteger(id) || id < 1 || id > 151) return false;
  markSeen(state, id);
  if (!state.pokedex.captured.includes(id)) {
    state.pokedex.captured.push(id);
    state.pokedex.captured.sort((a, b) => a - b);
    return true;
  }
  return false;
}

export function getPokedexStats(state) {
  ensurePokedexShape(state);
  return {
    seenCount: state.pokedex.seen.length,
    capturedCount: state.pokedex.captured.length,
  };
}

/**
 * Añade un Pokémon al equipo activo (máx. 6) o a la Caja del PC y actualiza Pokédex.
 */
export function addPokemonToPartyOrBox(state, mon) {
  if (!Array.isArray(state.party)) state.party = [];
  if (!Array.isArray(state.pcBox)) state.pcBox = [];
  if (mon.speciesId) markCaptured(state, mon.speciesId);

  if (state.party.length < 6) {
    state.party.push(mon);
    return { destination: "party", index: state.party.length - 1, pokemon: mon };
  }
  state.pcBox.push(mon);
  return { destination: "pcBox", index: state.pcBox.length - 1, pokemon: mon };
}

export function reorderParty(state, fromIndex, toIndex) {
  if (!Array.isArray(state.party)) return false;
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= state.party.length ||
    toIndex >= state.party.length ||
    fromIndex === toIndex
  ) {
    return false;
  }
  const [moved] = state.party.splice(fromIndex, 1);
  state.party.splice(toIndex, 0, moved);
  return true;
}

export function swapPartyAndBox(state, partyIndex, boxIndex) {
  if (!Array.isArray(state.party) || !Array.isArray(state.pcBox)) return { ok: false, message: "Estado inválido." };
  if (boxIndex < 0 || boxIndex >= state.pcBox.length) {
    return { ok: false, message: "Espacio vacío en la Caja del PC." };
  }
  if (partyIndex === null || partyIndex === undefined) {
    if (state.party.length >= 6) {
      return { ok: false, message: "El equipo ya tiene 6 Pokémon; elige uno para intercambiar." };
    }
    const [mon] = state.pcBox.splice(boxIndex, 1);
    state.party.push(mon);
    return { ok: true, message: `${mon.name} pasó de la Caja a tu equipo.` };
  }
  if (partyIndex < 0 || partyIndex >= state.party.length) {
    return { ok: false, message: "Pokémon del equipo inválido." };
  }
  const partyMon = state.party[partyIndex];
  const boxMon = state.pcBox[boxIndex];
  state.party[partyIndex] = boxMon;
  state.pcBox[boxIndex] = partyMon;
  return { ok: true, message: `${boxMon.name} entró al equipo en lugar de ${partyMon.name}.` };
}

export function depositPartyPokemonToBox(state, partyIndex) {
  if (!Array.isArray(state.party) || state.party.length <= 1) {
    return { ok: false, message: "Debes llevar al menos un Pokémon contigo." };
  }
  if (partyIndex < 0 || partyIndex >= state.party.length) {
    return { ok: false, message: "Pokémon no encontrado." };
  }
  const [mon] = state.party.splice(partyIndex, 1);
  if (!Array.isArray(state.pcBox)) state.pcBox = [];
  state.pcBox.push(mon);
  return { ok: true, message: `${mon.name} fue depositado en la Caja del PC.` };
}

export function healPokemonFull(mon, movesMap = {}) {
  if (!mon) return;
  mon.currentHp = mon.maxHp || mon.stats?.hp || 1;
  mon.status = null;
  mon.sleepTurns = 0;
  mon.toxicCounter = 1;
  mon.confused = false;
  mon.confusionTurns = 0;
  mon.flinched = false;
  mon.focusEnergy = false;
  mon.foresight = false;
  mon.statStages = createEmptyStatStages();
  for (const mv of mon.moves || []) {
    const baseMove = movesMap[mv.key];
    const maxPp = mv.maxPp ?? baseMove?.pp ?? mv.pp ?? 10;
    mv.maxPp = maxPp;
    mv.currentPp = maxPp;
  }
}

export function healPartyFull(state, movesMap = {}) {
  for (const mon of state?.party || []) {
    healPokemonFull(mon, movesMap);
  }
}

/**
 * Devuelve una descripción legible en español del método evolutivo de una especie.
 */
export function formatEvolutionGuide(speciesKeyOrId, evolutionsByKey = {}, evolutionsById = {}, speciesByKey = {}) {
  const entry =
    typeof speciesKeyOrId === "number"
      ? evolutionsById[speciesKeyOrId]
      : evolutionsByKey[speciesKeyOrId];
  if (!entry || !Array.isArray(entry.evolutions) || entry.evolutions.length === 0) {
    return "Especie final (sin más evoluciones en Kanto).";
  }

  return entry.evolutions
    .map((ev) => {
      const targetName = speciesByKey[ev.targetSpeciesKey]?.name || ev.targetSpeciesName;
      if (ev.method === "EVO_LEVEL") {
        return `Evoluciona a **${targetName}** al Nivel ${ev.level}`;
      }
      if (ev.method === "EVO_ITEM") {
        const normItem = normalizeItemKey(ev.item || ev.param);
        const itemLabel = ITEM_LABELS_ES[normItem] || ev.itemName || normItem;
        if (normItem === "LINKING_CORD") {
          return `Evoluciona a **${targetName}** usando **${itemLabel}** (sin intercambio)`;
        }
        return `Evoluciona a **${targetName}** usando **${itemLabel}**`;
      }
      if (ev.method === "EVO_FRIENDSHIP" || ev.method === "EVO_HIGH_FRIENDSHIP") {
        return `Evoluciona a **${targetName}** por amistad`;
      }
      return `Evoluciona a **${targetName}** (${ev.method})`;
    })
    .join(" / ");
}

export function getAvailableEvolutionsForItem(mon, itemKeyOrId, evolutionsByKey = {}) {
  if (!mon) return [];
  const norm = normalizeItemKey(itemKeyOrId);
  const evoEntry = evolutionsByKey[mon.speciesKey];
  if (!evoEntry || !Array.isArray(evoEntry.evolutions)) return [];

  return evoEntry.evolutions.filter(
    (ev) => ev.method === "EVO_ITEM" && normalizeItemKey(ev.item || ev.param) === norm
  );
}

/**
 * Aplica la evolución a un objeto Pokémon manteniendo su identidad, IVs/EVs, EXP y daño relativo.
 */
export function applyEvolutionToPokemon(mon, targetSpeciesKeyOrId, dataMaps) {
  const { speciesMap = {}, movesMap = {} } = dataMaps || {};
  const targetSpecies = speciesMap[targetSpeciesKeyOrId];
  if (!targetSpecies) {
    throw new Error(`Especie destino desconocida: ${targetSpeciesKeyOrId}`);
  }

  const prevName = mon.speciesName || mon.name;
  const hadCustomNickname = Boolean(mon.name && prevName && mon.name !== prevName);

  const ivs = mon.ivs || { hp: 15, attack: 15, defense: 15, speed: 15, spAttack: 15, spDefense: 15 };
  const evs = mon.evs || { hp: 0, attack: 0, defense: 0, speed: 0, spAttack: 0, spDefense: 0 };
  const oldMaxHp = mon.maxHp || mon.stats?.hp || 1;
  const damageTaken = Math.max(0, oldMaxHp - (mon.currentHp ?? oldMaxHp));

  const newStats = calculatePokemonStats(targetSpecies, mon.level, ivs, evs);
  const nextCurrentHp =
    mon.currentHp <= 0 ? 0 : Math.max(1, Math.min(newStats.hp, newStats.hp - damageTaken));

  mon.speciesId = targetSpecies.id;
  mon.speciesKey = targetSpecies.key;
  mon.speciesName = targetSpecies.name;
  if (!hadCustomNickname) {
    mon.name = targetSpecies.name;
  }
  mon.types = [...targetSpecies.types];
  mon.baseStats = { ...targetSpecies.baseStats };
  mon.catchRate = targetSpecies.catchRate;
  mon.safariZoneFleeRate = targetSpecies.safariZoneFleeRate || 0;
  mon.expYield = targetSpecies.expYield;
  mon.growthRate = targetSpecies.growthRate;
  mon.ability = targetSpecies.abilities?.[0] || mon.ability || "NONE";
  mon.stats = newStats;
  mon.maxHp = newStats.hp;
  mon.currentHp = nextCurrentHp;

  // Aprender movimientos nuevos de la forma evolucionada al nivel actual o nivel 1 característicos
  const learnedMoveNames = [];
  for (const lm of targetSpecies.levelUpMoves || []) {
    if (lm.level === mon.level || (lm.level === 1 && !(mon.moves || []).some((m) => m.key === lm.moveKey))) {
      // Para nivel 1 añadimos solo si aún quedan huecos; para el nivel exacto reemplazamos si hay 4
      const knows = (mon.moves || []).some((m) => m.key === lm.moveKey);
      const moveData = movesMap[lm.moveKey];
      if (!knows && moveData) {
        if (lm.level === mon.level || (mon.moves || []).length < 4) {
          const newMove = { ...moveData, currentPp: moveData.pp, maxPp: moveData.pp };
          if (!Array.isArray(mon.moves)) mon.moves = [];
          if (mon.moves.length < 4) {
            mon.moves.push(newMove);
          } else if (lm.level === mon.level) {
            mon.moves.shift();
            mon.moves.push(newMove);
          }
          learnedMoveNames.push(moveData.name);
        }
      }
    }
  }

  return { mon, previousSpeciesName: prevName, targetSpecies, learnedMoveNames };
}

export function evolvePokemonWithItem(state, partyIndex, itemKeyOrId, dataMaps, evolutionsByKey = {}) {
  const mon = state?.party?.[partyIndex];
  if (!mon) {
    return { ok: false, message: "No se encontró ese Pokémon en tu equipo." };
  }
  const norm = normalizeItemKey(itemKeyOrId);
  if (getBagItemCount(state, norm) < 1) {
    return { ok: false, message: `No tienes ${ITEM_LABELS_ES[norm] || norm} en la mochila.` };
  }

  const matches = getAvailableEvolutionsForItem(mon, norm, evolutionsByKey);
  if (matches.length === 0) {
    return {
      ok: false,
      message: `${mon.name} no es compatible con ${ITEM_LABELS_ES[norm] || norm}.`,
    };
  }

  const evo = matches[0];
  consumeBagItem(state, norm, 1);
  const { previousSpeciesName, targetSpecies, learnedMoveNames } = applyEvolutionToPokemon(
    mon,
    evo.targetSpeciesKey,
    dataMaps
  );
  markCaptured(state, targetSpecies.id);

  const moveMsg =
    learnedMoveNames.length > 0 ? ` ¡Aprendió ${learnedMoveNames.join(", ")}!` : "";

  return {
    ok: true,
    evolvedFrom: previousSpeciesName,
    evolvedTo: targetSpecies.name,
    pokemon: mon,
    message: `¡${previousSpeciesName} evolucionó a ${targetSpecies.name} usando ${ITEM_LABELS_ES[norm] || norm}!${moveMsg}`,
  };
}

export function checkAndApplyLevelEvolutions(state, partyIndices, dataMaps, evolutionsByKey = {}) {
  const results = [];
  for (const idx of partyIndices || []) {
    const mon = state?.party?.[idx];
    if (!mon || mon.currentHp <= 0) continue;
    const evoEntry = evolutionsByKey[mon.speciesKey];
    if (!evoEntry || !Array.isArray(evoEntry.evolutions)) continue;

    const match = evoEntry.evolutions.find(
      (ev) => ev.method === "EVO_LEVEL" && Number(ev.level) > 0 && mon.level >= Number(ev.level)
    );
    if (match && dataMaps?.speciesMap?.[match.targetSpeciesKey]) {
      const { previousSpeciesName, targetSpecies } = applyEvolutionToPokemon(
        mon,
        match.targetSpeciesKey,
        dataMaps
      );
      markCaptured(state, targetSpecies.id);
      results.push({
        partyIndex: idx,
        from: previousSpeciesName,
        to: targetSpecies.name,
        message: `¡Qué sorpresa! ¡${previousSpeciesName} evolucionó a ${targetSpecies.name}!`,
      });
    }
  }
  return results;
}

/**
 * Usa cualquier objeto de la mochila fuera de combate (curación, estado, revivir o evolución).
 */
export function useOverworldItem(state, itemKeyOrId, partyIndex, dataMaps, evolutionsByKey = {}) {
  const norm = normalizeItemKey(itemKeyOrId);
  const item = dataMaps?.itemsMap?.[norm] || dataMaps?.itemsMap?.[itemKeyOrId];
  if (!item) {
    return { ok: false, message: "Objeto desconocido." };
  }
  if (getBagItemCount(state, norm) < 1) {
    return { ok: false, message: `No te quedan unidades de ${item.name}.` };
  }
  if (!item.usableInOverworld) {
    return { ok: false, message: `${item.name} solo puede usarse en combate.` };
  }

  if (item.category === "evolution") {
    return evolvePokemonWithItem(state, partyIndex, norm, dataMaps, evolutionsByKey);
  }

  const target = state?.party?.[partyIndex];
  if (!target) {
    return { ok: false, message: "Selecciona un Pokémon válido." };
  }

  if (item.category === "revive") {
    if (target.currentHp > 0) {
      return { ok: false, message: `${target.name} no está debilitado.` };
    }
    consumeBagItem(state, norm, 1);
    const restored = Math.max(1, Math.floor(target.maxHp * (item.healFraction || 0.5)));
    target.currentHp = restored;
    target.status = null;
    target.sleepTurns = 0;
    target.toxicCounter = 1;
    return { ok: true, message: `¡${target.name} fue reanimado con ${restored} PS!` };
  }

  if (target.currentHp <= 0) {
    return { ok: false, message: `${target.name} está debilitado. Usa Revivir o acude al Centro Pokémon.` };
  }

  if (item.category === "healing") {
    const needsHp = target.currentHp < target.maxHp;
    const needsStatus = item.cureStatus === "ALL" && Boolean(target.status);
    if (!needsHp && !needsStatus) {
      return { ok: false, message: `${target.name} no necesita usar ${item.name}.` };
    }
    consumeBagItem(state, norm, 1);
    const before = target.currentHp;
    target.currentHp = item.healHp === "full" ? target.maxHp : Math.min(target.maxHp, target.currentHp + item.healHp);
    if (item.cureStatus === "ALL") {
      target.status = null;
      target.sleepTurns = 0;
      target.toxicCounter = 1;
    }
    return {
      ok: true,
      message: `Usaste ${item.name} en ${target.name} (+${target.currentHp - before} PS).`,
    };
  }

  if (item.category === "status") {
    const matchesPoison =
      item.cureStatus === "POISON" && (target.status === "POISON" || target.status === "BADLY_POISONED");
    const matchesExact = target.status === item.cureStatus;
    if (!matchesPoison && !matchesExact) {
      return { ok: false, message: `${target.name} no padece ese estado.` };
    }
    consumeBagItem(state, norm, 1);
    target.status = null;
    target.sleepTurns = 0;
    target.toxicCounter = 1;
    return { ok: true, message: `¡${target.name} se curó con ${item.name}!` };
  }

  return { ok: false, message: `No se pudo usar ${item.name}.` };
}
