/**
 * Gen 3 Turn-Based Battle Engine
 * Handles turn priority, stat stages (-6..+6), primary status conditions,
 * damage calculation, item usage (healing & Gen 3 Poké Ball capture),
 * EXP gain, level-ups, move learning, and dynamic rival level scaling.
 */

import {
  calculateDamage,
  calculatePokemonStats,
  calculateStatWithStage,
  clampStage,
  getExpForLevel,
  getLevelFromExp,
  getMoveCategory,
} from "./damageCalculator.js";
import { calculateTrainerReward, scalePartyLevels } from "./levelScaler.js";
import { chooseEnemyAction } from "./battleAI.js";

export const STATUS_LABELS = {
  PARALYSIS: "PAR",
  BURN: "BRN",
  POISON: "PSN",
  BADLY_POISONED: "TOX",
  SLEEP: "SLP",
  FREEZE: "FRZ",
};

const STRUGGLE_FALLBACK = {
  id: 165,
  key: "STRUGGLE",
  name: "Struggle",
  type: "NORMAL",
  category: "physical",
  power: 50,
  accuracy: 100,
  pp: 1,
  priority: 0,
  effect: "EFFECT_RECOIL",
  effectChance: 0,
  target: "MOVE_TARGET_SELECTED",
  makesContact: true,
};

export function createEmptyStatStages() {
  return {
    attack: 0,
    defense: 0,
    spAttack: 0,
    spDefense: 0,
    speed: 0,
    accuracy: 0,
    evasion: 0,
  };
}

/**
 * Indexes species, moves, and items arrays into lookup maps keyed by key and id.
 */
export function buildDataMaps({ species = [], moves = [], items = [] } = {}) {
  const speciesMap = {};
  for (const sp of species) {
    speciesMap[sp.key] = sp;
    speciesMap[sp.id] = sp;
  }
  const movesMap = {};
  for (const mv of moves) {
    movesMap[mv.key] = mv;
    movesMap[mv.id] = mv;
  }
  const itemsMap = {};
  for (const it of items) {
    itemsMap[it.key] = it;
    if (it.itemId) itemsMap[it.itemId] = it;
    itemsMap[it.id] = it;
  }
  return { speciesMap, movesMap, itemsMap };
}

/**
 * Selects up to 4 unique level-up moves learned at or below `level` (most recent 4).
 */
export function selectMovesForLevel(species, level, movesMap) {
  const learnedKeys = [];
  for (const entry of species.levelUpMoves || []) {
    if (entry.level <= level) {
      if (!learnedKeys.includes(entry.moveKey)) {
        learnedKeys.push(entry.moveKey);
      } else {
        // Keep latest slot order
        const idx = learnedKeys.indexOf(entry.moveKey);
        learnedKeys.splice(idx, 1);
        learnedKeys.push(entry.moveKey);
      }
    }
  }

  const finalKeys = learnedKeys.slice(-4);
  if (finalKeys.length === 0 && movesMap["TACKLE"]) {
    finalKeys.push("TACKLE");
  }

  return finalKeys.map((k) => {
    const m = movesMap[k] || STRUGGLE_FALLBACK;
    return {
      ...m,
      currentPp: m.pp,
      maxPp: m.pp,
    };
  });
}

/**
 * Builds a battle-ready Pokémon instance from species data.
 */
export function createBattlePokemon(species, level, movesMap, options = {}) {
  const lvl = Math.max(1, Math.min(100, level));
  const ivs = options.ivs || { hp: 15, attack: 15, defense: 15, speed: 15, spAttack: 15, spDefense: 15 };
  const evs = options.evs || { hp: 0, attack: 0, defense: 0, speed: 0, spAttack: 0, spDefense: 0 };
  const stats = calculatePokemonStats(species, lvl, ivs, evs);

  let moves;
  if (Array.isArray(options.moveKeys) && options.moveKeys.length > 0) {
    moves = options.moveKeys.slice(0, 4).map((k) => {
      const m = movesMap[k] || STRUGGLE_FALLBACK;
      return { ...m, currentPp: m.pp, maxPp: m.pp };
    });
  } else {
    moves = selectMovesForLevel(species, lvl, movesMap);
  }

  const currentHp = typeof options.currentHp === "number" ? Math.min(stats.hp, Math.max(0, options.currentHp)) : stats.hp;

  return {
    uid: options.uid || `${species.key}_${lvl}_${Math.random().toString(36).slice(2, 7)}`,
    speciesId: species.id,
    speciesKey: species.key,
    name: options.nickname || species.name,
    speciesName: species.name,
    types: [...species.types],
    baseStats: { ...species.baseStats },
    catchRate: species.catchRate,
    safariZoneFleeRate: species.safariZoneFleeRate || 0,
    expYield: species.expYield,
    growthRate: species.growthRate,
    ability: options.ability || species.abilities?.[0] || "NONE",
    level: lvl,
    baseLevel: options.baseLevel ?? lvl,
    isAce: Boolean(options.isAce),
    exp: typeof options.exp === "number" ? options.exp : getExpForLevel(species.growthRate, lvl),
    ivs,
    evs,
    stats,
    maxHp: stats.hp,
    currentHp,
    status: options.status || null,
    sleepTurns: 0,
    toxicCounter: 1,
    confused: false,
    confusionTurns: 0,
    flinched: false,
    focusEnergy: false,
    foresight: false,
    statStages: createEmptyStatStages(),
    moves,
  };
}

/**
 * Official Gen 3 Poké Ball Capture Formula (src/battle_script_commands.c: Cmd_handleballthrow).
 */
