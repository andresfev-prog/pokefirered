import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BattleEngine, buildDataMaps, createBattlePokemon } from "../js/battle/battleEngine.js";
import { filterEncountersByTimeAndEnv, getEffectiveSafariFleeRate } from "../js/overworld/encounterManager.js";
import {
  addBagItem,
  addPokemonToPartyOrBox,
  evolvePokemonWithItem,
  formatEvolutionGuide,
  getPokedexStats,
  markCaptured,
  useOverworldItem,
} from "../js/game/pokemonProgress.js";
import {
  INITIAL_MONEY,
  SLOT_STORAGE_KEYS,
  deleteSlot,
  exportSaveJson,
  importSaveJson,
  listSaveSlots,
  loadFromSlot,
  saveToSlot,
  validateSaveSchema,
} from "../js/game/saveManager.js";
import {
  GRAND_PRIX_P1_ROUNDS,
  GYM_LEADERS,
  awardGymBadge,
  buyMartItem,
  canTriggerAshEvent,
  checkGrandPrixEligibility,
  completeAshBulbasaurWithPotion,
  completeGrandPrixP1,
  completeSafariRace,
  createCampaignNewGame,
  getGaryEeveeEvolution,
  getMartCatalog,
  getStoryOverlayNpcsForMap,
  grantAshEventPokemon,
  recordRivalBattleOutcome,
} from "../js/game/storyEvents.js";
import {
  FRONTIER_BRAINS,
  LEAGUE_TOURNAMENT_ROUNDS,
  awardFrontierSymbol,
  canChallengeEliteFour,
  canChallengeLeague,
  checkFrontierBrainUnlock,
  completeEliteFour,
  getChampionRivalChallenge,
  getEliteFourSequence,
  onTournamentRoundVictory,
} from "../js/game/leagueAndFrontier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");

function loadGameFixtures() {
  const species = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/species.json"), "utf8"));
  const moves = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/moves.json"), "utf8"));
  const items = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/items.json"), "utf8"));
  const evolutions = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/evolutions.json"), "utf8"));
  const typeChart = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/type_chart.json"), "utf8"));
  const wildEncounters = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data/wild_encounters.json"), "utf8"));

  const dataMaps = buildDataMaps({ species, moves, items });
  const speciesByKey = Object.fromEntries(species.map((s) => [s.key, s]));
  const evolutionsByKey = Object.fromEntries(evolutions.map((e) => [e.speciesKey, e]));
  const evolutionsById = Object.fromEntries(evolutions.map((e) => [e.speciesId, e]));
  const wildZonesByMapId = Object.fromEntries(wildEncounters.zones.map((z) => [z.mapId, z]));

  return {
    species,
    moves,
    items,
    evolutions,
    typeChart,
    wildEncounters,
    dataMaps,
    speciesByKey,
    evolutionsByKey,
    evolutionsById,
    wildZonesByMapId,
  };
}

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

