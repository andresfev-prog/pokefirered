import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateDamage,
  calculatePokemonStats,
  getExpForLevel,
  getLevelFromExp,
  getMoveCategory,
  getTypeEffectiveness,
} from "../js/battle/damageCalculator.js";
import {
  calculateTargetLevel,
  calculateTrainerReward,
  findAceIndex,
  scalePartyLevels,
} from "../js/battle/levelScaler.js";
import { chooseTrainerAction, chooseWildAction, scoreMoveForAI } from "../js/battle/battleAI.js";
import {
  BattleEngine,
  attemptCatch,
  buildDataMaps,
  calculateCatchOdds,
  createBattlePokemon,
} from "../js/battle/battleEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), "utf8"));
}

const speciesList = loadJson("species.json");
const movesList = loadJson("moves.json");
const typeChart = loadJson("type_chart.json");
const evolutionsList = loadJson("evolutions.json");
const wildEncounters = loadJson("wild_encounters.json");
const itemsList = loadJson("items.json");

const { speciesMap, movesMap, itemsMap } = buildDataMaps({
  species: speciesList,
  moves: movesList,
  items: itemsList,
});

function createDeterministicRng(values = [0.25]) {
  let idx = 0;
  return () => {
    const val = values[idx % values.length];
    idx += 1;
    return val;
  };
}

// ============================================================================
// (A) PATCHED DATA INTEGRITY TESTS
// ============================================================================
test("Patched species.json has 151 species, valid activityPeriod, and exact 7 Safari catchRate edits", () => {
  assert.equal(speciesList.length, 151);

  const validPeriods = new Set(["diurnal", "nocturnal", "any"]);
  for (const sp of speciesList) {
    assert.ok(validPeriods.has(sp.activityPeriod), `Missing/invalid activityPeriod on ${sp.key}: ${sp.activityPeriod}`);
  }

  // Verify the 7 boosted Safari Zone species
  assert.equal(speciesMap["CHANSEY"].catchRate, 90);
  for (const key of ["KANGASKHAN", "SCYTHER", "PINSIR", "TAUROS", "DRATINI", "DRAGONAIR"]) {
    assert.equal(speciesMap[key].catchRate, 105, `${key} catchRate should be 105`);
  }

  // Verify non-Safari catchRates remained intact
  assert.equal(speciesMap["BULBASAUR"].catchRate, 45);
  assert.equal(speciesMap["PIKACHU"].catchRate, 190);
  assert.equal(speciesMap["ABRA"].catchRate, 200);
  assert.equal(speciesMap["SNORLAX"].catchRate, 25);
  assert.equal(speciesMap["ARTICUNO"].catchRate, 3);
  assert.equal(speciesMap["MEWTWO"].catchRate, 3);
});

test("Patched wild_encounters.json merged FireRed/LeafGreen tables, sums to 100%, eliminated 1%-4% rarities, and set environment", () => {
  const validEnvs = new Set(["cave", "outdoor"]);
  let totalTables = 0;

  assert.ok(Array.isArray(wildEncounters.zones) && wildEncounters.zones.length > 0);
  for (const zone of wildEncounters.zones) {
    assert.ok(validEnvs.has(zone.environment), `Invalid environment on ${zone.name}: ${zone.environment}`);
    assert.equal("fireRed" in zone, false);
    assert.equal("leafGreen" in zone, false);

    for (const [methodName, methodObj] of Object.entries(zone.methods || {})) {
      assert.equal("fireRed" in methodObj, false, `${zone.name}.${methodName} still has fireRed`);
      assert.equal("leafGreen" in methodObj, false, `${zone.name}.${methodName} still has leafGreen`);
      assert.ok(Array.isArray(methodObj.encounters) && methodObj.encounters.length > 0);

      let sum = 0;
      for (const slot of methodObj.encounters) {
        sum += slot.rate;
        assert.ok(
          !(slot.rate >= 1 && slot.rate <= 4),
          `Found residual 1%-4% slot in ${zone.name}.${methodName}: ${slot.speciesKey} (${slot.rate}%)`
        );
      }
      assert.equal(sum, 100, `Unified table ${zone.name}.${methodName} sums to ${sum} instead of 100`);
      totalTables += 1;
    }
  }

  assert.ok(totalTables > 200, `Expected >200 unified encounter tables, got ${totalTables}`);

  const findZone = (nameFragment) => wildEncounters.zones.find((z) => z.name.includes(nameFragment));
  assert.equal(findZone("Mt. Moon").environment, "cave");
  assert.equal(findZone("Cerulean Cave").environment, "cave");
  assert.equal(findZone("Power Plant").environment, "cave");
  assert.equal(findZone("Route 1").environment, "outdoor");
  assert.equal(findZone("Safari Zone").environment, "outdoor");
});

