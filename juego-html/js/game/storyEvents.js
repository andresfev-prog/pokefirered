/**
 * Campañas (Ash / Gary / Leaf), Eventos Anime Exclusivos, Gimnasios,
 * Grand Prix P1 y Carrera de la Zona Safari (Fase 4 — SPEC_MAESTRA §§2, 4, 8).
 */

import { createBattlePokemon } from "../battle/battleEngine.js";
import { scalePartyLevels } from "../battle/levelScaler.js";
import {
  addBagItem,
  addPokemonToPartyOrBox,
  consumeBagItem,
  getBagItemCount,
  healPartyFull,
  markCaptured,
  normalizeItemKey,
} from "./pokemonProgress.js";
import { createEmptyGameState } from "./saveManager.js";

export const STARTER_KEYS = ["BULBASAUR", "CHARMANDER", "SQUIRTLE"];

export const TYPE_COUNTER_STARTER = {
  BULBASAUR: "CHARMANDER",
  CHARMANDER: "SQUIRTLE",
  SQUIRTLE: "BULBASAUR",
};

export const PROTAGONIST_PROFILES = {
  ash: {
    id: "ash",
    title: "Ash (Modo Anime)",
    defaultName: "Ash",
    spriteFile: "assets/sprites/characters/ash.png",
    starterLabel: "Pikachu (llegas tarde al Laboratorio)",
    rivalName: "Gary",
    rivalStarterLabel: "Eevee (evoluciona según duelos)",
    mode: "anime",
    description:
      "Llegas tarde al laboratorio del Prof. Oak y recibes un Pikachu especial. Desbloquea eventos anime en Ciudad Celeste, Ruta 24 y Ciudad Carmín.",
  },
  gary: {
    id: "gary",
    title: "Gary (Modo Clásico)",
    defaultName: "Gary",
    spriteFile: "assets/sprites/characters/gary.png",
    starterLabel: "Bulbasaur / Charmander / Squirtle",
    rivalName: "Ash",
    rivalStarterLabel: "Pikachu",
    mode: "classic",
    description:
      "Elige tu inicial libremente en el laboratorio de Oak. Ash llega tarde y recibe a Pikachu. Progresión clásica FRLG.",
  },
  leaf: {
    id: "leaf",
    title: "Leaf (Modo Clásico)",
    defaultName: "Leaf",
    spriteFile: "assets/sprites/characters/leaf.png",
    starterLabel: "Bulbasaur / Charmander / Squirtle",
    rivalName: "Gary",
    rivalStarterLabel: "Inicial con ventaja de tipo",
    mode: "classic",
    description:
      "Elige tu inicial favorito. Tu rival Gary escogerá el Pokémon inicial con ventaja de tipo sobre el tuyo.",
  },
};