export function calculateCatchOdds(wildMon, ballItem, options = {}) {
  let catchRate = wildMon.catchRate ?? 45;

  // SPEC_MAESTRA §8.3: Safari Zone Race permanent capture/encounter bonus
  if (options.safariBoostActive) {
    catchRate = Math.min(255, Math.round(catchRate * 1.25));
  }

  const ballMultiplier = ballItem?.catchMultiplier ?? 1.0;
  const ballScaled = Math.round(ballMultiplier * 10);

  let a = Math.floor(
    (Math.floor((catchRate * ballScaled) / 10) * (3 * wildMon.maxHp - 2 * wildMon.currentHp)) /
      (3 * wildMon.maxHp)
  );

  if (wildMon.status === "SLEEP" || wildMon.status === "FREEZE") {
    a *= 2;
  } else if (
    wildMon.status === "POISON" ||
    wildMon.status === "BADLY_POISONED" ||
    wildMon.status === "BURN" ||
    wildMon.status === "PARALYSIS"
  ) {
    a = Math.floor((a * 15) / 10);
  }

  a = Math.max(1, a);

  if (a > 254) {
    return {
      a,
      b: 65535,
      guaranteed: true,
      shakeProbability: 1,
      approxChancePercent: 100,
    };
  }

  const sqrt1 = Math.floor(Math.sqrt(Math.floor(16711680 / a)));
  const sqrt2 = Math.floor(Math.sqrt(sqrt1));
  const b = Math.floor(1048560 / Math.max(1, sqrt2));
  const pShake = Math.min(1, b / 65536);
  const approxChancePercent = Math.round(Math.pow(pShake, 3) * 1000) / 10;

  return {
    a,
    b,
    guaranteed: false,
    shakeProbability: pShake,
    approxChancePercent,
  };
}

export function attemptCatch(wildMon, ballItem, options = {}, rng = Math.random) {
  const odds = calculateCatchOdds(wildMon, ballItem, options);
  if (odds.guaranteed) {
    return { caught: true, shakes: 3, odds };
  }

  let shakes = 0;
  for (let i = 0; i < 3; i++) {
    const roll16 = Math.floor(rng() * 65536);
    if (roll16 < odds.b) {
      shakes++;
    } else {
      break;
    }
  }

  return {
    caught: shakes === 3,
    shakes,
    odds,
  };
}

function getEffectiveSpeed(mon) {
  let spd = calculateStatWithStage(mon.stats.speed, mon.statStages.speed);
  if (mon.status === "PARALYSIS") {
    spd = Math.max(1, Math.floor(spd / 4));
  }
  return spd;
}

function formatStageChangeLabel(statKey) {
  const labels = {
    attack: "Ataque",
    defense: "Defensa",
    spAttack: "At. Esp.",
    spDefense: "Def. Esp.",
    speed: "Velocidad",
    accuracy: "Precisión",
    evasion: "Evasión",
  };
  return labels[statKey] || statKey;
}

export class BattleEngine {
  /**
   * @param {object} config
   * @param {Array} config.playerParty
   * @param {Array} config.enemyParty - Either pre-built Pokémon instances or specs { speciesKey, baseLevel, moveKeys }
   * @param {"wild"|"trainer"|"leader"} config.battleType
   * @param {object} config.speciesMap - Map of speciesKey/id -> species object
   * @param {object} config.movesMap - Map of moveKey -> move object
   * @param {object} config.typeChart - Parsed type_chart.json
   * @param {object} config.itemsMap - Map of itemKey -> item object
   */
  constructor({
    playerParty,
    enemyParty,
    battleType = "wild",
    trainerName = "Rival",
    speciesMap = {},
    movesMap = {},
    typeChart,
    itemsMap = {},
    rng = Math.random,
    safariBoostActive = false,
    trainerOffset = 2,
    alreadyScaled = false,
  }) {
    this.battleType = battleType;
    this.trainerName = trainerName;
    this.speciesMap = speciesMap;
    this.movesMap = movesMap;
    this.typeChart = typeChart;
    this.itemsMap = itemsMap;
    this.rng = rng;
    this.safariBoostActive = safariBoostActive;

    const builtPlayer = playerParty.map((p) =>
      p.stats ? p : createBattlePokemon(this.resolveSpecies(p.speciesKey || p.speciesId), p.level, movesMap, p)
    );

    let builtEnemy;
    if (alreadyScaled) {
      builtEnemy = enemyParty;
    } else {
      const scaledSpecs = scalePartyLevels(enemyParty, builtPlayer, battleType, { trainerOffset });
      builtEnemy = scaledSpecs.map((spec) => {
        const sp = spec.speciesKey || spec.speciesId ? this.resolveSpecies(spec.speciesKey || spec.speciesId) : spec;
        const level = spec.scaledLevel ?? spec.level;
        return createBattlePokemon(sp, level, movesMap, {
          ...spec,
          baseLevel: spec.baseLevel,
          isAce: spec.isAce,
        });
      });
    }

    const firstAlivePlayer = builtPlayer.findIndex((m) => m.currentHp > 0);
    const firstAliveEnemy = builtEnemy.findIndex((m) => m.currentHp > 0);

    this.playerSide = {
      party: builtPlayer,
      activeIndex: firstAlivePlayer >= 0 ? firstAlivePlayer : 0,
      reflectTurns: 0,
      lightScreenTurns: 0,
      participants: new Set([firstAlivePlayer >= 0 ? firstAlivePlayer : 0]),
    };

    this.enemySide = {
      party: builtEnemy,
      activeIndex: firstAliveEnemy >= 0 ? firstAliveEnemy : 0,
      reflectTurns: 0,
      lightScreenTurns: 0,
    };

    this.turn = 0;
    this.status = "active"; // "active" | "player_win" | "enemy_win" | "caught" | "fled"
    this.awaitingPlayerSwitch = false;
    this.logs = [];
    this.prizeMoney = battleType === "wild" ? 0 : calculateTrainerReward(builtEnemy, battleType === "leader" ? 80 : 40);

    const foe = this.getActive("enemy");
    const ply = this.getActive("player");
    if (battleType === "wild") {
      this.log(`¡Un ${foe.name} salvaje (Nv. ${foe.level}) apareció!`, "info");
    } else {
      this.log(`¡${this.trainerName} te desafía! Saca a ${foe.name} (Nv. ${foe.level}).`, "info");
    }
    this.log(`¡Adelante, ${ply.name} (Nv. ${ply.level})!`, "info");
  }