test("Patched evolutions.json and items.json remove trade/non-Kanto evolutions and provide Cordón Unión at ₽3,000", () => {
  for (const chain of evolutionsList) {
    for (const evo of chain.evolutions) {
      assert.equal(evo.targetInKanto, true, `Non-Kanto evolution target leaked: ${chain.speciesKey} -> ${evo.targetSpeciesKey}`);
      assert.notEqual(evo.method, "EVO_TRADE", `Trade evolution leaked on ${chain.speciesKey}`);
      assert.equal(evo.requiresTrade, false, `requiresTrade still true on ${chain.speciesKey}`);
    }
  }

  for (const tradeKey of ["KADABRA", "MACHOKE", "GRAVELER", "HAUNTER"]) {
    const entry = evolutionsList.find((c) => c.speciesKey === tradeKey);
    assert.ok(entry, `Missing evolution entry for ${tradeKey}`);
    assert.equal(entry.evolutions.length, 1);
    assert.equal(entry.evolutions[0].method, "EVO_ITEM");
    assert.equal(entry.evolutions[0].param, "ITEM_LINKING_CORD");
    assert.equal(entry.evolutions[0].item, "LINKING_CORD");
  }

  const linkingCord = itemsMap["LINKING_CORD"];
  assert.ok(linkingCord, "Cordón Unión missing from items.json");
  assert.equal(linkingCord.itemId, "ITEM_LINKING_CORD");
  assert.equal(linkingCord.price, 3000);
  assert.match(linkingCord.description, /Kadabra/);
  assert.match(linkingCord.description, /Haunter/);
});

// ============================================================================
// (B) TYPE EFFECTIVENESS & GEN 3 DAMAGE FORMULA TESTS
// ============================================================================
test("Type chart handles Gen 3 immunities, resistances, 4x weaknesses, and Foresight", () => {
  // Exact immunities
  assert.equal(getTypeEffectiveness("NORMAL", ["GHOST"], typeChart), 0);
  assert.equal(getTypeEffectiveness("FIGHTING", ["GHOST", "POISON"], typeChart), 0);
  assert.equal(getTypeEffectiveness("ELECTRIC", ["GROUND", "ROCK"], typeChart), 0);
  assert.equal(getTypeEffectiveness("PSYCHIC", ["DARK"], typeChart), 0);
  assert.equal(getTypeEffectiveness("POISON", ["STEEL"], typeChart), 0);
  assert.equal(getTypeEffectiveness("GROUND", ["FLYING"], typeChart), 0);

  // Foresight bypasses Normal/Fighting immunity on Ghost
  assert.equal(getTypeEffectiveness("FIGHTING", ["GHOST"], typeChart, { foresight: true }), 1);

  // Levitate grants Ground immunity
  assert.equal(getTypeEffectiveness("GROUND", ["PSYCHIC"], typeChart, { defenderAbility: "LEVITATE" }), 0);

  // 4x and 0.25x dual-type calculations
  assert.equal(getTypeEffectiveness("ROCK", ["FIRE", "FLYING"], typeChart), 4);
  assert.equal(getTypeEffectiveness("ELECTRIC", ["WATER", "FLYING"], typeChart), 4);
  assert.equal(getTypeEffectiveness("GRASS", ["GRASS", "POISON"], typeChart), 0.25);
});

