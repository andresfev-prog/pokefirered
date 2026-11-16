/**
 * Dynamic Level Scaler (SPEC_MAESTRA.md §3)
 *
 * Rules:
 * 1. Minimum floor: No rival Pokémon can ever fall below its original baseLevel.
 * 2. Target Level (N_obj): Rounded average of the top 3 highest-level Pokémon
 *    in the player's current party (or all if party has < 3).
 * 3. Gym Leaders ("leader"):
 *    - Ace Pokémon: max(baseLevel, N_obj)
 *    - Other Pokémon: max(baseLevel, N_obj - 2)
 * 4. Route Trainers ("trainer"):
 *    - Every Pokémon: max(baseLevel, N_obj - offset), where offset is 2 or 3 (default 2).
 */

/**
 * Calculates N_obj = rounded average of top 3 highest-level Pokémon in player's party.
 */
export function calculateTargetLevel(playerParty) {
  const levels = (playerParty || [])
    .filter((mon) => mon && typeof mon.level === "number" && mon.level > 0)
    .map((mon) => mon.level)
    .sort((a, b) => b - a);

  if (levels.length === 0) return 5;

  const topCount = Math.min(3, levels.length);
  const topSlice = levels.slice(0, topCount);
  const sum = topSlice.reduce((acc, lvl) => acc + lvl, 0);
  return Math.max(1, Math.min(100, Math.round(sum / topCount)));
}

/**
 * Finds the index of the Gym Leader's ace Pokémon (highest baseLevel; ties go to last Pokémon).
 */
export function findAceIndex(partySpecs) {
  if (!partySpecs || partySpecs.length === 0) return -1;
  let aceIdx = 0;
  let maxBase = partySpecs[0].baseLevel ?? partySpecs[0].level ?? 1;
  for (let i = 1; i < partySpecs.length; i++) {
    const lvl = partySpecs[i].baseLevel ?? partySpecs[i].level ?? 1;
    if (lvl >= maxBase) {
      maxBase = lvl;
      aceIdx = i;
    }
  }
  return aceIdx;
}

/**
 * Scales a rival party specification without dropping any Pokémon below its baseLevel.
 *
 * @param {Array<{baseLevel?: number, level?: number}>} enemyPartySpecs
 * @param {Array<{level: number}>} playerParty
 * @param {"wild"|"trainer"|"leader"} battleType
 * @param {{ trainerOffset?: 2|3 }} options
 * @returns {Array<object>} New array with `baseLevel` and `scaledLevel` fields.
 */
export function scalePartyLevels(enemyPartySpecs, playerParty, battleType = "trainer", options = {}) {
  const specs = (enemyPartySpecs || []).map((entry) => ({
    ...entry,
    baseLevel: entry.baseLevel ?? entry.level ?? 5,
  }));

  if (battleType === "wild") {
    return specs.map((entry) => ({
      ...entry,
      targetLevel: entry.baseLevel,
      scaledLevel: entry.baseLevel,
      isAce: false,
    }));
  }

  const targetLevel = calculateTargetLevel(playerParty);
  const trainerOffset = options.trainerOffset === 3 ? 3 : 2;
  const aceIdx = battleType === "leader" ? findAceIndex(specs) : -1;

  return specs.map((entry, idx) => {
    const base = entry.baseLevel;
    let computed;
    if (battleType === "leader") {
      computed = idx === aceIdx ? targetLevel : targetLevel - 2;
    } else {
      computed = targetLevel - trainerOffset;
    }

    const scaledLevel = Math.max(base, Math.min(100, computed));
    return {
      ...entry,
      targetLevel,
      scaledLevel,
      isAce: idx === aceIdx,
    };
  });
}

/**
 * Scales trainer prize money dynamically with the rival's highest scaled level
 * (SPEC_MAESTRA.md §4).
 */
export function calculateTrainerReward(scaledParty, basePayoutRate = 40) {
  if (!scaledParty || scaledParty.length === 0) return 0;
  const highestLevel = Math.max(...scaledParty.map((m) => m.scaledLevel ?? m.level ?? 1));
  return highestLevel * basePayoutRate;
}