  resolveSpecies(keyOrId) {
    if (this.speciesMap[keyOrId]) return this.speciesMap[keyOrId];
    throw new Error(`Unknown species: ${keyOrId}`);
  }

  log(message, kind = "normal") {
    this.logs.push({ turn: this.turn, message, kind });
  }

  getActive(sideName) {
    const side = sideName === "player" ? this.playerSide : this.enemySide;
    return side.party[side.activeIndex];
  }

  getState() {
    return {
      turn: this.turn,
      battleType: this.battleType,
      trainerName: this.trainerName,
      status: this.status,
      awaitingPlayerSwitch: this.awaitingPlayerSwitch,
      prizeMoney: this.prizeMoney,
      playerSide: {
        activeIndex: this.playerSide.activeIndex,
        active: this.getActive("player"),
        party: this.playerSide.party,
      },
      enemySide: {
        activeIndex: this.enemySide.activeIndex,
        active: this.getActive("enemy"),
        party: this.enemySide.party,
      },
      logs: [...this.logs],
    };
  }

  /**
   * Forces player to pick a living replacement after fainting.
   */
  forceSwitchPlayer(partyIndex) {
    if (!this.awaitingPlayerSwitch || this.status !== "active") {
      return this.getState();
    }
    const target = this.playerSide.party[partyIndex];
    if (!target || target.currentHp <= 0) {
      throw new Error("Invalid switch target: Pokémon is fainted or missing.");
    }
    this.playerSide.activeIndex = partyIndex;
    this.playerSide.participants.add(partyIndex);
    target.statStages = createEmptyStatStages();
    target.confused = false;
    target.flinched = false;
    target.focusEnergy = false;
    target.foresight = false;
    this.awaitingPlayerSwitch = false;
    this.log(`¡Adelante, ${target.name} (Nv. ${target.level})!`, "info");
    return this.getState();
  }

  /**
   * Executes one full battle turn given player's selected action.
   */
  executeTurn(playerAction) {
    if (this.status !== "active") {
      return this.getState();
    }
    if (this.awaitingPlayerSwitch) {
      throw new Error("Player must switch Pokémon before taking another action.");
    }

    this.turn += 1;
    const enemyActive = this.getActive("enemy");
    const playerActive = this.getActive("player");
    playerActive.flinched = false;
    enemyActive.flinched = false;

    // Handle Run immediately
    if (playerAction.type === "run") {
      if (this.battleType !== "wild") {
        this.log("¡No puedes huir de un combate contra otro Entrenador!", "warning");
        // Does not waste turn in trainer battle UI, return directly without increment
        this.turn -= 1;
        return this.getState();
      }
      this.status = "fled";
      this.log("¡Escapaste sin problemas!", "info");
      return this.getState();
    }

    // Decide AI action before turn starts
    const enemyAction = chooseEnemyAction(
      this.enemySide,
      this.playerSide,
      this.typeChart,
      this.battleType,
      this.rng
    );

    // Phase 1: Priority non-move actions (Items & Switching go before attacks)
    let playerUsedPriorityAction = false;
    if (playerAction.type === "item") {
      playerUsedPriorityAction = true;
      const result = this.handlePlayerItem(playerAction);
      if (this.status !== "active") {
        return this.getState();
      }
      if (result.invalid) {
        this.turn -= 1;
        return this.getState();
      }
    } else if (playerAction.type === "switch") {
      playerUsedPriorityAction = true;
      const nextMon = this.playerSide.party[playerAction.partyIndex];
      if (!nextMon || nextMon.currentHp <= 0 || playerAction.partyIndex === this.playerSide.activeIndex) {
        this.log("No puedes cambiar a ese Pokémon.", "warning");
        this.turn -= 1;
        return this.getState();
      }
      const prev = this.getActive("player");
      prev.statStages = createEmptyStatStages();
      prev.confused = false;
      prev.focusEnergy = false;
      prev.foresight = false;
      this.playerSide.activeIndex = playerAction.partyIndex;
      this.playerSide.participants.add(playerAction.partyIndex);
      this.log(`¡Vuelve, ${prev.name}! ¡Adelante, ${nextMon.name}!`, "info");
    }

    let enemySwitched = false;
    if (enemyAction.type === "switch") {
      enemySwitched = true;
      const prev = this.getActive("enemy");
      const next = this.enemySide.party[enemyAction.partyIndex];
      prev.statStages = createEmptyStatStages();
      prev.confused = false;
      prev.focusEnergy = false;
      prev.foresight = false;
      this.enemySide.activeIndex = enemyAction.partyIndex;
      this.log(`¡${this.trainerName} retira a ${prev.name} y envía a ${next.name}!`, "info");
    }

    // Phase 2: Move ordering
    const moveQueue = [];
    if (!playerUsedPriorityAction && playerAction.type === "move") {
      moveQueue.push({ side: "player", action: playerAction });
    }
    if (!enemySwitched && enemyAction.type === "move") {
      moveQueue.push({ side: "enemy", action: enemyAction });
    }

    if (moveQueue.length === 2) {
      const pMove = this.resolveMoveObj(this.getActive("player"), playerAction);
      const eMove = this.resolveMoveObj(this.getActive("enemy"), enemyAction);
      const pPri = pMove.priority || 0;
      const ePri = eMove.priority || 0;

      if (pPri !== ePri) {
        moveQueue.sort((a, b) => (b.side === "player" ? pPri : ePri) - (a.side === "player" ? pPri : ePri));
      } else {
        const pSpd = getEffectiveSpeed(this.getActive("player"));
        const eSpd = getEffectiveSpeed(this.getActive("enemy"));
        if (pSpd !== eSpd) {
          moveQueue.sort((a, b) => (b.side === "player" ? pSpd : eSpd) - (a.side === "player" ? pSpd : eSpd));
        } else if (this.rng() < 0.5) {
          moveQueue.reverse();
        }
      }
    }

    // Execute queued moves
    for (const entry of moveQueue) {
      if (this.status !== "active") break;
      const atkSide = entry.side;
      const defSide = atkSide === "player" ? "enemy" : "player";
      const attacker = this.getActive(atkSide);
      const defender = this.getActive(defSide);

      if (attacker.currentHp <= 0 || defender.currentHp <= 0) continue;

      this.executeMove(atkSide, defSide, entry.action);

      // Check faint immediately after move
      if (defender.currentHp <= 0) {
        this.handleFaint(defSide);
        if (this.status !== "active" || this.awaitingPlayerSwitch) {
          break;
        }
      }
      if (attacker.currentHp <= 0) {
        this.handleFaint(atkSide);
        if (this.status !== "active" || this.awaitingPlayerSwitch) {
          break;
        }
      }
    }

    // Phase 3: End-of-turn residual status damage (if battle still active and nobody waiting switch)
    if (this.status === "active" && !this.awaitingPlayerSwitch) {
      for (const sideName of ["player", "enemy"]) {
        if (this.status !== "active" || this.awaitingPlayerSwitch) break;
        const mon = this.getActive(sideName);
        if (mon.currentHp > 0) {
          this.applyEndOfTurnEffects(sideName);
          if (mon.currentHp <= 0) {
            this.handleFaint(sideName);
          }
        }
      }
    }

    // Decrement screens
    for (const side of [this.playerSide, this.enemySide]) {
      if (side.reflectTurns > 0) side.reflectTurns -= 1;
      if (side.lightScreenTurns > 0) side.lightScreenTurns -= 1;
    }

    return this.getState();
  }