test("Gen 3 damage calculator splits Physical/Special by type, handles STAB, Burn, Crits, and Immunities", () => {
  const snorlax = createBattlePokemon(speciesMap["SNORLAX"], 50, movesMap, { moveKeys: ["BODY_SLAM", "SHADOW_BALL"] });
  const gengar = createBattlePokemon(speciesMap["GENGAR"], 50, movesMap, { moveKeys: ["THUNDERBOLT", "SHADOW_BALL"] });
  const rhydon = createBattlePokemon(speciesMap["RHYDON"], 50, movesMap, { moveKeys: ["EARTHQUAKE", "ROCK_SLIDE"] });
  const charizard = createBattlePokemon(speciesMap["CHARIZARD"], 50, movesMap, { moveKeys: ["FLAMETHROWER"] });

  assert.equal(getMoveCategory(movesMap["SHADOW_BALL"]), "physical"); // Gen 3 Ghost = physical
  assert.equal(getMoveCategory(movesMap["FIRE_PUNCH"]), "special");   // Gen 3 Fire = special
  assert.equal(getMoveCategory(movesMap["THUNDER_WAVE"]), "status");

  // Immunity produces 0 damage (Normal -> Ghost; Electric -> Ground)
  const normalVsGhost = calculateDamage(snorlax, gengar, movesMap["BODY_SLAM"], typeChart, {
    isCrit: false,
    randomFactor: 1.0,
  });
  assert.equal(normalVsGhost.damage, 0);
  assert.equal(normalVsGhost.effectiveness, 0);

  const elecVsGround = calculateDamage(gengar, rhydon, movesMap["THUNDERBOLT"], typeChart, {
    isCrit: false,
    randomFactor: 1.0,
  });
  assert.equal(elecVsGround.damage, 0);
  assert.equal(elecVsGround.effectiveness, 0);

  // Physical Ghost hit against neutral target with Burn vs Healthy
  const hitHealthy = calculateDamage(snorlax, charizard, movesMap["SHADOW_BALL"], typeChart, {
    isCrit: false,
    randomFactor: 1.0,
  });
  snorlax.status = "BURN";
  const hitBurned = calculateDamage(snorlax, charizard, movesMap["SHADOW_BALL"], typeChart, {
    isCrit: false,
    randomFactor: 1.0,
  });
  assert.ok(hitBurned.damage < hitHealthy.damage && hitBurned.damage <= Math.ceil(hitHealthy.damage / 2) + 1);
  snorlax.status = null;

  // Special move is NOT weakened by Burn
  const flamethrowerClean = calculateDamage(charizard, snorlax, movesMap["FLAMETHROWER"], typeChart, {
    isCrit: false,
    randomFactor: 1.0,
  });
  assert.equal(flamethrowerClean.stab, true);
  charizard.status = "BURN";
  const flamethrowerBurned = calculateDamage(charizard, snorlax, movesMap["FLAMETHROWER"], typeChart, {
    isCrit: false,
    randomFactor: 1.0,
  });
  assert.equal(flamethrowerBurned.damage, flamethrowerClean.damage);
  charizard.status = null;

  // Critical hit ignores negative Attack stage & positive Defense stage and doubles damage
  rhydon.statStages.attack = -3;
  snorlax.statStages.defense = 3;
  const weakenedHit = calculateDamage(rhydon, snorlax, movesMap["EARTHQUAKE"], typeChart, {
    isCrit: false,
    randomFactor: 1.0,
  });
  const critHit = calculateDamage(rhydon, snorlax, movesMap["EARTHQUAKE"], typeChart, {
    isCrit: true,
    randomFactor: 1.0,
  });
  assert.ok(critHit.damage > weakenedHit.damage * 4);
});