test("1. Sistema de Guardado Dual: 3 ranuras independientes, ₽5,000 iniciales y Export/Import JSON validado", () => {
  const { dataMaps } = loadGameFixtures();
  const storage = createMemoryStorage();

  const ashGame = createCampaignNewGame({
    slot: 1,
    protagonist: "ash",
    playerName: "Ash",
    dataMaps,
  });
  const garyGame = createCampaignNewGame({
    slot: 2,
    protagonist: "gary",
    playerName: "Gary",
    chosenStarterKey: "CHARMANDER",
    dataMaps,
  });
  const leafGame = createCampaignNewGame({
    slot: 3,
    protagonist: "leaf",
    playerName: "Leaf",
    chosenStarterKey: "SQUIRTLE",
    dataMaps,
  });

  assert.equal(ashGame.money, INITIAL_MONEY);
  assert.equal(ashGame.money, 5000);

  saveToSlot(1, ashGame, storage);
  saveToSlot(2, garyGame, storage);
  saveToSlot(3, leafGame, storage);

  assert.ok(storage.getItem(SLOT_STORAGE_KEYS[1]));
  assert.ok(storage.getItem(SLOT_STORAGE_KEYS[2]));
  assert.ok(storage.getItem(SLOT_STORAGE_KEYS[3]));

  const slotsList = listSaveSlots(storage);
  assert.equal(slotsList.length, 3);
  assert.equal(slotsList[0].summary.playerName, "Ash");
  assert.equal(slotsList[1].summary.playerName, "Gary");
  assert.equal(slotsList[2].summary.playerName, "Leaf");

  // Borrar ranura 2 NO afecta 1 ni 3
  deleteSlot(2, storage);
  assert.equal(loadFromSlot(2, storage, dataMaps), null);
  assert.equal(loadFromSlot(1, storage, dataMaps).playerName, "Ash");
  assert.equal(loadFromSlot(3, storage, dataMaps).playerName, "Leaf");

  // Exportar partida de Ash e importar en Ranura 2
  const exportedStr = exportSaveJson(ashGame);
  const importRes = importSaveJson(exportedStr, 2, storage, dataMaps);
  assert.equal(importRes.ok, true);
  assert.equal(loadFromSlot(2, storage, dataMaps).playerName, "Ash");

  // Rechazar JSON inválido o con esquema alterado sin dañar ninguna ranura
  const badJsonRes = importSaveJson("{ corrupt json !!!", 2, storage, dataMaps);
  assert.equal(badJsonRes.ok, false);

  const badSchema = JSON.stringify({
    protagonist: "misty_invalid",
    playerName: "Test",
    money: -999,
  });
  const badSchemaRes = importSaveJson(badSchema, 2, storage, dataMaps);
  assert.equal(badSchemaRes.ok, false);
  assert.equal(validateSaveSchema(JSON.parse(badSchema)).valid, false);
  // Ranura 2 sigue intacta con el último guardado válido
  assert.equal(loadFromSlot(2, storage, dataMaps).playerName, "Ash");
});

test("2. Bifurcación de Campaña (Ash / Gary / Leaf), evolución dinámica de Eevee y eventos exclusivos de Ash", () => {
  const { dataMaps } = loadGameFixtures();

  const ash = createCampaignNewGame({ protagonist: "ash", playerName: "Ash", dataMaps });
  assert.equal(ash.mode, "anime");
  assert.equal(ash.party[0].speciesKey, "PIKACHU");
  assert.equal(ash.flags.rivalCharacter, "gary");
  assert.equal(ash.flags.rivalStarterKey, "EEVEE");

  // Evolución de Eevee de Gary según victorias/derrotas
  assert.equal(getGaryEeveeEvolution(ash), "EEVEE");
  recordRivalBattleOutcome(ash, true);
  recordRivalBattleOutcome(ash, true);
  assert.equal(getGaryEeveeEvolution(ash), "JOLTEON");
  recordRivalBattleOutcome(ash, false);
  assert.equal(getGaryEeveeEvolution(ash), "FLAREON");

  const gary = createCampaignNewGame({
    protagonist: "gary",
    playerName: "Gary",
    chosenStarterKey: "BULBASAUR",
    dataMaps,
  });
  assert.equal(gary.mode, "classic");
  assert.equal(gary.party[0].speciesKey, "BULBASAUR");
  assert.equal(gary.flags.rivalCharacter, "ash");
  assert.equal(gary.flags.rivalStarterKey, "PIKACHU");

  const leaf = createCampaignNewGame({
    protagonist: "leaf",
    playerName: "Leaf",
    chosenStarterKey: "CHARMANDER",
    dataMaps,
  });
  assert.equal(leaf.mode, "classic");
  assert.equal(leaf.party[0].speciesKey, "CHARMANDER");
  assert.equal(leaf.flags.rivalCharacter, "gary");
  assert.equal(leaf.flags.rivalStarterKey, "SQUIRTLE");

  // Eventos exclusivos de Ash NO accesibles para Gary o Leaf
  assert.equal(canTriggerAshEvent("ash_bulbasaur", gary).allowed, false);
  assert.equal(canTriggerAshEvent("ash_charmander", leaf).allowed, false);
  assert.equal(canTriggerAshEvent("ash_squirtle", leaf).allowed, false);
  assert.equal(
    getStoryOverlayNpcsForMap({ id: "MAP_CERULEAN_CITY" }, leaf, FRONTIER_BRAINS).some(
      (n) => n.eventType === "ash_bulbasaur"
    ),
    false
  );

  // En ruta de Ash SÍ están disponibles y otorgan Bulbasaur, Charmander y Squirtle
  const resBulb = completeAshBulbasaurWithPotion(ash, dataMaps);
  assert.equal(resBulb.ok, true);
  assert.equal(ash.flags.ashBulbasaurObtained, true);

  const resChar = grantAshEventPokemon("ash_charmander", ash, dataMaps);
  assert.equal(resChar.ok, true);
  assert.equal(ash.flags.ashCharmanderObtained, true);

  const resSquir = grantAshEventPokemon("ash_squirtle", ash, dataMaps);
  assert.equal(resSquir.ok, true);
  assert.equal(ash.flags.ashSquirtleObtained, true);

  const keys = ash.party.map((p) => p.speciesKey);
  assert.deepEqual(keys, ["PIKACHU", "BULBASAUR", "CHARMANDER", "SQUIRTLE"]);
});

