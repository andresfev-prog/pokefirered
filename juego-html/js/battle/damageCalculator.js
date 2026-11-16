/**
 * Gen 3 Damage, Stat, Experience, and Type Effectiveness Calculator
 * Based directly on pret/pokefirered (src/pokemon.c, src/battle_script_commands.c, src/data/pokemon/experience_tables.h).
 */

export const PHYSICAL_TYPES = new Set([
  "NORMAL",
  "FIGHTING",
  "FLYING",
  "POISON",
  "GROUND",
  "ROCK",
  "BUG",
  "GHOST",
  "STEEL",
]);

export const SPECIAL_TYPES = new Set([
  "FIRE",
  "WATER",
  "GRASS",
  "ELECTRIC",
  "PSYCHIC",
  "ICE",
  "DRAGON",
  "DARK",
]);

// gStatStageRatios from src/pokemon.c (index = stage + 6, range -6..+6)
export const STAT_STAGE_RATIOS = [
  [10, 40], // -6
  [10, 35], // -5
  [10, 30], // -4
  [10, 25], // -3
  [10, 20], // -2
  [10, 15], // -1
  [10, 10], //  0
  [15, 10], // +1
  [20, 10], // +2
  [25, 10], // +3
  [30, 10], // +4
  [35, 10], // +5
  [40, 10], // +6
];

// sCriticalHitChance from src/battle_script_commands.c: 1/16, 1/8, 1/4, 1/3, 1/2
export const CRIT_CHANCE_DENOMINATORS = [16, 8, 4, 3, 2];

const HIGH_CRIT_EFFECTS = new Set([
  "EFFECT_HIGH_CRITICAL",
  "EFFECT_SKY_ATTACK",
  "EFFECT_BLAZE_KICK",
  "EFFECT_POISON_TAIL",
  "EFFECT_RAZOR_WIND",
]);

/**
 * Gen 3 physical/special split is determined strictly by move type when power > 0.
 */
export function getMoveCategory(move) {
  if (!move || !move.power || move.power === 0) {
    return "status";
  }
  if (PHYSICAL_TYPES.has(move.type)) return "physical";
  if (SPECIAL_TYPES.has(move.type)) return "special";
  return "status";
}

export function clampStage(stage) {
  return Math.max(-6, Math.min(6, stage || 0));
}

export function calculateStatWithStage(statValue, stage) {
  const idx = clampStage(stage) + 6;
  const [num, den] = STAT_STAGE_RATIOS[idx];
  return Math.max(1, Math.floor((statValue * num) / den));
}

/**
 * Official Gen 3 stat formula (src/pokemon.c: CalculateMonStats).
 */
export function calculatePokemonStats(species, level, ivs = {}, evs = {}) {
  const lvl = Math.max(1, Math.min(100, level));
  const bs = species.baseStats;

  const getIv = (k) => (typeof ivs[k] === "number" ? ivs[k] : 15);
  const getEv = (k) => (typeof evs[k] === "number" ? evs[k] : 0);

  const hp =
    Math.floor(((2 * bs.hp + getIv("hp") + Math.floor(getEv("hp") / 4)) * lvl) / 100) +
    lvl +
    10;

  const calcOther = (base, key) =>
    Math.floor(((2 * base + getIv(key) + Math.floor(getEv(key) / 4)) * lvl) / 100) + 5;

  return {
    hp,
    attack: calcOther(bs.attack, "attack"),
    defense: calcOther(bs.defense, "defense"),
    speed: calcOther(bs.speed, "speed"),
    spAttack: calcOther(bs.spAttack, "spAttack"),
    spDefense: calcOther(bs.spDefense, "spDefense"),
  };
}

/**
 * Official Gen 3 experience table formulas (src/data/pokemon/experience_tables.h).
 */