export const GYM_LEADERS = [
  {
    id: "brock",
    order: 1,
    name: "Líder Brock",
    city: "Ciudad Plateada",
    mapId: "MAP_PEWTER_CITY_GYM",
    specialty: "ROCA",
    badgeId: "BADGE_BOULDER",
    badgeName: "Medalla Roca",
    spriteFile: "assets/sprites/characters/npcs/brock.png",
    party: [
      { speciesKey: "GEODUDE", baseLevel: 12 },
      { speciesKey: "ONIX", baseLevel: 14 },
    ],
    introDialogue:
      "¡Soy Brock, Líder del Gimnasio de Ciudad Plateada! Mi defensa de tipo Roca es tan dura como una montaña.",
    victoryDialogue:
      "¡Tu estrategia rompió mi defensa! Recibe la Medalla Roca como prueba de tu victoria.",
  },
  {
    id: "misty",
    order: 2,
    name: "Líder Misty",
    city: "Ciudad Celeste",
    mapId: "MAP_CERULEAN_CITY_GYM",
    specialty: "AGUA",
    badgeId: "BADGE_CASCADE",
    badgeName: "Medalla Cascada",
    spriteFile: "assets/sprites/characters/npcs/misty.png",
    party: [
      { speciesKey: "STARYU", baseLevel: 18 },
      { speciesKey: "STARMIE", baseLevel: 21 },
    ],
    introDialogue:
      "¡Hola! Soy Misty, la belleza marina de Ciudad Celeste. ¡Mi ofensiva de tipo Agua no se detiene!",
    victoryDialogue:
      "¡Guau, eres realmente fuerte! Toma la Medalla Cascada, te la has ganado.",
  },
  {
    id: "lt_surge",
    order: 3,
    name: "Teniente Surge",
    city: "Ciudad Carmín",
    mapId: "MAP_VERMILION_CITY_GYM",
    specialty: "ELÉCTRICO",
    badgeId: "BADGE_THUNDER",
    badgeName: "Medalla Trueno",
    spriteFile: "assets/sprites/characters/npcs/lt_surge.png",
    party: [
      { speciesKey: "VOLTORB", baseLevel: 21 },
      { speciesKey: "PIKACHU", baseLevel: 18 },
      { speciesKey: "RAICHU", baseLevel: 24 },
    ],
    introDialogue:
      "¡Atención, recluta! ¡Mis Pokémon eléctricos paralizaron a todos mis rivales en el frente!",
    victoryDialogue:
      "¡Impactante combate, soldado! Aquí tienes la Medalla Trueno.",
  },
  {
    id: "erika",
    order: 4,
    name: "Líder Erika",
    city: "Ciudad Azulona",
    mapId: "MAP_CELADON_CITY_GYM",
    specialty: "PLANTA",
    badgeId: "BADGE_RAINBOW",
    badgeName: "Medalla Arcoíris",
    spriteFile: "assets/sprites/characters/npcs/erika.png",
    party: [
      { speciesKey: "VICTREEBEL", baseLevel: 29 },
      { speciesKey: "TANGELA", baseLevel: 24 },
      { speciesKey: "VILEPLUME", baseLevel: 29 },
    ],
    introDialogue:
      "Qué tarde tan apacible... Soy Erika, y cuido con esmero a los Pokémon de tipo Planta.",
    victoryDialogue:
      "Has demostrado gran respeto y habilidad. Acepta la Medalla Arcoíris.",
  },
  {
    id: "koga",
    order: 5,
    name: "Líder Koga",
    city: "Ciudad Fucsia",
    mapId: "MAP_FUCHSIA_CITY_GYM",
    specialty: "VENENO",
    badgeId: "BADGE_SOUL",
    badgeName: "Medalla Alma",
    spriteFile: "assets/sprites/characters/npcs/koga.png",
    party: [
      { speciesKey: "KOFFING", baseLevel: 37 },
      { speciesKey: "MUK", baseLevel: 39 },
      { speciesKey: "KOFFING", baseLevel: 37 },
      { speciesKey: "WEEZING", baseLevel: 43 },
    ],
    introDialogue:
      "¡Fwahahaha! ¡Ningún intruso logra esquivar las técnicas ninja de veneno de Ciudad Fucsia!",
    victoryDialogue:
      "Tu espíritu brilla más que mis toxinas. Toma la Medalla Alma.",
  },
  {
    id: "sabrina",
    order: 6,
    name: "Líder Sabrina",
    city: "Ciudad Azafrán",
    mapId: "MAP_SAFFRON_CITY_GYM",
    specialty: "PSÍQUICO",
    badgeId: "BADGE_MARSH",
    badgeName: "Medalla Pantano",
    spriteFile: "assets/sprites/characters/npcs/sabrina.png",
    party: [
      { speciesKey: "KADABRA", baseLevel: 38 },
      { speciesKey: "MR_MIME", baseLevel: 37 },
      { speciesKey: "VENOMOTH", baseLevel: 38 },
      { speciesKey: "ALAKAZAM", baseLevel: 43 },
    ],
    introDialogue:
      "Tuve una visión de tu llegada... Veamos si tu lazo con tus Pokémon supera mi poder psíquico.",
    victoryDialogue:
      "No pude prever tu determinación. La Medalla Pantano es tuya.",
  },
  {
    id: "blaine",
    order: 7,
    name: "Líder Blaine",
    city: "Isla Canela",
    mapId: "MAP_CINNABAR_ISLAND_GYM",
    specialty: "FUEGO",
    badgeId: "BADGE_VOLCANO",
    badgeName: "Medalla Volcán",
    spriteFile: "assets/sprites/characters/npcs/blaine.png",
    party: [
      { speciesKey: "GROWLITHE", baseLevel: 42 },
      { speciesKey: "PONYTA", baseLevel: 40 },
      { speciesKey: "RAPIDASH", baseLevel: 42 },
      { speciesKey: "ARCANINE", baseLevel: 47 },
    ],
    introDialogue:
      "¡Ja! ¡Espero que traigas Antiquemar! ¡El fuego volcánico de Isla Canela va a arder!",
    victoryDialogue:
      "¡Me has dejado hecho cenizas! ¡Toma con orgullo la Medalla Volcán!",
  },
  {
    id: "giovanni",
    order: 8,
    name: "Líder Giovanni",
    city: "Ciudad Verde",
    mapId: "MAP_VIRIDIAN_CITY_GYM",
    specialty: "TIERRA",
    badgeId: "BADGE_EARTH",
    badgeName: "Medalla Tierra",
    spriteFile: "assets/sprites/characters/npcs/giovanni.png",
    party: [
      { speciesKey: "RHYHORN", baseLevel: 45 },
      { speciesKey: "DUGTRIO", baseLevel: 42 },
      { speciesKey: "NIDOQUEEN", baseLevel: 44 },
      { speciesKey: "NIDOKING", baseLevel: 45 },
      { speciesKey: "RHYDON", baseLevel: 50 },
    ],
    introDialogue:
      "¡Bienvenido a mi gimnasio! Como líder supremo, enfrentarás el poder definitivo de tipo Tierra.",
    victoryDialogue:
      "Has demostrado una fuerza digna de la Meseta Añil. Recibe la Medalla Tierra.",
  },
];