test("3. Grand Prix P1 (requisito tipo FIGHTING) y Carrera Zona Safari (bono permanente de encuentro y huida)", () => {
  const { dataMaps, speciesByKey, wildZonesByMapId } = loadGameFixtures();
  const state = createCampaignNewGame({ protagonist: "ash", playerName: "Ash", dataMaps });

  // Sin tipo FIGHTING -> rechazado en Grand Prix P1
  const rejected = checkGrandPrixEligibility(state, speciesByKey);
  assert.equal(rejected.eligible, false);
  assert.match(rejected.message, /FIGHTING/);

  // Añadir Primeape (FIGHTING) -> aceptado -> ganar P1
  const primeape = createBattlePokemon(speciesByKey.PRIMEAPE, 38, dataMaps.movesMap);
  addPokemonToPartyOrBox(state, primeape);
  const accepted = checkGrandPrixEligibility(state, speciesByKey);
  assert.equal(accepted.eligible, true);
  assert.equal(GRAND_PRIX_P1_ROUNDS.length, 3);
  completeGrandPrixP1(state);
  assert.equal(state.flags.wonGrandPrixP1, true);

  // Carrera de la Zona Safari -> efecto permanente en probabilidad rara y tasa de huida
  const chansey = speciesByKey.CHANSEY;
  const beforeFlee = getEffectiveSafariFleeRate(chansey, false);
  const beforeSafari = filterEncountersByTimeAndEnv({
    zone: wildZonesByMapId.MAP_SAFARI_ZONE_CENTER,
    method: "land",
    speciesByKey,
    timeKey: "day",
    safariRaceWon: false,
  });
  const beforeRareChance = beforeSafari.entries.find((e) => e.speciesKey === "CHANSEY").effectiveChance;

  completeSafariRace(state);
  assert.equal(state.flags.safariRaceWon, true);

  const afterFlee = getEffectiveSafariFleeRate(chansey, state.flags.safariRaceWon);
  const afterSafari = filterEncountersByTimeAndEnv({
    zone: wildZonesByMapId.MAP_SAFARI_ZONE_CENTER,
    method: "land",
    speciesByKey,
    timeKey: "day",
    safariRaceWon: true,
  });
  const afterRareChance = afterSafari.entries.find((e) => e.speciesKey === "CHANSEY").effectiveChance;

  assert.ok(afterFlee < beforeFlee, `Esperado ${afterFlee} < ${beforeFlee}`);
  assert.ok(afterRareChance > beforeRareChance, `Esperado ${afterRareChance}% > ${beforeRareChance}%`);
});