  resolveMoveObj(attacker, action) {
    if (action.struggle || action.moveIndex < 0 || !attacker.moves[action.moveIndex]) {
      return STRUGGLE_FALLBACK;
    }
    return attacker.moves[action.moveIndex];
  }

  handlePlayerItem(action) {
    const item = this.itemsMap[action.itemKey];
    if (!item) {
      this.log(`Objeto desconocido: ${action.itemKey}.`, "warning");
      return { invalid: true };
    }

    // Poké Ball capture logic
    if (item.category === "pokeball") {
      if (this.battleType !== "wild") {
        this.log("¡No puedes atrapar el Pokémon de otro Entrenador!", "warning");
        return { invalid: true };
      }

      const wildMon = this.getActive("enemy");
      this.log(`¡Lanzaste una ${item.name}!`, "info");

      const result = attemptCatch(
        wildMon,
        item,
        { safariBoostActive: this.safariBoostActive },
        this.rng
      );

      if (result.caught) {
        this.status = "caught";
        this.log(`¡1... 2... 3... ¡Clic! ¡Has atrapado a ${wildMon.name}!`, "success");
      } else {
        const shakeMsg =
          result.shakes === 0
            ? "¡Oh, no! ¡El Pokémon se liberó de inmediato!"
            : result.shakes === 1
            ? "¡Parecía que lo tenías! Se escapó tras 1 sacudida."
            : "¡Aargh! ¡Estuvo tan cerca! Se escapó tras 2 sacudidas.";
        this.log(shakeMsg, "warning");
      }
      return { invalid: false };
    }

    // Healing / Status / Revive items
    const targetIdx = typeof action.targetIndex === "number" ? action.targetIndex : this.playerSide.activeIndex;
    const target = this.playerSide.party[targetIdx];
    if (!target) {
      this.log("Objetivo de objeto inválido.", "warning");
      return { invalid: true };
    }

    if (item.category === "revive") {
      if (target.currentHp > 0) {
        this.log(`${target.name} no está debilitado.`, "warning");
        return { invalid: true };
      }
      const restored = Math.max(1, Math.floor(target.maxHp * (item.healFraction || 0.5)));
      target.currentHp = restored;
      target.status = null;
      target.sleepTurns = 0;
      target.toxicCounter = 1;
      this.log(`¡Usaste ${item.name}! ${target.name} recuperó ${restored} PS.`, "success");
      return { invalid: false };
    }

    if (target.currentHp <= 0) {
      this.log(`${target.name} está debilitado y necesita Revivir.`, "warning");
      return { invalid: true };
    }

    if (item.category === "healing") {
      const needsHp = target.currentHp < target.maxHp;
      const needsStatus = item.cureStatus === "ALL" && Boolean(target.status);
      if (!needsHp && !needsStatus) {
        this.log(`${target.name} ya tiene sus PS al máximo.`, "warning");
        return { invalid: true };
      }
      const before = target.currentHp;
      if (item.healHp === "full") {
        target.currentHp = target.maxHp;
      } else {
        target.currentHp = Math.min(target.maxHp, target.currentHp + item.healHp);
      }
      const healed = target.currentHp - before;
      if (item.cureStatus === "ALL" && target.status) {
        target.status = null;
        target.sleepTurns = 0;
        target.toxicCounter = 1;
      }
      this.log(`¡Usaste ${item.name} en ${target.name}! (+${healed} PS)`, "success");
      return { invalid: false };
    }

    if (item.category === "status") {
      const matchesPoison =
        item.cureStatus === "POISON" &&
        (target.status === "POISON" || target.status === "BADLY_POISONED");
      const matchesExact = target.status === item.cureStatus;
      if (!matchesPoison && !matchesExact) {
        this.log(`${target.name} no sufre ese problema de estado.`, "warning");
        return { invalid: true };
      }
      target.status = null;
      target.sleepTurns = 0;
      target.toxicCounter = 1;
      this.log(`¡Usaste ${item.name}! ${target.name} se curó.`, "success");
      return { invalid: false };
    }

    this.log(`No puedes usar ${item.name} en combate.`, "warning");
    return { invalid: true };
  }