// ============================================================================
// (C) DYNAMIC LEVEL SCALING TESTS
// ============================================================================
test("Dynamic level scaler computes N_obj from top 3 Pokémon, preserves base floors, and scales Leaders & Trainers", () => {
  const brockTeam = [
    { speciesKey: "GEODUDE", baseLevel: 12 },
    { speciesKey: "SANDSHREW", baseLevel: 12 },
    { speciesKey: "ONIX", baseLevel: 14 },
  ];

  assert.equal(findAceIndex(brockTeam), 2);

  // 1. Minimum floor: player level 5 cannot lower Brock below base 12/14
  const lowScaled = scalePartyLevels(brockTeam, [{ level: 5 }, { level: 5 }], "leader");
  assert.deepEqual(
    lowScaled.map((m) => m.scaledLevel),
    [12, 12, 14]
  );

  // 2. N_obj averages ONLY the top 3 highest-level Pokémon in player's party
  const imbalancedParty = [{ level: 40 }, { level: 38 }, { level: 36 }, { level: 5 }, { level: 4 }];
  assert.equal(calculateTargetLevel(imbalancedParty), 38);

  const scaledBrock = scalePartyLevels(brockTeam, imbalancedParty, "leader");
  assert.deepEqual(
    scaledBrock.map((m) => m.scaledLevel),
    [36, 36, 38] // non-aces = 38 - 2 = 36, Ace (Onix) = 38
  );
  assert.equal(scaledBrock[2].isAce, true);
  assert.equal(scaledBrock[0].isAce, false);

  // 3. Party with fewer than 3 Pokémon
  assert.equal(calculateTargetLevel([{ level: 25 }, { level: 20 }]), 23); // round(22.5) = 23

  // 4. Route Trainer offset (-2 and -3) and base floor protection
  const youngsterTeam = [
    { speciesKey: "RATTATA", baseLevel: 11 },
    { speciesKey: "SPEAROW", baseLevel: 12 },
  ];
  const trainerScaled2 = scalePartyLevels(youngsterTeam, [{ level: 30 }, { level: 28 }, { level: 26 }], "trainer", {
    trainerOffset: 2,
  });
  assert.deepEqual(
    trainerScaled2.map((m) => m.scaledLevel),
    [26, 26]
  );

  const trainerScaled3 = scalePartyLevels(youngsterTeam, [{ level: 30 }, { level: 28 }, { level: 26 }], "trainer", {
    trainerOffset: 3,
  });
  assert.deepEqual(
    trainerScaled3.map((m) => m.scaledLevel),
    [25, 25]
  );

  // 5. Wild encounters never scale dynamically
  const wildScaled = scalePartyLevels([{ speciesKey: "PIDGEY", baseLevel: 3 }], imbalancedParty, "wild");
  assert.equal(wildScaled[0].scaledLevel, 3);

  // 6. Dynamic prize money scales with highest scaled level
  assert.equal(calculateTrainerReward(scaledBrock, 80), 38 * 80);
});

// ============================================================================
// (D) BATTLE AI, CATCHING, ITEMS & ENGINE END-TO-END TESTS
// ============================================================================
test("Battle AI prefers super-effective/KO moves over resisted or immune moves", () => {
  const gengar = createBattlePokemon(speciesMap["GENGAR"], 30, movesMap, {
    moveKeys: ["HYPNOSIS", "LICK", "SHADOW_PUNCH"],
  });
  const charizard = createBattlePokemon(speciesMap["CHARIZARD"], 30, movesMap, {
    moveKeys: ["SCRATCH", "QUICK_ATTACK", "FLAMETHROWER", "WING_ATTACK"],
  });

  // Against Gengar, Normal moves score -9999 (immune), Flamethrower/Wing Attack score high
  const scratchScore = scoreMoveForAI(charizard, gengar, movesMap["SCRATCH"], typeChart, { rng: () => 0.1 });
  const flameScore = scoreMoveForAI(charizard, gengar, movesMap["FLAMETHROWER"], typeChart, { rng: () => 0.1 });
  assert.equal(scratchScore, -9999);
  assert.ok(flameScore > 0);

  const aiChoice = chooseTrainerAction(
    { party: [charizard], activeIndex: 0, reflectTurns: 0, lightScreenTurns: 0 },
    { party: [gengar], activeIndex: 0, reflectTurns: 0, lightScreenTurns: 0 },
    typeChart,
    "leader",
    () => 0.1
  );
  assert.equal(aiChoice.type, "move");
  assert.equal(charizard.moves[aiChoice.moveIndex].key, "FLAMETHROWER");

  // Wild AI returns valid move index
  const wildPick = chooseWildAction(gengar, () => 0.5);
  assert.equal(wildPick.type, "move");
  assert.ok(wildPick.moveIndex >= 0);
});