export const GYM_BY_MAP_ID = Object.fromEntries(GYM_LEADERS.map((g) => [g.mapId, g]));

export const GRAND_PRIX_P1_ROUNDS = [
  {
    round: 1,
    trainerName: "P1 R1: Anthony",
    party: [
      { speciesKey: "MANKEY", baseLevel: 28 },
      { speciesKey: "HITMONCHAN", baseLevel: 30 },
    ],
  },
  {
    round: 2,
    trainerName: "P1 Semifinal: Maestro Shiro",
    party: [
      { speciesKey: "MACHOKE", baseLevel: 32 },
      { speciesKey: "POLIWRATH", baseLevel: 33 },
    ],
  },
  {
    round: 3,
    trainerName: "P1 Final: Campeón Hitmonlee",
    party: [
      { speciesKey: "PRIMEAPE", baseLevel: 34 },
      { speciesKey: "HITMONCHAN", baseLevel: 35 },
      { speciesKey: "HITMONLEE", baseLevel: 37 },
    ],
  },
];

export const SAFARI_RACE_OPPONENT = {
  trainerName: "Corredor Safari Jack",
  party: [
    { speciesKey: "DODRIO", baseLevel: 28 },
    { speciesKey: "TAUROS", baseLevel: 31 },
    { speciesKey: "KANGASKHAN", baseLevel: 33 },
  ],
};

