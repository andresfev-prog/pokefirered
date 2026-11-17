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
 * Filtra la tabla de encuentros de una zona según entorno (outdoor vs cave) y horario.
 */
export function filterEncountersByTimeAndEnv({
  zone,
  method = "land",
  speciesByKey = {},
  timeKey = "day",
  mapEnvironment = null,
}) {
  if (!zone || !zone.methods || !zone.methods[method]) {
    return {
      environment: mapEnvironment || zone?.environment || "outdoor",
      ignoresTime: false,
      rawCount: 0,
      entries: [],
    };
  }

  const env = mapEnvironment || zone.environment || "outdoor";
  const ignoresTime = env === "cave";
  const allowed = new Set(getAllowedActivityPeriods(timeKey));
  const rawList = zone.methods[method].encounters || [];

  const filtered = [];
  for (const slot of rawList) {
    const sp = speciesByKey[slot.speciesKey];
    const activityPeriod = sp?.activityPeriod || "any";
    if (ignoresTime || allowed.has(activityPeriod)) {
      filtered.push({
        ...slot,
        activityPeriod,
        species: sp || null,
      });
    }
  }

  const totalRate = filtered.reduce((acc, s) => acc + (s.rate || 0), 0);
  const normalized = filtered.map((s) => ({
    ...s,
    effectiveChance: totalRate > 0 ? Math.round(((s.rate || 0) / totalRate) * 1000) / 10 : 0,
  }));

  return {
    environment: env,
    ignoresTime,
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
  forceTrigger = false,
  rng = Math.random,
}) {
  const method = resolveEncounterMethod(tileCollision, methodOverride);
  if (!method || !map) return null;

  const zone = wildZonesByMapId[map.id];
  if (!zone || !zone.methods || !zone.methods[method]) return null;

  const methodData = zone.methods[method];
  const baseRate = methodData.encounterRate || 15;

  if (!forceTrigger) {
    // Probabilidad equilibrada por paso (aprox 9%–20% según la densidad del mapa)
    const stepChance = Math.min(0.22, Math.max(0.09, baseRate / 150));
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
  });

  if (result.entries.length === 0) {
    return null;
  }

  const totalWeight = result.entries.reduce((sum, item) => sum + (item.rate || 1), 0);
  let pick = rng() * totalWeight;
  let chosen = result.entries[result.entries.length - 1];
  for (const entry of result.entries) {
    pick -= entry.rate || 1;
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
    timeKey,
    method,
    zone,
    species,
    level,
    filteredEntries: result.entries,
  };
}