  executeMove(atkSide, defSide, action) {
    const attacker = this.getActive(atkSide);
    const defender = this.getActive(defSide);
    const move = this.resolveMoveObj(attacker, action);
    const atkTag = atkSide === "enemy" ? ` (Rival)` : "";

    // 1. Pre-move status checks
    if (attacker.status === "SLEEP") {
      if (attacker.sleepTurns > 0) {
        attacker.sleepTurns -= 1;
        this.log(`¡${attacker.name}${atkTag} está profundamente dormido!`, "status");
        return;
      }
      attacker.status = null;
      this.log(`¡${attacker.name}${atkTag} se despertó!`, "status");
    }

    if (attacker.status === "FREEZE") {
      const thawsNaturally = this.rng() < 0.2;
      const fireMoveThaw = move.type === "FIRE";
      if (!thawsNaturally && !fireMoveThaw) {
        this.log(`¡${attacker.name}${atkTag} está congelado y no se puede mover!`, "status");
        return;
      }
      attacker.status = null;
      this.log(`¡${attacker.name}${atkTag} se descongeló!`, "status");
    }

    if (attacker.flinched) {
      attacker.flinched = false;
      this.log(`¡${attacker.name}${atkTag} retrocedió y no pudo atacar!`, "status");
      return;
    }

    if (attacker.status === "PARALYSIS" && this.rng() < 0.25) {
      this.log(`¡${attacker.name}${atkTag} está paralizado! No se puede mover.`, "status");
      return;
    }

    if (attacker.confused) {
      if (attacker.confusionTurns <= 0) {
        attacker.confused = false;
        this.log(`¡${attacker.name}${atkTag} salió de su confusión!`, "status");
      } else {
        attacker.confusionTurns -= 1;
        this.log(`${attacker.name}${atkTag} está confuso...`, "status");
        if (this.rng() < 0.5) {
          // Typeless 40-power physical self-hit
          const atkStat = calculateStatWithStage(attacker.stats.attack, attacker.statStages.attack);
          const defStat = calculateStatWithStage(attacker.stats.defense, attacker.statStages.defense);
          const dmg = Math.max(
            1,
            Math.floor(Math.floor(((Math.floor((2 * attacker.level) / 5) + 2) * 40 * atkStat) / Math.max(1, defStat)) / 50) + 2
          );
          attacker.currentHp = Math.max(0, attacker.currentHp - dmg);
          this.log(`¡Se hirió a sí mismo en su confusión! (-${dmg} PS)`, "damage");
          return;
        }
      }
    }

    // Deduct PP
    if (!action.struggle && move.currentPp > 0) {
      move.currentPp -= 1;
    }

    this.log(`¡${attacker.name}${atkTag} usó **${move.name}**!`, "move");

    // 2. Accuracy check (accuracy === 0 bypasses accuracy check in Gen 3)
    const targetsSelf = move.target === "MOVE_TARGET_USER" || move.target === "MOVE_TARGET_USER_OR_ALLY";
    if (!targetsSelf && move.accuracy > 0) {
      const accStage = clampStage(attacker.statStages.accuracy - defender.statStages.evasion);
      const stageFactor = accStage >= 0 ? (3 + accStage) / 3 : 3 / (3 - accStage);
      const hitChance = Math.min(1, (move.accuracy / 100) * stageFactor);
      if (this.rng() >= hitChance) {
        this.log(`¡El ataque de ${attacker.name}${atkTag} falló!`, "warning");
        return;
      }
    }

    // Thaw target if hit by a Fire-type damaging move
    const category = getMoveCategory(move);
    if (category !== "status" && move.type === "FIRE" && defender.status === "FREEZE") {
      defender.status = null;
      this.log(`¡El ataque de fuego descongeló a ${defender.name}!`, "status");
    }

    // 3. Damage & Multi-hit handling
    if (category !== "status" && move.power > 0) {
      let hits = 1;
      if (move.effect === "EFFECT_DOUBLE_HIT" || move.effect === "EFFECT_TWINEEDLE") {
        hits = 2;
      } else if (move.effect === "EFFECT_MULTI_HIT") {
        // Gen 3 distribution: 2 (3/8), 3 (3/8), 4 (1/8), 5 (1/8)
        const r = this.rng();
        hits = r < 0.375 ? 2 : r < 0.75 ? 3 : r < 0.875 ? 4 : 5;
      }

      const defBattleSide = defSide === "player" ? this.playerSide : this.enemySide;
      let totalDealt = 0;
      let actualHits = 0;

      for (let h = 0; h < hits; h++) {
        if (defender.currentHp <= 0) break;

        const dmgResult = calculateDamage(attacker, defender, move, this.typeChart, {
          rng: this.rng,
          reflectActive: defBattleSide.reflectTurns > 0,
          lightScreenActive: defBattleSide.lightScreenTurns > 0,
          foresight: defender.foresight,
        });

        if (dmgResult.effectiveness === 0) {
          this.log(`No afecta a ${defender.name}...`, "warning");
          return;
        }

        const dealt = Math.min(defender.currentHp, dmgResult.damage);
        defender.currentHp -= dealt;
        totalDealt += dealt;
        actualHits += 1;

        if (h === 0) {
          if (dmgResult.effectiveness >= 2) {
            this.log("¡Es muy eficaz!", "super");
          } else if (dmgResult.effectiveness < 1) {
            this.log("No es muy eficaz...", "resisted");
          }
        }
        if (dmgResult.isCrit) {
          this.log("¡Un golpe crítico!", "crit");
        }
        this.log(`Causó ${dealt} PS de daño a ${defender.name}.`, "damage");

        // Secondary effect chance per hit (e.g. Twineedle poison)
        if (defender.currentHp > 0 && move.effectChance > 0) {
          this.applySecondaryMoveEffect(attacker, defender, move);
        }
      }

      if (hits > 1) {
        this.log(`¡Golpeó ${actualHits} veces (total ${totalDealt} PS)!`, "info");
      }

      // Recoil / Drain / Self-KO
      if (move.effect === "EFFECT_ABSORB" || move.effect === "EFFECT_DREAM_EATER") {
        const heal = Math.max(1, Math.floor(totalDealt / 2));
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
        this.log(`¡${attacker.name} absorbió ${heal} PS!`, "success");
      } else if (move.effect === "EFFECT_RECOIL" || move.effect === "EFFECT_DOUBLE_EDGE") {
        const divisor = move.effect === "EFFECT_DOUBLE_EDGE" ? 3 : 4;
        const recoil = Math.max(1, Math.floor(totalDealt / divisor));
        attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
        this.log(`¡${attacker.name} sufrió ${recoil} PS de retroceso!`, "damage");
      } else if (move.effect === "EFFECT_EXPLOSION") {
        attacker.currentHp = 0;
      }

      // High-level secondary effect when effectChance === 0 or fixed
      if (defender.currentHp > 0 && move.effectChance === 0) {
        this.applySecondaryMoveEffect(attacker, defender, move);
      }
      return;
    }

    // 4. Status / Non-damaging move effects
    this.applyStatusMoveEffect(atkSide, defSide, attacker, defender, move);
  }