export const KANTO_HUBS = [
  { id: "pallet_lab", name: "Lab. Prof. Oak (Inicio)", mapId: "MAP_PALLET_TOWN_PROFESSOR_OAKS_LAB", x: 6, y: 6, category: "story" },
  { id: "pallet", name: "Pueblo Paleta", mapId: "MAP_PALLET_TOWN", x: 6, y: 8, category: "town" },
  { id: "viridian_gym", name: "Ciudad Verde (Gimnasio 8 + R.2)", mapId: "MAP_VIRIDIAN_CITY_GYM", x: 3, y: 5, category: "gym" },
  { id: "pewter_gym", name: "Ciudad Plateada (Gimnasio 1: Brock)", mapId: "MAP_PEWTER_CITY_GYM", x: 6, y: 8, category: "gym" },
  { id: "cerulean", name: "Ciudad Celeste (Aldea Bulbasaur / Noland)", mapId: "MAP_CERULEAN_CITY", x: 19, y: 20, category: "event" },
  { id: "cerulean_gym", name: "Ciudad Celeste (Gimnasio 2: Misty)", mapId: "MAP_CERULEAN_CITY_GYM", x: 8, y: 9, category: "gym" },
  { id: "route24", name: "Ruta 24 (Rescate Charmander)", mapId: "MAP_ROUTE24", x: 12, y: 19, category: "event" },
  { id: "vermilion", name: "Ciudad Carmín (Escuadrón Squirtle)", mapId: "MAP_VERMILION_CITY", x: 24, y: 26, category: "event" },
  { id: "vermilion_gym", name: "Ciudad Carmín (Gimnasio 3: Lt. Surge)", mapId: "MAP_VERMILION_CITY_GYM", x: 5, y: 5, category: "gym" },
  { id: "celadon_gym", name: "Ciudad Azulona (Gimnasio 4: Erika)", mapId: "MAP_CELADON_CITY_GYM", x: 6, y: 7, category: "gym" },
  { id: "lavender", name: "Pueblo Lavanda (Tucker)", mapId: "MAP_LAVENDER_TOWN", x: 10, y: 10, category: "frontier" },
  { id: "fuchsia", name: "Ciudad Fucsia (Grand Prix P1)", mapId: "MAP_FUCHSIA_CITY", x: 23, y: 10, category: "event" },
  { id: "fuchsia_gym", name: "Ciudad Fucsia (Gimnasio 5: Koga)", mapId: "MAP_FUCHSIA_CITY_GYM", x: 7, y: 15, category: "gym" },
  { id: "safari_center", name: "Zona Safari (Carrera Safari)", mapId: "MAP_SAFARI_ZONE_CENTER", x: 26, y: 29, category: "event" },
  { id: "saffron", name: "Ciudad Azafrán (Anabel)", mapId: "MAP_SAFFRON_CITY", x: 33, y: 33, category: "frontier" },
  { id: "saffron_gym", name: "Ciudad Azafrán (Gimnasio 6: Sabrina)", mapId: "MAP_SAFFRON_CITY_GYM", x: 14, y: 13, category: "gym" },
  { id: "route2_greta", name: "Ruta 2 (Greta)", mapId: "MAP_ROUTE2", x: 16, y: 67, category: "frontier" },
  { id: "route15_lucy", name: "Ruta 15 (Lucy)", mapId: "MAP_ROUTE15", x: 16, y: 12, category: "frontier" },
  { id: "cinnabar_gym", name: "Isla Canela (Gimnasio 7: Blaine)", mapId: "MAP_CINNABAR_ISLAND_GYM", x: 5, y: 7, category: "gym" },
  { id: "seafoam", name: "Islas Espuma (Spenser / Articuno)", mapId: "MAP_SEAFOAM_ISLANDS_1F", x: 9, y: 16, category: "frontier" },
  { id: "indigo_plateau", name: "Meseta Añil (Liga Pokémon)", mapId: "MAP_INDIGO_PLATEAU_POKEMON_CENTER_1F", x: 11, y: 14, category: "league" },
  { id: "cerulean_cave", name: "Cueva Celeste (Brandon)", mapId: "MAP_CERULEAN_CAVE_1F", x: 36, y: 15, category: "frontier" },
];

/**
 * Inicia una partida nueva bifurcando campaña, rival e inicial según protagonista.
 */
export function createCampaignNewGame({
  slot = 1,
  protagonist = "ash",
  playerName = "",
  chosenStarterKey = null,
  dataMaps,
} = {}) {
  const state = createEmptyGameState({
    slot,
    protagonist,
    playerName,
    mapId: "MAP_PALLET_TOWN_PROFESSOR_OAKS_LAB",
    mapName: "Lab. Prof. Oak",
    x: 6,
    y: 6,
    facing: "up",
  });

  if (!dataMaps?.speciesMap || !dataMaps?.movesMap) {
    throw new Error("createCampaignNewGame requiere dataMaps con speciesMap y movesMap.");
  }

  let starterKey = "PIKACHU";
  if (state.protagonist === "ash") {
    // Ash llega tarde -> siempre Pikachu; Rival Gary -> Eevee
    starterKey = "PIKACHU";
    state.flags.rivalCharacter = "gary";
    state.flags.rivalStarterKey = "EEVEE";
  } else if (state.protagonist === "gary") {
    if (!STARTER_KEYS.includes(chosenStarterKey)) {
      throw new Error("Gary debe elegir entre BULBASAUR, CHARMANDER o SQUIRTLE.");
    }
    starterKey = chosenStarterKey;
    state.flags.rivalCharacter = "ash";
    state.flags.rivalStarterKey = "PIKACHU";
  } else if (state.protagonist === "leaf") {
    if (!STARTER_KEYS.includes(chosenStarterKey)) {
      throw new Error("Leaf debe elegir entre BULBASAUR, CHARMANDER o SQUIRTLE.");
    }
    starterKey = chosenStarterKey;
    state.flags.rivalCharacter = "gary";
    state.flags.rivalStarterKey = TYPE_COUNTER_STARTER[starterKey];
  }

  const starterSpecies = dataMaps.speciesMap[starterKey];
  const starterMon = createBattlePokemon(starterSpecies, 5, dataMaps.movesMap);
  addPokemonToPartyOrBox(state, starterMon);
  state.flags.chosenStarterKey = starterKey;
  state.flags.starterChosen = true;

  // Registrar también al inicial rival como "visto" en Pokédex
  const rivalSp = dataMaps.speciesMap[state.flags.rivalStarterKey];
  if (rivalSp && !state.pokedex.seen.includes(rivalSp.id)) {
    state.pokedex.seen.push(rivalSp.id);
    state.pokedex.seen.sort((a, b) => a - b);
  }

  return state;
}