export function getExpForLevel(growthRate, level) {
  const n = Math.max(1, Math.min(100, level));
  if (n <= 1) return 0;

  const sq = n * n;
  const cu = n * n * n;

  switch (growthRate) {
    case "MEDIUM_FAST":
      return cu;
    case "FAST":
      return Math.floor((4 * cu) / 5);
    case "SLOW":
      return Math.floor((5 * cu) / 4);
    case "MEDIUM_SLOW":
      return Math.max(
        0,
        Math.floor((6 * cu) / 5) - 15 * sq + 100 * n - 140
      );
    case "ERRATIC":
      if (n <= 50) return Math.floor(((100 - n) * cu) / 50);
      if (n <= 68) return Math.floor(((150 - n) * cu) / 100);
      if (n <= 98) return Math.floor((Math.floor((1911 - 10 * n) / 3) * cu) / 500);
      return Math.floor(((160 - n) * cu) / 100);
    case "FLUCTUATING":
      if (n <= 15) return Math.floor(((Math.floor((n + 1) / 3) + 24) * cu) / 50);
      if (n <= 36) return Math.floor(((n + 14) * cu) / 50);
      return Math.floor(((Math.floor(n / 2) + 32) * cu) / 50);
    default:
      return cu;
  }
}

export function getLevelFromExp(growthRate, exp) {
  let lvl = 1;
  for (let candidate = 2; candidate <= 100; candidate++) {
    if (exp >= getExpForLevel(growthRate, candidate)) {
      lvl = candidate;
    } else {
      break;
    }
  }
  return lvl;
}

/**
 * Computes combined type effectiveness multiplier (0, 0.25, 0.5, 1, 2, 4)
 * from game data's type_chart.json.
 */
export function getTypeEffectiveness(moveType, defenderTypes, typeChart, options = {}) {
  if (!moveType || moveType === "MYSTERY" || options.ignoreTypeChart) {
    return 1;
  }

  if (options.defenderAbility === "LEVITATE" && moveType === "GROUND") {
    return 0;
  }

  const row = typeChart?.effectiveness?.[moveType];
  if (!row) return 1;

  const uniqueTypes = [];
  for (const t of defenderTypes || []) {
    if (t && !uniqueTypes.includes(t)) uniqueTypes.push(t);
  }

  let multiplier = 1;
  for (const defType of uniqueTypes) {
    let single = typeof row[defType] === "number" ? row[defType] : 1;
    if (
      options.foresight &&
      single === 0 &&
      defType === "GHOST" &&
      (moveType === "NORMAL" || moveType === "FIGHTING")
    ) {
      single = 1;
    }
    multiplier *= single;
  }
  return multiplier;
}

export function getCritStage(attacker, move) {
  let stage = 0;
  if (attacker.focusEnergy) stage += 2;
  if (move && HIGH_CRIT_EFFECTS.has(move.effect)) stage += 1;
  return Math.min(CRIT_CHANCE_DENOMINATORS.length - 1, stage);
}

export function rollCriticalHit(attacker, defender, move, rng = Math.random) {
  if (defender.ability === "BATTLE_ARMOR" || defender.ability === "SHELL_ARMOR") {
    return false;
  }
  const stage = getCritStage(attacker, move);
  const denom = CRIT_CHANCE_DENOMINATORS[stage];
  return Math.floor(rng() * denom) === 0;
}

/**
 * Official Gen 3 Damage Formula (src/pokemon.c CalculateBaseDamage + Cmd_damagecalc + Cmd_typecalc + ApplyRandomDmgMultiplier).
 */