test("BattleEngine executes wild catch, Poké Ball blocking in trainer battles, healing items, EXP gain, and 3v3 victory", () => {
  // 1. Wild capture flow
  const rngLow = createDeterministicRng([0.05]); // always rolls low enough to hit/catch
  const wildBattle = new BattleEngine({
    playerParty: [{ speciesKey: "PIKACHU", level: 25 }],
    enemyParty: [{ speciesKey: "CHANSEY", baseLevel: 25 }],
    battleType: "wild",
    speciesMap,
    movesMap,
    typeChart,
    itemsMap,
    rng: rngLow,
    safariBoostActive: true,
  });

  const wildChansey = wildBattle.getActive("enemy");
  assert.equal(wildChansey.catchRate, 90);
  const odds = calculateCatchOdds(wildChansey, itemsMap["ULTRA_BALL"], { safariBoostActive: true });
  assert.ok(odds.approxChancePercent > 15);

  // Throw Ultra Ball with favorable low RNG -> catches cleanly
  const catchAttempt = attemptCatch(wildChansey, itemsMap["ULTRA_BALL"], { safariBoostActive: true }, () => 0.01);
  assert.equal(catchAttempt.caught, true);

  wildBattle.executeTurn({ type: "item", itemKey: "ULTRA_BALL" });
  assert.equal(wildBattle.status, "caught");

  // 2. Trainer 3v3 battle: verifies scaling, priority, Potion healing, EXP gain, and trainer ball block
  const gymBattle = new BattleEngine({
    playerParty: [
      { speciesKey: "BLASTOISE", level: 40 },
      { speciesKey: "VENUSAUR", level: 40 },
      { speciesKey: "CHARIZARD", level: 40 },
    ],
    enemyParty: [
      { speciesKey: "GEODUDE", baseLevel: 12 },
      { speciesKey: "SANDSHREW", baseLevel: 12 },
      { speciesKey: "ONIX", baseLevel: 14 },
    ],
    battleType: "leader",
    trainerName: "Líder Brock",
    speciesMap,
    movesMap,
    typeChart,
    itemsMap,
    rng: () => 0.2,
  });

  // Verify Brock scaled to [38, 38, 40]
  assert.deepEqual(
    gymBattle.enemySide.party.map((m) => m.level),
    [38, 38, 40]
  );
  assert.equal(gymBattle.prizeMoney, 40 * 80);

  // Cannot flee or throw Poké Ball against a Gym Leader (does not waste turn)
  const turnBefore = gymBattle.turn;
  gymBattle.executeTurn({ type: "run" });
  assert.equal(gymBattle.status, "active");
  assert.equal(gymBattle.turn, turnBefore);

  gymBattle.executeTurn({ type: "item", itemKey: "POKE_BALL" });
  assert.equal(gymBattle.turn, turnBefore);

  // Play turns until Brock is defeated
  let guard = 0;
  while (gymBattle.status === "active" && guard < 40) {
    guard += 1;
    if (gymBattle.awaitingPlayerSwitch) {
      const nextAlive = gymBattle.playerSide.party.findIndex((m) => m.currentHp > 0);
      gymBattle.forceSwitchPlayer(nextAlive);
      continue;
    }
    const active = gymBattle.getActive("player");
    const waterMoveIdx = active.moves.findIndex((m) => m.type === "WATER" && m.power > 0 && m.currentPp > 0);
    const anyDmgIdx = active.moves.findIndex((m) => m.power > 0 && m.currentPp > 0);
    const chosenIdx = waterMoveIdx >= 0 ? waterMoveIdx : anyDmgIdx >= 0 ? anyDmgIdx : 0;
    gymBattle.executeTurn({ type: "move", moveIndex: chosenIdx });
  }

  assert.equal(gymBattle.status, "player_win");
  assert.ok(gymBattle.playerSide.party[0].exp > getExpForLevel(speciesMap["BLASTOISE"].growthRate, 40));

  // Verify Potion & Revive item mechanics
  const testMon = gymBattle.playerSide.party[0];
  testMon.currentHp = 20;
  const healBattle = new BattleEngine({
    playerParty: [testMon],
    enemyParty: [{ speciesKey: "RATTATA", baseLevel: 5 }],
    battleType: "wild",
    speciesMap,
    movesMap,
    typeChart,
    itemsMap,
    rng: () => 0.99,
  });
  healBattle.executeTurn({ type: "item", itemKey: "POTION", targetIndex: 0 });
  assert.ok(testMon.currentHp >= 30);

  // Verify getLevelFromExp consistency
  assert.equal(getLevelFromExp("MEDIUM_SLOW", getExpForLevel("MEDIUM_SLOW", 36)), 36);
  const bStats = calculatePokemonStats(speciesMap["BULBASAUR"], 50);
  assert.ok(bStats.hp > 100 && bStats.spAttack > 60);
});

