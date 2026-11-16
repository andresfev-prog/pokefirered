/**
 * Battle AI Module
 * - Wild Pokémon: picks randomly among moves with PP > 0 (or Struggle).
 * - Trainers & Gym Leaders: tactical scoring prioritizing super-effective moves,
 *   lethal KOs, avoiding immunities, and sensible status/stat-boost usage.
 */

import { calculateDamage, getMoveCategory, getTypeEffectiveness } from "./damageCalculator.js";

const STATUS_INDUCING_EFFECTS = new Set([
  "EFFECT_SLEEP",
  "EFFECT_PARALYZE",
  "EFFECT_TOXIC",
  "EFFECT_POISON",
  "EFFECT_WILL_O_WISP",
  "EFFECT_CONFUSE",
]);

const STAT_BUFF_EFFECTS = new Set([
  "EFFECT_ATTACK_UP",
  "EFFECT_ATTACK_UP_2",
  "EFFECT_DEFENSE_UP",
  "EFFECT_DEFENSE_UP_2",
  "EFFECT_SPEED_UP",
  "EFFECT_SPEED_UP_2",
  "EFFECT_SPECIAL_ATTACK_UP",
  "EFFECT_SPECIAL_ATTACK_UP_2",
  "EFFECT_SPECIAL_DEFENSE_UP",
  "EFFECT_SPECIAL_DEFENSE_UP_2",
  "EFFECT_EVASION_UP",
  "EFFECT_COSMIC_POWER",
  "EFFECT_BULK_UP",
  "EFFECT_CALM_MIND",
  "EFFECT_DRAGON_DANCE",
  "EFFECT_DEFENSE_CURL",
]);

const STAT_DEBUFF_EFFECTS = new Set([
  "EFFECT_ATTACK_DOWN",
  "EFFECT_ATTACK_DOWN_2",
  "EFFECT_DEFENSE_DOWN",
  "EFFECT_DEFENSE_DOWN_2",
  "EFFECT_SPEED_DOWN",
  "EFFECT_SPEED_DOWN_2",
  "EFFECT_ACCURACY_DOWN",
  "EFFECT_EVASION_DOWN",
  "EFFECT_TICKLE",
]);

const HEAL_EFFECTS = new Set([
  "EFFECT_RESTORE_HP",
  "EFFECT_SOFTBOILED",
  "EFFECT_REST",
  "EFFECT_MORNING_SUN",
  "EFFECT_SYNTHESIS",
  "EFFECT_MOONLIGHT",
]);

export function chooseWildAction(attacker, rng = Math.random) {
  const usableIndices = [];
  for (let i = 0; i < attacker.moves.length; i++) {
    if (attacker.moves[i].currentPp > 0) {
      usableIndices.push(i);
    }
  }

  if (usableIndices.length === 0) {
    return { type: "move", moveIndex: -1, struggle: true };
  }

  const pick = usableIndices[Math.floor(rng() * usableIndices.length)];
  return { type: "move", moveIndex: pick, struggle: false };
}