export function getIntroSceneLines(state) {
  const protag = state.protagonist;
  if (protag === "ash") {
    return [
      "¡Te quedaste dormido el día de tu partida y llegaste tarde al Laboratorio del Prof. Oak!",
      "Los tres iniciales habituales ya fueron entregados, pero el Prof. Oak guarda un último Pokémon...",
      `¡${state.playerName} recibió a **PIKACHU** (Nv. 5)! Tu rival **Gary** partió antes con su **Eevee**.`,
      "Modo Anime activado: podrás rescatar o ganarte la confianza de Bulbasaur, Charmander y Squirtle en Kanto.",
    ];
  }
  if (protag === "gary") {
    return [
      `Como nieto del Prof. Oak, elegiste primero a **${state.flags.chosenStarterKey}** (Nv. 5).`,
      "Un chico llamado **Ash** llegó tarde justo después y se llevó al Pikachu especial del profesor.",
      "Modo Clásico activado: conquista las 8 Medallas de Kanto y demuestra quién es el mejor entrenador.",
    ];
  }
  return [
    `¡Lista para tu viaje por Kanto, ${state.playerName}! Has elegido a **${state.flags.chosenStarterKey}** (Nv. 5).`,
    `Tu rival **Gary** no perdió ni un segundo y escogió a **${state.flags.rivalStarterKey}** por su ventaja de tipo.`,
    "Modo Clásico activado: ¡el mundo de Kanto te espera!",
  ];
}

/**
 * Registra victorias o derrotas contra Gary en la ruta de Ash para definir la evolución de Eevee.
 */
export function recordRivalBattleOutcome(state, playerWon) {
  if (!state.flags) state.flags = {};
  if (playerWon) {
    state.flags.rivalWins = Number(state.flags.rivalWins || 0) + 1;
  } else {
    state.flags.rivalLosses = Number(state.flags.rivalLosses || 0) + 1;
  }
}

/**
 * Determina en qué forma evoluciona el Eevee de Gary según historial de victorias/derrotas.
 */
export function getGaryEeveeEvolution(state) {
  const wins = Number(state?.flags?.rivalWins || 0);
  const losses = Number(state?.flags?.rivalLosses || 0);
  if (wins === 0 && losses === 0 && (state?.badges?.length || 0) < 2) {
    return "EEVEE";
  }
  if (wins >= 2 && losses === 0) return "JOLTEON";
  if (losses > wins) return "VAPOREON";
  return "FLAREON";
}

/**
 * Devuelve si un evento anime exclusivo de Ash está disponible.
 */
export function canTriggerAshEvent(eventId, state) {
  if (state?.protagonist !== "ash") {
    return {
      allowed: false,
      completed: false,
      reason: "Evento exclusivo de la ruta de Ash (Modo Anime).",
    };
  }
  if (eventId === "ash_bulbasaur") {
    if (state.flags.ashBulbasaurObtained) {
      return { allowed: false, completed: true, reason: "Ya protegiste la aldea oculta y obtuviste a Bulbasaur." };
    }
    return { allowed: true, completed: false };
  }
  if (eventId === "ash_charmander") {
    if (state.flags.ashCharmanderObtained) {
      return { allowed: false, completed: true, reason: "Ya rescataste a Charmander en la Ruta 24." };
    }
    return { allowed: true, completed: false };
  }
  if (eventId === "ash_squirtle") {
    if (state.flags.ashSquirtleObtained) {
      return { allowed: false, completed: true, reason: "El Escuadrón Squirtle ya confía en ti." };
    }
    return { allowed: true, completed: false };
  }
  return { allowed: false, completed: false, reason: "Evento desconocido." };
}