  applySecondaryMoveEffect(attacker, defender, move) {
    const chance = move.effectChance || 0;
    if (chance > 0 && this.rng() * 100 >= chance) {
      return;
    }

    switch (move.effect) {
      case "EFFECT_BURN_HIT":
        this.tryInflictStatus(defender, "BURN");
        break;
      case "EFFECT_FREEZE_HIT":
        this.tryInflictStatus(defender, "FREEZE");
        break;
      case "EFFECT_PARALYZE_HIT":
        this.tryInflictStatus(defender, "PARALYSIS");
        break;
      case "EFFECT_POISON_HIT":
      case "EFFECT_TWINEEDLE":
      case "EFFECT_POISON_TAIL":
        this.tryInflictStatus(defender, "POISON");
        break;
      case "EFFECT_POISON_FANG":
        this.tryInflictStatus(defender, "BADLY_POISONED");
        break;
      case "EFFECT_TRI_ATTACK": {
        const choices = ["BURN", "FREEZE", "PARALYSIS"];
        this.tryInflictStatus(defender, choices[Math.floor(this.rng() * 3)]);
        break;
      }
      case "EFFECT_FLINCH_HIT":
      case "EFFECT_FLINCH_MINIMIZE_HIT":
        if (chance > 0) {
          defender.flinched = true;
        }
        break;
      case "EFFECT_CONFUSE_HIT":
        this.tryConfuse(defender);
        break;
      case "EFFECT_ATTACK_DOWN_HIT":
        this.modifyStatStage(defender, "attack", -1);
        break;
      case "EFFECT_DEFENSE_DOWN_HIT":
        this.modifyStatStage(defender, "defense", -1);
        break;
      case "EFFECT_SPEED_DOWN_HIT":
        this.modifyStatStage(defender, "speed", -1);
        break;
      case "EFFECT_SPECIAL_DEFENSE_DOWN_HIT":
        this.modifyStatStage(defender, "spDefense", -1);
        break;
      case "EFFECT_ATTACK_UP_HIT":
        this.modifyStatStage(attacker, "attack", 1);
        break;
      case "EFFECT_DEFENSE_UP_HIT":
        this.modifyStatStage(attacker, "defense", 1);
        break;
      case "EFFECT_ALL_STATS_UP_HIT":
        for (const k of ["attack", "defense", "spAttack", "spDefense", "speed"]) {
          this.modifyStatStage(attacker, k, 1);
        }
        break;
      default:
        break;
    }
  }