test("4. Liga Pokémon (Torneo 5 rondas con autocuración + desbloqueo permanente Etapa 2) y los 7 Ases de la Frontera", () => {
  const { dataMaps, speciesByKey, typeChart } = loadGameFixtures();
  const state = createCampaignNewGame({ protagonist: "ash", playerName: "Ash", dataMaps });

  // Con < 8 medallas no entra a la Liga
  assert.equal(canChallengeLeague(state).allowed, false);

  // Otorgar las 8 Medallas de Kanto
  for (const gym of GYM_LEADERS) {
    awardGymBadge(state, gym);
  }
  assert.equal(state.badges.length, 8);
  assert.equal(canChallengeLeague(state).allowed, true);
  assert.equal(canChallengeEliteFour(state).allowed, false);

  // Daño artificial en equipo + ronda 1 del torneo -> autocuración tras ganar ronda
  state.party[0].currentHp = 2;
  state.party[0].status = "PARALYSIS";
  assert.equal(LEAGUE_TOURNAMENT_ROUNDS.length, 5);

  const r1 = onTournamentRoundVictory(state, 1, dataMaps.movesMap);
  assert.equal(r1.tournamentCompleted, false);
  assert.equal(state.party[0].currentHp, state.party[0].maxHp);
  assert.equal(state.party[0].status, null);

  // Completar ronda 5 -> desbloqueo permanente del Alto Mando
  const r5 = onTournamentRoundVictory(state, 5, dataMaps.movesMap);
  assert.equal(r5.tournamentCompleted, true);
  assert.equal(state.flags.wonLeagueTournament, true);
  assert.equal(state.flags.unlockedEliteFour, true);
  assert.equal(canChallengeEliteFour(state).allowed, true);

  // Antes de ser Campeón, los 7 Ases están bloqueados
  assert.equal(checkFrontierBrainUnlock("noland", state).unlocked, false);

  // Simular victoria en Etapa 2 (Alto Mando + Campeón)
  const e4Seq = getEliteFourSequence(state);
  assert.equal(e4Seq.length, 5);
  assert.match(getChampionRivalChallenge(state).trainerName, /Gary/);
  completeEliteFour(state);
  assert.equal(state.flags.isChampion, true);
  assert.equal(state.flags.wonEliteFour, true);

  // Comprobar reglas de desbloqueo de los 7 Ases de la Frontera
  assert.equal(checkFrontierBrainUnlock("tucker", state).unlocked, true); // Ya ganó Torneo
  assert.equal(checkFrontierBrainUnlock("anabel", state).unlocked, true); // Ya ganó Alto Mando

  // Noland requiere 30 especies capturadas
  assert.equal(checkFrontierBrainUnlock("noland", state).unlocked, false);
  for (let id = 1; id <= 30; id++) markCaptured(state, id);
  assert.equal(checkFrontierBrainUnlock("noland", state).unlocked, true);

  // Greta requiere Grand Prix P1
  assert.equal(checkFrontierBrainUnlock("greta", state).unlocked, false);
  state.flags.wonGrandPrixP1 = true;
  assert.equal(checkFrontierBrainUnlock("greta", state).unlocked, true);

  // Lucy requiere Carrera Zona Safari
  assert.equal(checkFrontierBrainUnlock("lucy", state).unlocked, false);
  state.flags.safariRaceWon = true;
  assert.equal(checkFrontierBrainUnlock("lucy", state).unlocked, true);

  // Spenser requiere Ave Legendaria (ej. Articuno #144)
  assert.equal(checkFrontierBrainUnlock("spenser", state).unlocked, false);
  markCaptured(state, 144);
  assert.equal(checkFrontierBrainUnlock("spenser", state).unlocked, true);

  // Brandon requiere derrotar primero a los otros 6 Ases
  assert.equal(checkFrontierBrainUnlock("brandon", state).unlocked, false);
  for (const id of ["noland", "greta", "tucker", "lucy", "spenser", "anabel"]) {
    awardFrontierSymbol(state, id);
  }
  assert.equal(checkFrontierBrainUnlock("brandon", state).unlocked, true);

  // Comprobar motor estándar con escalado dinámico para un As (Brandon)
  state.party = [
    createBattlePokemon(speciesByKey.CHARIZARD, 75, dataMaps.movesMap),
    createBattlePokemon(speciesByKey.PIKACHU, 75, dataMaps.movesMap),
    createBattlePokemon(speciesByKey.DRAGONITE, 75, dataMaps.movesMap),
  ];
  const brandon = FRONTIER_BRAINS.find((b) => b.id === "brandon");
  const frontierBattle = new BattleEngine({
    playerParty: state.party,
    enemyParty: brandon.party,
    battleType: "leader",
    trainerName: `${brandon.title} ${brandon.name}`,
    speciesMap: dataMaps.speciesMap,
    movesMap: dataMaps.movesMap,
    typeChart,
    itemsMap: dataMaps.itemsMap,
  });
  const bState = frontierBattle.getState();
  // Su Pokémon estrella (Moltres base 70) escala dinámicamente a N_obj = 75
  const moltres = bState.enemySide.party.find((m) => m.speciesKey === "MOLTRES");
  assert.equal(moltres.level, 75);
});