export function scoreMoveForAI(attacker, defender, move, typeChart, options = {}) {
  const category = getMoveCategory(move);
  const rng = options.rng || Math.random;

  if (category === "status" || !move.power || move.power === 0) {
    // Status / Utility moves
    if (STATUS_INDUCING_EFFECTS.has(move.effect)) {
      if (move.effect === "EFFECT_CONFUSE") {
        if (defender.confused) return -250;
        return 45 + rng() * 10;
      }
      if (defender.status) return -300;
      const hpRatio = defender.currentHp / Math.max(1, defender.maxHp);
      // Avoid putting status on almost-KO'd foe when we could just attack
      return (hpRatio > 0.35 ? 80 : 15) + rng() * 10;
    }

    if (HEAL_EFFECTS.has(move.effect)) {
      const myHpRatio = attacker.currentHp / Math.max(1, attacker.maxHp);
      if (myHpRatio < 0.4) return 150 + rng() * 10;
      if (myHpRatio < 0.65) return 55 + rng() * 10;
      return -250;
    }

    if (STAT_BUFF_EFFECTS.has(move.effect)) {
      const myHpRatio = attacker.currentHp / Math.max(1, attacker.maxHp);
      if (myHpRatio < 0.45) return -120;
      const atkStage = attacker.statStages?.attack || 0;
      const defStage = attacker.statStages?.defense || 0;
      if (atkStage >= 3 || defStage >= 3) return -150;
      return 60 + rng() * 10;
    }

    if (STAT_DEBUFF_EFFECTS.has(move.effect)) {
      const hpRatio = defender.currentHp / Math.max(1, defender.maxHp);
      if (hpRatio < 0.4) return -120;
      return 35 + rng() * 10;
    }

    return 10 + rng() * 8;
  }

  // Damaging moves
  const effectiveness = getTypeEffectiveness(move.type, defender.types, typeChart, {
    foresight: Boolean(defender.foresight),
    defenderAbility: defender.ability,
  });

  if (effectiveness === 0) {
    return -9999;
  }

  const preview = calculateDamage(attacker, defender, move, typeChart, {
    isCrit: false,
    randomFactor: 0.925,
    reflectActive: options.reflectActive,
    lightScreenActive: options.lightScreenActive,
    foresight: Boolean(defender.foresight),
  });

  const expectedDmg = preview.damage;
  let score = Math.min(200, (expectedDmg / Math.max(1, defender.maxHp)) * 180);

  // Lethal KO bonus
  if (expectedDmg >= defender.currentHp) {
    score += 450;
  }

  // Effectiveness weighting
  if (effectiveness >= 4) score += 160;
  else if (effectiveness >= 2) score += 105;
  else if (effectiveness <= 0.25) score -= 90;
  else if (effectiveness < 1) score -= 50;

  // Accuracy adjustment (0 accuracy = never misses in Gen 3)
  const accFactor = move.accuracy === 0 ? 1.05 : move.accuracy / 100;
  score *= accFactor;

  // Discourage self-destruct unless low HP
  if (move.effect === "EFFECT_EXPLOSION") {
    const myHpRatio = attacker.currentHp / Math.max(1, attacker.maxHp);
    if (myHpRatio > 0.35) score -= 180;
  }

  // Slight tie-breaker randomness
  return score + rng() * 8;
}

export function chooseTrainerAction(enemySide, playerSide, typeChart, battleType = "trainer", rng = Math.random) {
  const attacker = enemySide.party[enemySide.activeIndex];
  const defender = playerSide.party[playerSide.activeIndex];

  if (!attacker || attacker.currentHp <= 0) {
    return { type: "move", moveIndex: -1, struggle: true };
  }

  const usable = [];
  for (let i = 0; i < attacker.moves.length; i++) {
    if (attacker.moves[i].currentPp > 0) {
      usable.push(i);
    }
  }

  if (usable.length === 0) {
    return { type: "move", moveIndex: -1, struggle: true };
  }

  let bestIdx = usable[0];
  let bestScore = -Infinity;
  const moveScores = [];

  for (const idx of usable) {
    const move = attacker.moves[idx];
    const sc = scoreMoveForAI(attacker, defender, move, typeChart, {
      rng,
      reflectActive: playerSide.reflectTurns > 0,
      lightScreenActive: playerSide.lightScreenTurns > 0,
    });
    moveScores.push({ idx, moveKey: move.key, score: sc });
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = idx;
    }
  }

  // Gym Leader optional tactical switch if completely walled and healthy counter exists
  if (battleType === "leader" && bestScore < 20 && attacker.currentHp > attacker.maxHp * 0.4) {
    for (let i = 0; i < enemySide.party.length; i++) {
      if (i === enemySide.activeIndex) continue;
      const ally = enemySide.party[i];
      if (ally.currentHp <= ally.maxHp * 0.5) continue;
      const hasStrongMove = ally.moves.some(
        (m) =>
          m.currentPp > 0 &&
          m.power > 0 &&
          getTypeEffectiveness(m.type, defender.types, typeChart) >= 2
      );
      if (hasStrongMove && rng() < 0.45) {
        return { type: "switch", partyIndex: i };
      }
    }
  }

  return { type: "move", moveIndex: bestIdx, struggle: false, debugScores: moveScores };
}

export function chooseEnemyAction(enemySide, playerSide, typeChart, battleType = "wild", rng = Math.random) {
  const attacker = enemySide.party[enemySide.activeIndex];
  if (battleType === "wild") {
    return chooseWildAction(attacker, rng);
  }
  return chooseTrainerAction(enemySide, playerSide, typeChart, battleType, rng);
}