  applyStatusMoveEffect(atkSide, defSide, attacker, defender, move) {
    const atkBattleSide = atkSide === "player" ? this.playerSide : this.enemySide;

    switch (move.effect) {
      case "EFFECT_SLEEP":
        if (!this.tryInflictStatus(defender, "SLEEP")) {
          this.log(`No afectó a ${defender.name}...`, "warning");
        }
        break;
      case "EFFECT_PARALYZE":
        if (move.type === "ELECTRIC" && defender.types.includes("GROUND")) {
          this.log(`No afecta a ${defender.name}...`, "warning");
        } else if (!this.tryInflictStatus(defender, "PARALYSIS")) {
          this.log(`No afectó a ${defender.name}...`, "warning");
        }
        break;
      case "EFFECT_POISON":
        if (!this.tryInflictStatus(defender, "POISON")) {
          this.log(`No afectó a ${defender.name}...`, "warning");
        }
        break;
      case "EFFECT_TOXIC":
        if (!this.tryInflictStatus(defender, "BADLY_POISONED")) {
          this.log(`No afectó a ${defender.name}...`, "warning");
        }
        break;
      case "EFFECT_WILL_O_WISP":
        if (!this.tryInflictStatus(defender, "BURN")) {
          this.log(`No afectó a ${defender.name}...`, "warning");
        }
        break;
      case "EFFECT_CONFUSE":
      case "EFFECT_TEETER_DANCE":
        if (!this.tryConfuse(defender)) {
          this.log(`¡${defender.name} ya está confuso!`, "warning");
        }
        break;
      case "EFFECT_ATTACK_UP":
        this.modifyStatStage(attacker, "attack", 1);
        break;
      case "EFFECT_ATTACK_UP_2":
        this.modifyStatStage(attacker, "attack", 2);
        break;
      case "EFFECT_DEFENSE_UP":
      case "EFFECT_DEFENSE_CURL":
        this.modifyStatStage(attacker, "defense", 1);
        break;
      case "EFFECT_DEFENSE_UP_2":
        this.modifyStatStage(attacker, "defense", 2);
        break;
      case "EFFECT_SPEED_UP":
        this.modifyStatStage(attacker, "speed", 1);
        break;
      case "EFFECT_SPEED_UP_2":
        this.modifyStatStage(attacker, "speed", 2);
        break;
      case "EFFECT_SPECIAL_ATTACK_UP":
        this.modifyStatStage(attacker, "spAttack", 1);
        break;
      case "EFFECT_SPECIAL_ATTACK_UP_2":
        this.modifyStatStage(attacker, "spAttack", 2);
        break;
      case "EFFECT_SPECIAL_DEFENSE_UP":
        this.modifyStatStage(attacker, "spDefense", 1);
        break;
      case "EFFECT_SPECIAL_DEFENSE_UP_2":
        this.modifyStatStage(attacker, "spDefense", 2);
        break;
      case "EFFECT_EVASION_UP":
      case "EFFECT_MINIMIZE":
        this.modifyStatStage(attacker, "evasion", 1);
        break;
      case "EFFECT_EVASION_UP_2":
        this.modifyStatStage(attacker, "evasion", 2);
        break;
      case "EFFECT_BULK_UP":
        this.modifyStatStage(attacker, "attack", 1);
        this.modifyStatStage(attacker, "defense", 1);
        break;
      case "EFFECT_CALM_MIND":
        this.modifyStatStage(attacker, "spAttack", 1);
        this.modifyStatStage(attacker, "spDefense", 1);
        break;
      case "EFFECT_DRAGON_DANCE":
        this.modifyStatStage(attacker, "attack", 1);
        this.modifyStatStage(attacker, "speed", 1);
        break;
      case "EFFECT_COSMIC_POWER":
        this.modifyStatStage(attacker, "defense", 1);
        this.modifyStatStage(attacker, "spDefense", 1);
        break;
      case "EFFECT_ATTACK_DOWN":
        this.modifyStatStage(defender, "attack", -1);
        break;
      case "EFFECT_ATTACK_DOWN_2":
        this.modifyStatStage(defender, "attack", -2);
        break;
      case "EFFECT_DEFENSE_DOWN":
        this.modifyStatStage(defender, "defense", -1);
        break;
      case "EFFECT_DEFENSE_DOWN_2":
        this.modifyStatStage(defender, "defense", -2);
        break;
      case "EFFECT_SPECIAL_ATTACK_DOWN":
        this.modifyStatStage(defender, "spAttack", -1);
        break;
      case "EFFECT_SPECIAL_ATTACK_DOWN_2":
        this.modifyStatStage(defender, "spAttack", -2);
        break;
      case "EFFECT_SPECIAL_DEFENSE_DOWN":
        this.modifyStatStage(defender, "spDefense", -1);
        break;
      case "EFFECT_SPECIAL_DEFENSE_DOWN_2":
        this.modifyStatStage(defender, "spDefense", -2);
        break;
      case "EFFECT_SPEED_DOWN":
        this.modifyStatStage(defender, "speed", -1);
        break;
      case "EFFECT_SPEED_DOWN_2":
        this.modifyStatStage(defender, "speed", -2);
        break;
      case "EFFECT_ACCURACY_DOWN":
        this.modifyStatStage(defender, "accuracy", -1);
        break;
      case "EFFECT_EVASION_DOWN":
        this.modifyStatStage(defender, "evasion", -1);
        break;
      case "EFFECT_FOCUS_ENERGY":
        attacker.focusEnergy = true;
        this.log(`¡${attacker.name} se prepara para asestar golpes críticos!`, "status");
        break;
      case "EFFECT_FORESIGHT":
        defender.foresight = true;
        this.log(`¡${defender.name} fue identificado!`, "status");
        break;
      case "EFFECT_REFLECT":
        atkBattleSide.reflectTurns = 5;
        this.log(`¡Reflejo protege al equipo de ${attacker.name}!`, "status");
        break;
      case "EFFECT_LIGHT_SCREEN":
        atkBattleSide.lightScreenTurns = 5;
        this.log(`¡Pantalla de Luz protege al equipo de ${attacker.name}!`, "status");
        break;
      case "EFFECT_HAZE":
        attacker.statStages = createEmptyStatStages();
        defender.statStages = createEmptyStatStages();
        this.log("¡Todos los cambios de características se eliminaron!", "status");
        break;
      case "EFFECT_RESTORE_HP":
      case "EFFECT_SOFTBOILED":
      case "EFFECT_MORNING_SUN":
      case "EFFECT_SYNTHESIS":
      case "EFFECT_MOONLIGHT": {
        const heal = Math.max(1, Math.floor(attacker.maxHp / 2));
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
        this.log(`¡${attacker.name} restauró ${heal} PS!`, "success");
        break;
      }
      case "EFFECT_REST":
        attacker.currentHp = attacker.maxHp;
        attacker.status = "SLEEP";
        attacker.sleepTurns = 2;
        this.log(`¡${attacker.name} se echó a dormir y recuperó todos sus PS!`, "success");
        break;
      case "EFFECT_SPLASH":
        this.log("¡Pero no pasó nada!", "info");
        break;
      default:
        this.log(`¡El movimiento ${move.name} surtió efecto!`, "info");
        break;
    }
  }

  tryInflictStatus(target, newStatus) {
    if (target.status) {
      return false;
    }
    if ((newStatus === "POISON" || newStatus === "BADLY_POISONED") && (target.types.includes("POISON") || target.types.includes("STEEL"))) {
      return false;
    }
    if (newStatus === "BURN" && target.types.includes("FIRE")) {
      return false;
    }
    if (newStatus === "FREEZE" && target.types.includes("ICE")) {
      return false;
    }

    target.status = newStatus;
    if (newStatus === "SLEEP") {
      // Gen 3 sleep lasts 2 to 5 turns (1..4 active sleep skips + wake)
      target.sleepTurns = 1 + Math.floor(this.rng() * 4);
      this.log(`¡${target.name} se quedó dormido!`, "status");
    } else if (newStatus === "PARALYSIS") {
      this.log(`¡${target.name} ha sido paralizado!`, "status");
    } else if (newStatus === "BURN") {
      this.log(`¡${target.name} sufrió una quemadura!`, "status");
    } else if (newStatus === "POISON") {
      this.log(`¡${target.name} fue envenenado!`, "status");
    } else if (newStatus === "BADLY_POISONED") {
      target.toxicCounter = 1;
      this.log(`¡${target.name} ha sido gravemente envenenado!`, "status");
    } else if (newStatus === "FREEZE") {
      this.log(`¡${target.name} ha sido congelado!`, "status");
    }
    return true;
  }

  tryConfuse(target) {
    if (target.confused) return false;
    target.confused = true;
    target.confusionTurns = 2 + Math.floor(this.rng() * 4);
    this.log(`¡${target.name} se siente confuso!`, "status");
    return true;
  }