export function calculateDamage(attacker, defender, move, typeChart, options = {}) {
  const category = getMoveCategory(move);
  const moveType = options.typeOverride || move.type;

  if (category === "status" || !move.power || move.power === 0) {
    return {
      damage: 0,
      baseDamage: 0,
      isCrit: false,
      effectiveness: 1,
      stab: false,
      category: "status",
      randomFactor: 1,
    };
  }

  const isStruggle = move.key === "STRUGGLE";
  const effectiveness = isStruggle
    ? 1
    : getTypeEffectiveness(moveType, defender.types, typeChart, {
        foresight: Boolean(defender.foresight || options.foresight),
        defenderAbility: defender.ability,
      });

  if (effectiveness === 0) {
    return {
      damage: 0,
      baseDamage: 0,
      isCrit: false,
      effectiveness: 0,
      stab: false,
      category,
      randomFactor: 1,
    };
  }

  // Fixed / level / HP-fraction moves
  if (move.effect === "EFFECT_DRAGON_RAGE") {
    return { damage: 40, baseDamage: 40, isCrit: false, effectiveness, stab: false, category, randomFactor: 1 };
  }
  if (move.effect === "EFFECT_SONICBOOM") {
    return { damage: 20, baseDamage: 20, isCrit: false, effectiveness, stab: false, category, randomFactor: 1 };
  }
  if (move.effect === "EFFECT_LEVEL_DAMAGE") {
    return {
      damage: Math.max(1, attacker.level),
      baseDamage: attacker.level,
      isCrit: false,
      effectiveness,
      stab: false,
      category,
      randomFactor: 1,
    };
  }
  if (move.effect === "EFFECT_SUPER_FANG") {
    const half = Math.max(1, Math.floor(defender.currentHp / 2));
    return { damage: half, baseDamage: half, isCrit: false, effectiveness, stab: false, category, randomFactor: 1 };
  }
  if (move.effect === "EFFECT_OHKO") {
    return {
      damage: defender.currentHp,
      baseDamage: defender.currentHp,
      isCrit: false,
      effectiveness,
      stab: false,
      category,
      randomFactor: 1,
    };
  }

  const rng = options.rng || Math.random;
  const isCrit =
    typeof options.isCrit === "boolean"
      ? options.isCrit
      : rollCriticalHit(attacker, defender, move, rng);

  let power = options.powerOverride || move.power;
  if (power === 1) {
    // Variable power moves fallback (e.g. Low Kick, Return, Magnitude, Hidden Power)
    if (move.effect === "EFFECT_RETURN" || move.effect === "EFFECT_FRUSTRATION") power = 85;
    else if (move.effect === "EFFECT_HIDDEN_POWER") power = 60;
    else if (move.effect === "EFFECT_LOW_KICK") power = 60;
    else if (move.effect === "EFFECT_MAGNITUDE") power = 70;
    else if (move.effect === "EFFECT_FLAIL") power = 60;
    else power = 50;
  }

  // Ability pinch boosts (Overgrow, Blaze, Torrent, Swarm)
  if (
    (moveType === "GRASS" && attacker.ability === "OVERGROW" && attacker.currentHp <= Math.floor(attacker.maxHp / 3)) ||
    (moveType === "FIRE" && attacker.ability === "BLAZE" && attacker.currentHp <= Math.floor(attacker.maxHp / 3)) ||
    (moveType === "WATER" && attacker.ability === "TORRENT" && attacker.currentHp <= Math.floor(attacker.maxHp / 3)) ||
    (moveType === "BUG" && attacker.ability === "SWARM" && attacker.currentHp <= Math.floor(attacker.maxHp / 3))
  ) {
    power = Math.floor((150 * power) / 100);
  }

  const atkKey = category === "physical" ? "attack" : "spAttack";
  const defKey = category === "physical" ? "defense" : "spDefense";

  let rawAtk = attacker.stats[atkKey];
  let rawDef = defender.stats[defKey];

  if (category === "physical" && (attacker.ability === "HUGE_POWER" || attacker.ability === "PURE_POWER")) {
    rawAtk *= 2;
  }
  if (category === "physical" && attacker.ability === "HUSTLE") {
    rawAtk = Math.floor((150 * rawAtk) / 100);
  }
  if (category === "physical" && attacker.ability === "GUTS" && attacker.status) {
    rawAtk = Math.floor((150 * rawAtk) / 100);
  }
  if (category === "physical" && defender.ability === "MARVEL_SCALE" && defender.status) {
    rawDef = Math.floor((150 * rawDef) / 100);
  }
  if (defender.ability === "THICK_FAT" && (moveType === "FIRE" || moveType === "ICE")) {
    rawAtk = Math.floor(rawAtk / 2);
  }
  if (move.effect === "EFFECT_EXPLOSION" && category === "physical") {
    rawDef = Math.max(1, Math.floor(rawDef / 2));
  }

  const atkStageRaw = attacker.statStages?.[atkKey] || 0;
  const defStageRaw = defender.statStages?.[defKey] || 0;

  // Gen 3 critical hits ignore negative attack stages and positive defense stages
  const atkStage = isCrit && atkStageRaw < 0 ? 0 : atkStageRaw;
  const defStage = isCrit && defStageRaw > 0 ? 0 : defStageRaw;

  const atkStat = calculateStatWithStage(rawAtk, atkStage);
  const defStat = calculateStatWithStage(rawDef, defStage);

  let baseDamage = Math.floor(
    Math.floor(((Math.floor((2 * attacker.level) / 5) + 2) * power * atkStat) / Math.max(1, defStat)) / 50
  );

  // Burn halves physical damage in Gen 3 (unless Guts)
  if (category === "physical" && attacker.status === "BURN" && attacker.ability !== "GUTS") {
    baseDamage = Math.floor(baseDamage / 2);
  }

  // Reflect / Light Screen (ignored on critical hits)
  if (!isCrit) {
    if (category === "physical" && options.reflectActive) {
      baseDamage = Math.floor(baseDamage / 2);
    }
    if (category === "special" && options.lightScreenActive) {
      baseDamage = Math.floor(baseDamage / 2);
    }
  }

  if (baseDamage === 0) baseDamage = 1;

  // Weather modifiers
  if (options.weather === "SUN") {
    if (moveType === "FIRE") baseDamage = Math.floor((15 * baseDamage) / 10);
    if (moveType === "WATER") baseDamage = Math.floor(baseDamage / 2);
  } else if (options.weather === "RAIN") {
    if (moveType === "WATER") baseDamage = Math.floor((15 * baseDamage) / 10);
    if (moveType === "FIRE") baseDamage = Math.floor(baseDamage / 2);
  }

  baseDamage += 2;

  let damage = isCrit ? baseDamage * 2 : baseDamage;

  // STAB (×1.5)
  const stab = !isStruggle && Array.isArray(attacker.types) && attacker.types.includes(moveType);
  if (stab) {
    damage = Math.floor((damage * 15) / 10);
  }

  // Apply type effectiveness sequentially per unique defender type (matching ModulateDmgByType)
  if (!isStruggle) {
    const row = typeChart?.effectiveness?.[moveType] || {};
    const seen = new Set();
    for (const defType of defender.types || []) {
      if (!defType || seen.has(defType)) continue;
      seen.add(defType);
      let single = typeof row[defType] === "number" ? row[defType] : 1;
      if (options.foresight && single === 0 && defType === "GHOST" && (moveType === "NORMAL" || moveType === "FIGHTING")) {
        single = 1;
      }
      if (single !== 1) {
        damage = Math.floor((damage * Math.round(single * 10)) / 10);
        if (damage === 0) damage = 1;
      }
    }
  }

  // Random factor (85..100%)
  let randPercent;
  if (typeof options.randomFactor === "number") {
    randPercent = Math.max(85, Math.min(100, Math.round(options.randomFactor * 100)));
  } else {
    randPercent = 100 - Math.floor(rng() * 16);
  }

  damage = Math.floor((damage * randPercent) / 100);
  if (damage < 1) damage = 1;

  return {
    damage,
    baseDamage,
    isCrit,
    effectiveness,
    stab,
    category,
    randomFactor: randPercent / 100,
  };
}
