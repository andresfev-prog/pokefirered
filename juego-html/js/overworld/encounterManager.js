/**
 * Gestor de Encuentros Salvajes con Filtro Horario (Día / Tarde / Noche)
 * Reglas según SPEC_MAESTRA §8.1:
 *  - Día (06:00–16:59): permite especies "diurnal" y "any" en exteriores.
 *  - Tarde (17:00–19:59): crepúsculo; permite transición ("diurnal", "nocturnal" y "any").
 *  - Noche (20:00–05:59): permite especies "nocturnal" y "any" en exteriores.
 *  - En cuevas e interiores cerrados (environment === "cave"), el horario NO filtra especies.
 */

export const TIME_PERIOD_DEFS = {
  day: {
    key: "day",
    label: "Día (06:00–16:59)",
    shortLabel: "Día",
    icon: "☀️",
    allowedActivities: ["diurnal", "any"],
  },
  evening: {
    key: "evening",
    label: "Tarde (17:00–19:59)",
    shortLabel: "Tarde",
    icon: "🌇",
    allowedActivities: ["diurnal", "nocturnal", "any"],
  },
  night: {
    key: "night",
    label: "Noche (20:00–05:59)",
    shortLabel: "Noche",
    icon: "🌙",
    allowedActivities: ["nocturnal", "any"],
  },
};

export function detectTimeOfDay(date = new Date()) {
  const hour = date instanceof Date ? date.getHours() : Number(date);
  if (hour >= 6 && hour <= 16) return { ...TIME_PERIOD_DEFS.day };
  if (hour >= 17 && hour <= 19) return { ...TIME_PERIOD_DEFS.evening };
  return { ...TIME_PERIOD_DEFS.night };
}

export function getAllowedActivityPeriods(timeKey) {
  const def = TIME_PERIOD_DEFS[timeKey] || TIME_PERIOD_DEFS.day;
  return [...def.allowedActivities];
}

export function resolveEncounterMethod(tileCollision, methodOverride = null) {
  if (methodOverride) return methodOverride;
  if (tileCollision === 2) return "land";
  if (tileCollision === 3) return "water";
  return null;
}

/**
 * Calcula la tasa de huida efectiva en Zona Safari considerando el premio de la Carrera Safari.
 * SPEC_MAESTRA §8.3: Reduce a la mitad la tasa de huida tras ganar la Carrera de la Zona Safari.
 */
export function getEffectiveSafariFleeRate(species, safariRaceWon = false) {
  const baseFlee = species?.safariZoneFleeRate || 0;
  if (!safariRaceWon || baseFlee <= 0) return baseFlee;
  return Math.max(1, Math.floor(baseFlee * 0.5));
}

/**
 * Filtra la tabla de encuentros de una zona según entorno (outdoor vs cave) y horario.
 * Si safariRaceWon === true y es Zona Safari, aumenta el peso relativo de especies raras (rate <= 10).
 */
export function filterEncountersByTimeAndEnv({
  zone,
  method = "land",
  speciesByKey = {},
  timeKey = "day",
  mapEnvironment = null,
  safariRaceWon = false,
}) {
  if (!zone || !zone.methods || !zone.methods[method]) {
    return {
      environment: mapEnvironment || zone?.environment || "outdoor",
      ignoresTime: false,
      safariBoostApplied: false,
      rawCount: 0,
      entries: [],
    };
  }

  const env = mapEnvironment || zone.environment || "outdoor";
  const ignoresTime = env === "cave";
  const allowed = new Set(getAllowedActivityPeriods(timeKey));
  const rawList = zone.methods[method].encounters || [];
  const applySafariBoost = Boolean(safariRaceWon && zone.isSafariZone);

  const filtered = [];
  for (const slot of rawList) {
    const sp = speciesByKey[slot.speciesKey];
    const activityPeriod = sp?.activityPeriod || "any";
    if (ignoresTime || allowed.has(activityPeriod)) {
      const baseWeight = slot.rate || 0;
      const isRareSlot = baseWeight <= 10;
      const effectiveWeight = applySafariBoost && isRareSlot ? baseWeight * 1.8 : baseWeight;
      filtered.push({
        ...slot,
        activityPeriod,
        species: sp || null,
        weight: effectiveWeight,
        rareBoosted: Boolean(applySafariBoost && isRareSlot),
      });
    }
  }

  const totalWeight = filtered.reduce((acc, s) => acc + (s.weight || 0), 0);
  const normalized = filtered.map((s) => ({
    ...s,
    effectiveChance: totalWeight > 0 ? Math.round(((s.weight || 0) / totalWeight) * 1000) / 10 : 0,
  }));

  return {
    environment: env,
    ignoresTime,
    safariBoostApplied: applySafariBoost,
    rawCount: rawList.length,
    entries: normalized,
  };
}

/**
 * Evalúa si ocurre un encuentro salvaje al pisar un tile de hierba/cueva/agua
 * y devuelve la especie + nivel + metadatos del combate a iniciar.
 */
export function rollWildEncounter({
  map,
  tileCollision,
  methodOverride = null,
  timeKey = "day",
  wildZonesByMapId = {},
  speciesByKey = {},
  safariRaceWon = false,
  forceTrigger = false,
  rng = Math.random,
}) {
  const method = resolveEncounterMethod(tileCollision, methodOverride);
  if (!method || !map) return null;

  const zone = wildZonesByMapId[map.id];
  if (!zone || !zone.methods || !zone.methods[method]) return null;

  const methodData = zone.methods[method];
  const baseRate = methodData.encounterRate || 15;
  const isSafari = Boolean(zone.isSafariZone);

  if (!forceTrigger) {
    // Probabilidad equilibrada por paso (aumenta ligeramente en Zona Safari si ganó la Carrera Safari)
    let stepChance = Math.min(0.22, Math.max(0.09, baseRate / 150));
    if (isSafari && safariRaceWon) {
      stepChance = Math.min(0.28, stepChance * 1.25);
    }
    if (rng() >= stepChance) {
      return null;
    }
  }

  const result = filterEncountersByTimeAndEnv({
    zone,
    method,
    speciesByKey,
    timeKey,
    mapEnvironment: map.environment,
    safariRaceWon,
  });

  if (result.entries.length === 0) {
    return null;
  }

  const totalWeight = result.entries.reduce((sum, item) => sum + (item.weight || item.rate || 1), 0);
  let pick = rng() * totalWeight;
  let chosen = result.entries[result.entries.length - 1];
  for (const entry of result.entries) {
    pick -= entry.weight || entry.rate || 1;
    if (pick <= 0) {
      chosen = entry;
      break;
    }
  }

  const minLv = chosen.minLevel || 2;
  const maxLv = Math.max(minLv, chosen.maxLevel || minLv);
  const level = minLv + Math.floor(rng() * (maxLv - minLv + 1));
  const species = speciesByKey[chosen.speciesKey] || chosen.species;
  if (!species) return null;

  return {
    mapId: map.id,
    mapName: map.displayName || map.name,
    environment: result.environment,
    ignoresTime: result.ignoresTime,
    isSafariZone: isSafari,
    safariBoostApplied: result.safariBoostApplied,
    effectiveSafariFleeRate: getEffectiveSafariFleeRate(species, safariRaceWon),
    timeKey,
    method,
    zone,
    species,
    level,
    filteredEntries: result.entries,
  };
}