  modifyStatStage(target, statKey, delta) {
    const prev = target.statStages[statKey] || 0;
    const next = clampStage(prev + delta);
    if (next === prev) {
      this.log(
        `¡${formatStageChangeLabel(statKey)} de ${target.name} no puede ${delta > 0 ? "subir" : "bajar"} más!`,
        "warning"
      );
      return;
    }
    target.statStages[statKey] = next;
    const adj =
      Math.abs(delta) >= 2
        ? delta > 0
          ? "subió mucho"
          : "bajó mucho"
        : delta > 0
        ? "subió"
        : "bajó";
    this.log(`¡${formatStageChangeLabel(statKey)} de ${target.name} ${adj}!`, "status");
  }

  applyEndOfTurnEffects(sideName) {
    const mon = this.getActive(sideName);
    if (!mon.status || mon.currentHp <= 0) return;

    if (mon.status === "BURN") {
      const dmg = Math.max(1, Math.floor(mon.maxHp / 8));
      mon.currentHp = Math.max(0, mon.currentHp - dmg);
      this.log(`¡${mon.name} se resiente de la quemadura! (-${dmg} PS)`, "damage");
    } else if (mon.status === "POISON") {
      const dmg = Math.max(1, Math.floor(mon.maxHp / 8));
      mon.currentHp = Math.max(0, mon.currentHp - dmg);
      this.log(`¡El veneno resta PS a ${mon.name}! (-${dmg} PS)`, "damage");
    } else if (mon.status === "BADLY_POISONED") {
      const dmg = Math.max(1, Math.floor((mon.maxHp * mon.toxicCounter) / 16));
      mon.toxicCounter += 1;
      mon.currentHp = Math.max(0, mon.currentHp - dmg);
      this.log(`¡El veneno grave daña a ${mon.name}! (-${dmg} PS)`, "damage");
    }
  }

  handleFaint(sideName) {
    const fainted = this.getActive(sideName);
    fainted.currentHp = 0;
    fainted.status = null;

    if (sideName === "enemy") {
      this.log(`¡${fainted.name} rival se debilitó!`, "success");
      this.awardExperience(fainted);

      const nextIdx = this.enemySide.party.findIndex((m) => m.currentHp > 0);
      if (nextIdx === -1) {
        this.status = "player_win";
        if (this.battleType === "wild") {
          this.log(`¡Ganaste el combate contra ${fainted.name}!`, "success");
        } else {
          this.log(`¡Venciste a ${this.trainerName}! Ganaste ₽${this.prizeMoney}.`, "success");
        }
      } else {
        this.enemySide.activeIndex = nextIdx;
        const nextEnemy = this.enemySide.party[nextIdx];
        this.log(`¡${this.trainerName} envía a ${nextEnemy.name} (Nv. ${nextEnemy.level})!`, "info");
      }
      return;
    }

    // Player Pokémon fainted
    this.log(`¡${fainted.name} se debilitó!`, "warning");
    const nextAlive = this.playerSide.party.findIndex((m) => m.currentHp > 0);
    if (nextAlive === -1) {
      this.status = "enemy_win";
      this.log("¡No te quedan Pokémon disponibles! Has perdido el combate.", "warning");
    } else {
      this.awaitingPlayerSwitch = true;
      this.log("Elige el siguiente Pokémon para continuar.", "info");
    }
  }

  awardExperience(faintedEnemy) {
    const participants = [...this.playerSide.participants].filter(
      (idx) => this.playerSide.party[idx] && this.playerSide.party[idx].currentHp > 0
    );
    if (participants.length === 0) return;

    // Gen 3 EXP formula: (baseExp * enemyLevel / 7) / participants * trainerBonus(1.5)
    let baseExp = Math.max(1, Math.floor((faintedEnemy.expYield * faintedEnemy.level) / 7));
    let perMon = Math.max(1, Math.floor(baseExp / participants.length));
    if (this.battleType !== "wild") {
      perMon = Math.floor((perMon * 150) / 100);
    }

    for (const idx of participants) {
      const mon = this.playerSide.party[idx];
      if (mon.level >= 100) continue;

      mon.exp += perMon;
      this.log(`¡${mon.name} ganó ${perMon} Puntos de Experiencia!`, "info");

      const targetLevel = getLevelFromExp(mon.growthRate, mon.exp);
      while (mon.level < targetLevel && mon.level < 100) {
        mon.level += 1;
        const oldMaxHp = mon.maxHp;
        const species = this.speciesMap[mon.speciesKey] || this.speciesMap[mon.speciesId];
        if (species) {
          const newStats = calculatePokemonStats(species, mon.level, mon.ivs, mon.evs);
          const hpDelta = Math.max(0, newStats.hp - oldMaxHp);
          mon.stats = newStats;
          mon.maxHp = newStats.hp;
          mon.currentHp = Math.min(mon.maxHp, mon.currentHp + hpDelta);
          this.log(`¡${mon.name} subió al Nivel ${mon.level}! (+${hpDelta} PS máx.)`, "success");

          // Learn any new moves unlocked at this level
          for (const lvMove of species.levelUpMoves || []) {
            if (lvMove.level === mon.level) {
              const alreadyKnows = mon.moves.some((m) => m.key === lvMove.moveKey);
              if (!alreadyKnows && this.movesMap[lvMove.moveKey]) {
                const moveObj = {
                  ...this.movesMap[lvMove.moveKey],
                  currentPp: this.movesMap[lvMove.moveKey].pp,
                  maxPp: this.movesMap[lvMove.moveKey].pp,
                };
                if (mon.moves.length < 4) {
                  mon.moves.push(moveObj);
                  this.log(`¡${mon.name} aprendió ${moveObj.name}!`, "success");
                } else {
                  const forgotten = mon.moves.shift();
                  mon.moves.push(moveObj);
                  this.log(`¡${mon.name} olvidó ${forgotten.name} y aprendió ${moveObj.name}!`, "success");
                }
              }
            }
          }
        }
      }
    }

    // Reset participant tracker to current active Pokémon for the next foe
    this.playerSide.participants = new Set([this.playerSide.activeIndex]);
  }
}