export function completeAshBulbasaurWithPotion(state, dataMaps) {
  const gate = canTriggerAshEvent("ash_bulbasaur", state);
  if (!gate.allowed) {
    return { ok: false, message: gate.reason };
  }
  if (getBagItemCount(state, "POTION") < 1) {
    return { ok: false, message: "Necesitas al menos 1 Poción en tu mochila para curar a los Pokémon de la aldea." };
  }
  consumeBagItem(state, "POTION", 1);
  return grantAshEventPokemon("ash_bulbasaur", state, dataMaps);
}

export function getAshEventTrainerBattle(eventId) {
  if (eventId === "ash_bulbasaur") {
    return {
      eventId,
      trainerName: "Guardiana Melanie",
      battleType: "trainer",
      party: [
        { speciesKey: "ODDISH", baseLevel: 12 },
        { speciesKey: "BULBASAUR", baseLevel: 14 },
      ],
    };
  }
  if (eventId === "ash_charmander") {
    return {
      eventId,
      trainerName: "Damian (Ex-Entrenador)",
      battleType: "trainer",
      party: [
        { speciesKey: "RATICATE", baseLevel: 12 },
        { speciesKey: "FEAROW", baseLevel: 14 },
      ],
    };
  }
  if (eventId === "ash_squirtle") {
    return {
      eventId,
      trainerName: "Líder Escuadrón Squirtle",
      battleType: "trainer",
      party: [
        { speciesKey: "SQUIRTLE", baseLevel: 13 },
        { speciesKey: "SQUIRTLE", baseLevel: 14 },
        { speciesKey: "SQUIRTLE", baseLevel: 16 },
      ],
    };
  }
  return null;
}

export function grantAshEventPokemon(eventId, state, dataMaps) {
  const gate = canTriggerAshEvent(eventId, state);
  if (!gate.allowed) {
    return { ok: false, message: gate.reason };
  }

  let speciesKey;
  let level = 14;
  let flagKey;
  if (eventId === "ash_bulbasaur") {
    speciesKey = "BULBASAUR";
    level = 14;
    flagKey = "ashBulbasaurObtained";
  } else if (eventId === "ash_charmander") {
    speciesKey = "CHARMANDER";
    level = 14;
    flagKey = "ashCharmanderObtained";
  } else if (eventId === "ash_squirtle") {
    speciesKey = "SQUIRTLE";
    level = 16;
    flagKey = "ashSquirtleObtained";
  } else {
    return { ok: false, message: "Evento desconocido." };
  }

  const sp = dataMaps.speciesMap[speciesKey];
  const mon = createBattlePokemon(sp, level, dataMaps.movesMap);
  const placed = addPokemonToPartyOrBox(state, mon);
  state.flags[flagKey] = true;
  markCaptured(state, sp.id);

  const locText =
    placed.destination === "party"
      ? "se unió a tu equipo activo"
      : "fue enviado a la Caja del PC";
  return {
    ok: true,
    pokemon: mon,
    destination: placed.destination,
    message: `¡${sp.name} (Nv. ${level}) ${locText}!`,
  };
}

/**
 * Comprueba requisito del Grand Prix P1: al menos 1 Pokémon tipo FIGHTING en equipo activo.
 */
export function checkGrandPrixEligibility(state, speciesByKey = {}) {
  const party = state?.party || [];
  const fighter = party.find((mon) => {
    const types = mon.types || speciesByKey[mon.speciesKey]?.types || [];
    return types.includes("FIGHTING");
  });
  if (!fighter) {
    return {
      eligible: false,
      fighter: null,
      message:
        "¡Alto! Para inscribirte en el Grand Prix P1 debes llevar al menos un Pokémon de tipo Lucha (FIGHTING) en tu equipo.",
    };
  }
  return {
    eligible: true,
    fighter,
    message: `¡Inscripción aceptada! ${fighter.name} representará a tu equipo en el Grand Prix P1.`,
  };
}

export function completeGrandPrixP1(state) {
  if (!state.flags) state.flags = {};
  const firstClear = !state.flags.wonGrandPrixP1;
  state.flags.wonGrandPrixP1 = true;
  const bonus = firstClear ? 3000 : 1200;
  state.money = (state.money || 0) + bonus;
  return {
    ok: true,
    firstClear,
    bonus,
    message: `¡Campeón del Grand Prix P1! Ganaste ₽${bonus} y el Cinturón de Honor P1 (habilita el reto de Greta en la Frontera).`,
  };
}