test("5. Tienda con Cordón Unión (₽3,000), evolución sin intercambio y actualización automática de Pokédex", () => {
  const { items, dataMaps, speciesByKey, evolutionsByKey, evolutionsById } = loadGameFixtures();
  const state = createCampaignNewGame({ protagonist: "ash", playerName: "Ash", dataMaps });
  state.money = 10000;

  const catalog = getMartCatalog(items);
  const cord = catalog.find((i) => i.key === "LINKING_CORD");
  assert.ok(cord, "El catálogo debe incluir LINKING_CORD");
  assert.equal(cord.price, 3000);
  assert.match(cord.evolutionSummary, /Kadabra -> Alakazam/);

  // Comprar 2 Cordones Unión y usar uno en Kadabra
  const buyRes = buyMartItem(state, "LINKING_CORD", 2, dataMaps.itemsMap);
  assert.equal(buyRes.ok, true);
  assert.equal(state.money, 4000);

  const kadabra = createBattlePokemon(speciesByKey.KADABRA, 36, dataMaps.movesMap);
  state.party.push(kadabra);
  const idx = state.party.length - 1;
  const dexBefore = getPokedexStats(state).capturedCount;

  const evoRes = evolvePokemonWithItem(state, idx, "LINKING_CORD", dataMaps, evolutionsByKey);
  assert.equal(evoRes.ok, true);
  assert.equal(evoRes.evolvedTo, "Alakazam");
  assert.equal(state.party[idx].speciesKey, "ALAKAZAM");
  assert.equal(state.bag.LINKING_CORD, 1);
  assert.equal(getPokedexStats(state).capturedCount, dexBefore + 1);

  // Verificar guía de evolución y uso directo desde mochila (Piedra Trueno -> Raichu)
  const guide = formatEvolutionGuide("KADABRA", evolutionsByKey, evolutionsById, speciesByKey);
  assert.match(guide, /Cordón Unión/);
  assert.doesNotMatch(guide, /intercambio requerido/i);

  addBagItem(state, "THUNDER_STONE", 1);
  const pikachuIdx = 0;
  const raichuRes = useOverworldItem(state, "THUNDER_STONE", pikachuIdx, dataMaps, evolutionsByKey);
  assert.equal(raichuRes.ok, true);
  assert.equal(state.party[pikachuIdx].speciesKey, "RAICHU");
});

test("6. Integridad de IDs del DOM en index.html / mainApp.js y especies válidas en todos los encuentros", () => {
  const { speciesByKey } = loadGameFixtures();
  const html = fs.readFileSync(path.join(WEB_ROOT, "index.html"), "utf8");
  const mainJs = fs.readFileSync(path.join(WEB_ROOT, "js/game/mainApp.js"), "utf8");
  const storyJs = fs.readFileSync(path.join(WEB_ROOT, "js/game/storyEvents.js"), "utf8");
  const leagueJs = fs.readFileSync(path.join(WEB_ROOT, "js/game/leagueAndFrontier.js"), "utf8");

  const referencedIds = [...mainJs.matchAll(/id\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(referencedIds.length >= 60);
  for (const id of referencedIds) {
    assert.ok(html.includes(`id="${id}"`), `Falta id="${id}" en index.html`);
  }

  for (const src of [storyJs, leagueJs]) {
    for (const m of src.matchAll(/speciesKey:\s*"([A-Z0-9_]+)"/g)) {
      assert.ok(speciesByKey[m[1]], `Especie inválida "${m[1]}" en equipo de entrenador`);
    }
  }
});