test("BattleEngine handles status residual damage, Ground immunity to Thunder Wave, forced switches, Revive, and UI time-of-day cycle", async () => {
  const { detectTimeOfDay } = await import("../js/battle/battleTestUI.js");

  // 1. Day/Evening/Night boundary verification (SPEC_MAESTRA §8.1)
  assert.equal(detectTimeOfDay(new Date(2026, 0, 1, 6, 0)).key, "day");
  assert.equal(detectTimeOfDay(new Date(2026, 0, 1, 16, 59)).key, "day");
  assert.equal(detectTimeOfDay(new Date(2026, 0, 1, 17, 0)).key, "evening");
  assert.equal(detectTimeOfDay(new Date(2026, 0, 1, 19, 59)).key, "evening");
  assert.equal(detectTimeOfDay(new Date(2026, 0, 1, 20, 0)).key, "night");
  assert.equal(detectTimeOfDay(new Date(2026, 0, 1, 5, 59)).key, "night");

  // 2. Electric Thunder Wave blocked by Ground type & Forced Switch + Revive flow
  const battle = new BattleEngine({
    playerParty: [
      { speciesKey: "PIKACHU", level: 10, moveKeys: ["THUNDER_WAVE", "QUICK_ATTACK"] },
      { speciesKey: "BLASTOISE", level: 40, moveKeys: ["SURF"] },
    ],
    enemyParty: [{ speciesKey: "ONIX", baseLevel: 35, moveKeys: ["EARTHQUAKE"] }],
    battleType: "wild",
    speciesMap,
    movesMap,
    typeChart,
    itemsMap,
    rng: () => 0.1,
  });

  // Turn 1: Pikachu uses Thunder Wave -> Onix is GROUND, stays unparalyzed; Onix OHKOs Pikachu -> awaitingPlayerSwitch
  battle.executeTurn({ type: "move", moveIndex: 0 });
  assert.equal(battle.getActive("enemy").status, null);
  assert.equal(battle.playerSide.party[0].currentHp, 0);
  assert.equal(battle.awaitingPlayerSwitch, true);

  // Player switches in Blastoise cleanly, then revives Pikachu
  battle.forceSwitchPlayer(1);
  assert.equal(battle.awaitingPlayerSwitch, false);
  assert.equal(battle.playerSide.activeIndex, 1);

  battle.executeTurn({ type: "item", itemKey: "REVIVE", targetIndex: 0 });
  assert.ok(battle.playerSide.party[0].currentHp > 0);
  assert.equal(battle.playerSide.party[0].status, null);

  // 3. Burn residual tick (1/8 maxHp per turn)
  const snorlax = createBattlePokemon(speciesMap["SNORLAX"], 40, movesMap, { moveKeys: ["REST"] });
  const pidgey = createBattlePokemon(speciesMap["PIDGEY"], 5, movesMap, { moveKeys: ["SPLASH"] });
  snorlax.status = "BURN";
  const initialHp = snorlax.currentHp;
  const statusTickBattle = new BattleEngine({
    playerParty: [snorlax],
    enemyParty: [pidgey],
    battleType: "wild",
    alreadyScaled: true,
    speciesMap,
    movesMap,
    typeChart,
    itemsMap,
    rng: () => 0.5,
  });
  statusTickBattle.executeTurn({ type: "move", moveIndex: 0 }); // Rest resets then heals, wait: Rest cures Burn!
  // Let's test Burn residual without Rest using Growl/Tackle
  snorlax.status = "BURN";
  snorlax.currentHp = initialHp;
  const tick2 = new BattleEngine({
    playerParty: [snorlax],
    enemyParty: [{ ...pidgey }],
    battleType: "wild",
    alreadyScaled: true,
    speciesMap,
    movesMap,
    typeChart,
    itemsMap,
    rng: () => 0.5,
  });
  tick2.playerSide.party[0].moves = [movesMap["SPLASH"]].map((m) => ({ ...m, currentPp: m.pp, maxPp: m.pp }));
  tick2.executeTurn({ type: "move", moveIndex: 0 });
  assert.equal(snorlax.currentHp, initialHp - Math.max(1, Math.floor(snorlax.maxHp / 8)));

  // 4. Verify battle-test.html and stylesheet exist cleanly inside juego-html/
  const rootDir = path.resolve(__dirname, "..");
  const html = fs.readFileSync(path.join(rootDir, "battle-test.html"), "utf8");
  assert.match(html, /css\/battle-test\.css/);
  assert.match(html, /js\/battle\/battleTestUI\.js/);
  assert.ok(fs.existsSync(path.join(rootDir, "css/battle-test.css")));
});