export function completeSafariRace(state) {
  if (!state.flags) state.flags = {};
  const firstClear = !state.flags.safariRaceWon;
  state.flags.safariRaceWon = true;
  const bonus = firstClear ? 2500 : 1000;
  state.money = (state.money || 0) + bonus;
  return {
    ok: true,
    firstClear,
    bonus,
    message:
      `¡Ganaste la Carrera de la Zona Safari (+₽${bonus})! Bono permanente activado: ` +
      "más encuentros raros y 50% menos probabilidad de huida en la Zona Safari.",
  };
}

export function awardGymBadge(state, gymLeader) {
  if (!gymLeader) return { ok: false, isFirstTime: false };
  if (!Array.isArray(state.badges)) state.badges = [];
  if (!state.flags) state.flags = {};
  if (!Array.isArray(state.flags.defeatedGyms)) state.flags.defeatedGyms = [];

  const isFirstTime = !state.badges.includes(gymLeader.badgeId);
  if (isFirstTime) {
    state.badges.push(gymLeader.badgeId);
  }
  if (!state.flags.defeatedGyms.includes(gymLeader.id)) {
    state.flags.defeatedGyms.push(gymLeader.id);
  }
  return { ok: true, isFirstTime, badgeId: gymLeader.badgeId, badgeName: gymLeader.badgeName };
}

/**
 * Catálogo completo de Tienda Pokémon con Cordón Unión (₽3,000) y piedras con especies compatibles.
 */
export function getMartCatalog(items = []) {
  return (items || [])
    .filter((item) => item.price > 0)
    .map((item) => {
      const evoList = Array.isArray(item.evolvesSpecies)
        ? item.evolvesSpecies.map((pair) => `${pair.from} -> ${pair.to}`).join(", ")
        : "";
      return {
        ...item,
        normKey: normalizeItemKey(item.key || item.itemId),
        evolutionSummary: evoList || null,
      };
    });
}

export function buyMartItem(state, itemKeyOrId, quantity = 1, itemsByKey = {}) {
  const norm = normalizeItemKey(itemKeyOrId);
  const item = itemsByKey[norm] || itemsByKey[itemKeyOrId];
  if (!item || item.price <= 0) {
    return { ok: false, message: "Este artículo no está a la venta." };
  }
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const totalCost = item.price * qty;
  if ((state.money || 0) < totalCost) {
    return {
      ok: false,
      message: `No tienes suficiente dinero. Necesitas ₽${totalCost} y tienes ₽${state.money || 0}.`,
    };
  }
  state.money -= totalCost;
  const newCount = addBagItem(state, norm, qty);
  return {
    ok: true,
    item,
    quantity: qty,
    totalCost,
    newBagCount: newCount,
    message: `Compraste ${qty}x ${item.name} por ₽${totalCost}.`,
  };
}

export function buildScaledEncounterParty(partySpecs, playerParty, battleType = "trainer") {
  return scalePartyLevels(partySpecs, playerParty, battleType);
}

export function healAtPokemonCenter(state, currentLocation, movesMap = {}) {
  healPartyFull(state, movesMap);
  if (!state.flags) state.flags = {};
  if (currentLocation?.mapId) {
    state.flags.lastHealLocation = {
      mapId: currentLocation.mapId,
      mapName: currentLocation.mapName || currentLocation.mapId,
      x: currentLocation.x,
      y: currentLocation.y,
    };
  }
  return {
    ok: true,
    message: "¡Bienvenido al Centro Pokémon! Hemos curado por completo los PS, estados y PP de tu equipo.",
  };
}

/**
 * Genera los NPCs dinámicos de eventos especiales y Ases de la Frontera para el mapa actual.
 */
export function getStoryOverlayNpcsForMap(map, state, frontierDefs = []) {
  if (!map || !state) return [];
  const npcs = [];

  if (map.id === "MAP_CERULEAN_CITY" && state.protagonist === "ash" && !state.flags?.ashBulbasaurObtained) {
    npcs.push({
      id: "NPC_ASH_BULBASAUR",
      localId: "NPC_ASH_BULBASAUR",
      eventType: "ash_bulbasaur",
      name: "Guardiana Melanie",
      x: 18,
      y: 18,
      facing: "down",
      spriteFile: "assets/sprites/characters/npcs/cooltrainer_f.png",
      frameWidth: 16,
      frameHeight: 32,
      frameCount: 10,
    });
  }

  if (map.id === "MAP_ROUTE24" && state.protagonist === "ash" && !state.flags?.ashCharmanderObtained) {
    npcs.push({
      id: "NPC_ASH_CHARMANDER",
      localId: "NPC_ASH_CHARMANDER",
      eventType: "ash_charmander",
      name: "Damian y Charmander",
      x: 12,
      y: 17,
      facing: "down",
      spriteFile: "assets/sprites/characters/npcs/cooltrainer_m.png",
      frameWidth: 16,
      frameHeight: 32,
      frameCount: 10,
    });
  }

  if (map.id === "MAP_VERMILION_CITY" && state.protagonist === "ash" && !state.flags?.ashSquirtleObtained) {
    npcs.push({
      id: "NPC_ASH_SQUIRTLE",
      localId: "NPC_ASH_SQUIRTLE",
      eventType: "ash_squirtle",
      name: "Oficial Jenny (Escuadrón Squirtle)",
      x: 24,
      y: 24,
      facing: "down",
      spriteFile: "assets/sprites/characters/npcs/policeman.png",
      frameWidth: 16,
      frameHeight: 32,
      frameCount: 9,
    });
  }

  if (map.id === "MAP_FUCHSIA_CITY") {
    npcs.push({
      id: "NPC_GRAND_PRIX_P1",
      localId: "NPC_GRAND_PRIX_P1",
      eventType: "grand_prix_p1",
      name: "Organizador Grand Prix P1",
      x: 23,
      y: 8,
      facing: "down",
      spriteFile: "assets/sprites/characters/npcs/black_belt.png",
      frameWidth: 16,
      frameHeight: 32,
      frameCount: 10,
    });
  }

  if (map.id === "MAP_SAFARI_ZONE_CENTER") {
    npcs.push({
      id: "NPC_SAFARI_RACE",
      localId: "NPC_SAFARI_RACE",
      eventType: "safari_race",
      name: "Juez Carrera Zona Safari",
      x: 25,
      y: 28,
      facing: "down",
      spriteFile: "assets/sprites/characters/npcs/camper.png",
      frameWidth: 16,
      frameHeight: 32,
      frameCount: 10,
    });
  }

  if (map.id === "MAP_INDIGO_PLATEAU_POKEMON_CENTER_1F") {
    npcs.push({
      id: "NPC_INDIGO_LEAGUE_HOST",
      localId: "NPC_INDIGO_LEAGUE_HOST",
      eventType: "indigo_league",
      name: "Recepción Liga Pokémon",
      x: 11,
      y: 12,
      facing: "down",
      spriteFile: "assets/sprites/characters/npcs/cooltrainer_m.png",
      frameWidth: 16,
      frameHeight: 32,
      frameCount: 10,
    });
  }

  // En Lab Oak, usar el sprite del rival real según campaña
  if (map.id === "MAP_PALLET_TOWN_PROFESSOR_OAKS_LAB") {
    const rivalSprite =
      state.protagonist === "gary"
        ? "assets/sprites/characters/npcs/red_normal.png"
        : "assets/sprites/characters/npcs/blue.png";
    npcs.push({
      id: "NPC_OAKS_LAB_RIVAL_OVERRIDE",
      localId: "LOCALID_OAKS_LAB_RIVAL",
      eventType: "oaks_lab_rival",
      name: state.protagonist === "gary" ? "Rival Ash" : "Rival Gary",
      x: 5,
      y: 4,
      facing: "down",
      spriteFile: rivalSprite,
      frameWidth: 16,
      frameHeight: 32,
      frameCount: 9,
    });
  }

  // 7 Ases de la Frontera en Kanto
  for (const brain of frontierDefs || []) {
    if (brain.mapId === map.id) {
      npcs.push({
        id: `NPC_FRONTIER_${brain.id.toUpperCase()}`,
        localId: `NPC_FRONTIER_${brain.id.toUpperCase()}`,
        eventType: "frontier_brain",
        frontierId: brain.id,
        name: `${brain.title} ${brain.name}`,
        x: brain.x,
        y: brain.y,
        facing: "down",
        spriteFile: brain.spriteFile,
        frameWidth: 16,
        frameHeight: 32,
        frameCount: brain.frameCount || 10,
      });
    }
  }

  return npcs;
}
