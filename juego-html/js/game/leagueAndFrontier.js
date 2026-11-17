/**
 * Liga Pokémon de Kanto (Formato Anime 5 rondas + Alto Mando) y
 * Batalla de la Frontera (7 Ases de la Frontera) (Fase 4 — SPEC_MAESTRA §§5, 8.4).
 */

import { healPartyFull } from "./pokemonProgress.js";
import { getGaryEeveeEvolution } from "./storyEvents.js";

export const LEGENDARY_BIRD_IDS = [144, 145, 146]; // Articuno, Zapdos, Moltres

export const LEAGUE_TOURNAMENT_ROUNDS = [
  {
    round: 1,
    stageLabel: "Preliminar",
    trainerName: "Preliminar: Mandy",
    party: [
      { speciesKey: "KINGLER", baseLevel: 46 },
      { speciesKey: "GOLBAT", baseLevel: 47 },
      { speciesKey: "ELECTRODE", baseLevel: 48 },
    ],
  },
  {
    round: 2,
    stageLabel: "Octavos de Final",
    trainerName: "Octavos: Jeanette",
    party: [
      { speciesKey: "BEEDRILL", baseLevel: 47 },
      { speciesKey: "SCYTHER", baseLevel: 49 },
      { speciesKey: "VICTREEBEL", baseLevel: 50 },
    ],
  },
  {
    round: 3,
    stageLabel: "Cuartos de Final",
    trainerName: "Cuartos: Entrenador Pete",
    party: [
      { speciesKey: "NIDOKING", baseLevel: 49 },
      { speciesKey: "ARCANINE", baseLevel: 50 },
      { speciesKey: "CLOYSTER", baseLevel: 51 },
    ],
  },
  {
    round: 4,
    stageLabel: "Semifinal",
    trainerName: "Semifinal: Melissa",
    party: [
      { speciesKey: "BUTTERFREE", baseLevel: 50 },
      { speciesKey: "PIDGEOT", baseLevel: 51 },
      { speciesKey: "RAICHU", baseLevel: 52 },
      { speciesKey: "CHARIZARD", baseLevel: 53 },
    ],
  },
  {
    round: 5,
    stageLabel: "Gran Final del Torneo",
    trainerName: "Final Torneo: Harrison",
    party: [
      { speciesKey: "HYPNO", baseLevel: 51 },
      { speciesKey: "RHYDON", baseLevel: 52 },
      { speciesKey: "SNORLAX", baseLevel: 53 },
      { speciesKey: "CHARIZARD", baseLevel: 54 },
    ],
  },
];

export const ELITE_FOUR_MEMBERS = [
  {
    order: 1,
    id: "lorelei",
    trainerName: "Alto Mando Lorelei",
    specialty: "HIELO",
    party: [
      { speciesKey: "DEWGONG", baseLevel: 52 },
      { speciesKey: "CLOYSTER", baseLevel: 51 },
      { speciesKey: "SLOWBRO", baseLevel: 52 },
      { speciesKey: "JYNX", baseLevel: 54 },
      { speciesKey: "LAPRAS", baseLevel: 54 },
    ],
  },
  {
    order: 2,
    id: "bruno",
    trainerName: "Alto Mando Bruno",
    specialty: "LUCHA",
    party: [
      { speciesKey: "ONIX", baseLevel: 51 },
      { speciesKey: "HITMONCHAN", baseLevel: 53 },
      { speciesKey: "HITMONLEE", baseLevel: 53 },
      { speciesKey: "ONIX", baseLevel: 54 },
      { speciesKey: "MACHAMP", baseLevel: 56 },
    ],
  },
  {
    order: 3,
    id: "agatha",
    trainerName: "Alto Mando Agatha",
    specialty: "FANTASMA",
    party: [
      { speciesKey: "GENGAR", baseLevel: 54 },
      { speciesKey: "GOLBAT", baseLevel: 54 },
      { speciesKey: "HAUNTER", baseLevel: 53 },
      { speciesKey: "ARBOK", baseLevel: 56 },
      { speciesKey: "GENGAR", baseLevel: 58 },
    ],
  },
  {
    order: 4,
    id: "lance",
    trainerName: "Alto Mando Lance",
    specialty: "DRAGÓN",
    party: [
      { speciesKey: "GYARADOS", baseLevel: 56 },
      { speciesKey: "DRAGONAIR", baseLevel: 54 },
      { speciesKey: "DRAGONAIR", baseLevel: 54 },
      { speciesKey: "AERODACTYL", baseLevel: 58 },
      { speciesKey: "DRAGONITE", baseLevel: 60 },
    ],
  },
];

export const FRONTIER_BRAINS = [
  {
    id: "noland",
    order: 1,
    name: "Noland",
    title: "As Fábrica",
    locationLabel: "Ciudad Celeste (Este)",
    mapId: "MAP_CERULEAN_CITY",
    x: 26,
    y: 20,
    spriteFile: "assets/sprites/characters/npcs/cooltrainer_m.png",
    frameCount: 10,
    symbolId: "SYMBOL_KNOWLEDGE",
    symbolName: "Símbolo de la Sabiduría",
    requirementText: "Ser Campeón de la Liga y haber capturado al menos 30 especies en tu Pokédex.",
    party: [
      { speciesKey: "MAGNETON", baseLevel: 61 },
      { speciesKey: "STARMIE", baseLevel: 62 },
      { speciesKey: "ALAKAZAM", baseLevel: 64 },
    ],
  },
  {
    id: "greta",
    order: 2,
    name: "Greta",
    title: "As Dojo",
    locationLabel: "Ruta 2 (Sur de Bosque Verde)",
    mapId: "MAP_ROUTE2",
    x: 16,
    y: 65,
    spriteFile: "assets/sprites/characters/npcs/crush_girl.png",
    frameCount: 10,
    symbolId: "SYMBOL_GUTS",
    symbolName: "Símbolo del Coraje",
    requirementText: "Ser Campeón de la Liga y haber ganado el Grand Prix P1.",
    party: [
      { speciesKey: "POLIWRATH", baseLevel: 62 },
      { speciesKey: "PRIMEAPE", baseLevel: 62 },
      { speciesKey: "HITMONLEE", baseLevel: 64 },
      { speciesKey: "MACHAMP", baseLevel: 64 },
    ],
  },
  {
    id: "tucker",
    order: 3,
    name: "Tucker",
    title: "As Cúpula",
    locationLabel: "Pueblo Lavanda",
    mapId: "MAP_LAVENDER_TOWN",
    x: 10,
    y: 8,
    spriteFile: "assets/sprites/characters/npcs/gentleman.png",
    frameCount: 10,
    symbolId: "SYMBOL_TACTICS",
    symbolName: "Símbolo de la Táctica",
    requirementText: "Ser Campeón de la Liga y poseer el trofeo del Torneo de la Liga Pokémon.",
    party: [
      { speciesKey: "ARCANINE", baseLevel: 63 },
      { speciesKey: "LAPRAS", baseLevel: 63 },
      { speciesKey: "CHARIZARD", baseLevel: 65 },
    ],
  },
  {
    id: "lucy",
    order: 4,
    name: "Lucy",
    title: "As Sierpe",
    locationLabel: "Ruta 15 (Este de Ciudad Fucsia)",
    mapId: "MAP_ROUTE15",
    x: 16,
    y: 10,
    spriteFile: "assets/sprites/characters/npcs/beauty.png",
    frameCount: 10,
    symbolId: "SYMBOL_LUCK",
    symbolName: "Símbolo de la Fortuna",
    requirementText: "Ser Campeón de la Liga y haber ganado la Carrera de la Zona Safari.",
    party: [
      { speciesKey: "ARBOK", baseLevel: 62 },
      { speciesKey: "WEEZING", baseLevel: 63 },
      { speciesKey: "GYARADOS", baseLevel: 64 },
    ],
  },
  {
    id: "spenser",
    order: 5,
    name: "Spenser",
    title: "As Palacio",
    locationLabel: "Islas Espuma (1F)",
    mapId: "MAP_SEAFOAM_ISLANDS_1F",
    x: 9,
    y: 14,
    spriteFile: "assets/sprites/characters/npcs/old_man_2.png",
    frameCount: 9,
    symbolId: "SYMBOL_SPIRIT",
    symbolName: "Símbolo del Espíritu",
    requirementText: "Ser Campeón de la Liga y haber capturado al menos 1 Ave Legendaria (Articuno, Zapdos o Moltres).",
    party: [
      { speciesKey: "VENUSAUR", baseLevel: 64 },
      { speciesKey: "NINETALES", baseLevel: 64 },
      { speciesKey: "LAPRAS", baseLevel: 65 },
    ],
  },
  {
    id: "anabel",
    order: 6,
    name: "Anabel",
    title: "As Torre",
    locationLabel: "Ciudad Azafrán",
    mapId: "MAP_SAFFRON_CITY",
    x: 33,
    y: 31,
    spriteFile: "assets/sprites/characters/npcs/lass.png",
    frameCount: 10,
    symbolId: "SYMBOL_ABILITY",
    symbolName: "Símbolo de la Destreza",
    requirementText: "Haber completado el Alto Mando y derrotado al Campeón de Kanto.",
    party: [
      { speciesKey: "ALAKAZAM", baseLevel: 65 },
      { speciesKey: "EXEGGUTOR", baseLevel: 65 },
      { speciesKey: "SNORLAX", baseLevel: 66 },
      { speciesKey: "DRAGONITE", baseLevel: 66 },
    ],
  },
  {
    id: "brandon",
    order: 7,
    name: "Brandon",
    title: "As Pirámide",
    locationLabel: "Cueva Celeste (Entrada)",
    mapId: "MAP_CERULEAN_CAVE_1F",
    x: 36,
    y: 13,
    spriteFile: "assets/sprites/characters/npcs/rocker.png",
    frameCount: 10,
    symbolId: "SYMBOL_BRAVE",
    symbolName: "Símbolo de la Valentía",
    requirementText: "Reunir primero los 6 símbolos de los demás Ases de la Frontera.",
    party: [
      { speciesKey: "GENGAR", baseLevel: 67 },
      { speciesKey: "AERODACTYL", baseLevel: 67 },
      { speciesKey: "ARTICUNO", baseLevel: 68 },
      { speciesKey: "ZAPDOS", baseLevel: 68 },
      { speciesKey: "MOLTRES", baseLevel: 70 },
    ],
  },
];

export const FRONTIER_BY_ID = Object.fromEntries(FRONTIER_BRAINS.map((b) => [b.id, b]));

/**
 * Etapa 1 / Etapa 2 de la Meseta Añil: validación de acceso por las 8 Medallas de Kanto.
 */
export function canChallengeLeague(state) {
  const badges = state?.badges || [];
  if (badges.length < 8) {
    return {
      allowed: false,
      badgesCount: badges.length,
      message: `Necesitas las 8 Medallas de Kanto para competir en la Liga Pokémon (llevas ${badges.length}/8).`,
    };
  }
  return {
    allowed: true,
    badgesCount: badges.length,
    wonTournament: Boolean(state.flags?.wonLeagueTournament || state.flags?.unlockedEliteFour),
    wonEliteFour: Boolean(state.flags?.wonEliteFour || state.flags?.isChampion),
  };
}

/**
 * Tras ganar cada ronda del Torneo de la Liga, el equipo se cura automáticamente.
 */
export function onTournamentRoundVictory(state, completedRoundNumber, movesMap = {}) {
  healPartyFull(state, movesMap);
  if (completedRoundNumber >= LEAGUE_TOURNAMENT_ROUNDS.length) {
    return completeLeagueTournament(state);
  }
  return {
    ok: true,
    tournamentCompleted: false,
    nextRound: completedRoundNumber + 1,
    message: `¡Superaste la Ronda ${completedRoundNumber}/5! Tu equipo fue curado automáticamente para el siguiente encuentro.`,
  };
}

export function completeLeagueTournament(state) {
  if (!state.flags) state.flags = {};
  const firstClear = !state.flags.wonLeagueTournament;
  state.flags.wonLeagueTournament = true;
  state.flags.unlockedEliteFour = true;
  const reward = firstClear ? 6000 : 2500;
  state.money = (state.money || 0) + reward;
  return {
    ok: true,
    tournamentCompleted: true,
    firstClear,
    reward,
    message:
      `¡Campeón del Torneo de la Liga Pokémon (+₽${reward})! ` +
      "El acceso al Alto Mando y al Campeón queda desbloqueado de forma permanente.",
  };
}

export function canChallengeEliteFour(state) {
  const leagueGate = canChallengeLeague(state);
  if (!leagueGate.allowed) return leagueGate;
  if (!state.flags?.wonLeagueTournament && !state.flags?.unlockedEliteFour) {
    return {
      allowed: false,
      message: "Debes ganar primero el Torneo de la Liga Pokémon (5 rondas) para enfrentar al Alto Mando.",
    };
  }
  return { allowed: true };
}

/**
 * Construye al Campeón Rival final adaptado a la campaña (Ash / Gary / Leaf).
 */
export function getChampionRivalChallenge(state) {
  const protag = state?.protagonist || "ash";
  if (protag === "gary") {
    return {
      order: 5,
      id: "champion",
      trainerName: "Campeón Ash",
      specialty: "CAMPEÓN",
      party: [
        { speciesKey: "PIDGEOT", baseLevel: 59 },
        { speciesKey: "SNORLAX", baseLevel: 60 },
        { speciesKey: "VENUSAUR", baseLevel: 61 },
        { speciesKey: "CHARIZARD", baseLevel: 61 },
        { speciesKey: "BLASTOISE", baseLevel: 61 },
        { speciesKey: "PIKACHU", baseLevel: 63 },
      ],
    };
  }

  if (protag === "leaf") {
    const starter = state?.flags?.chosenStarterKey || "BULBASAUR";
    const finalForm =
      starter === "BULBASAUR"
        ? "CHARIZARD"
        : starter === "CHARMANDER"
        ? "BLASTOISE"
        : "VENUSAUR";
    return {
      order: 5,
      id: "champion",
      trainerName: "Campeón Gary",
      specialty: "CAMPEÓN",
      party: [
        { speciesKey: "PIDGEOT", baseLevel: 59 },
        { speciesKey: "ALAKAZAM", baseLevel: 57 },
        { speciesKey: "RHYDON", baseLevel: 59 },
        { speciesKey: "GYARADOS", baseLevel: 60 },
        { speciesKey: "ARCANINE", baseLevel: 61 },
        { speciesKey: finalForm, baseLevel: 63 },
      ],
    };
  }

  // Campaña Ash -> Campeón Gary con evolución de Eevee según historial
  const eeveeForm = getGaryEeveeEvolution(state);
  const aceKey = eeveeForm === "EEVEE" ? "FLAREON" : eeveeForm;
  return {
    order: 5,
    id: "champion",
    trainerName: "Campeón Gary",
    specialty: "CAMPEÓN",
    party: [
      { speciesKey: "PIDGEOT", baseLevel: 59 },
      { speciesKey: "ALAKAZAM", baseLevel: 57 },
      { speciesKey: "RHYDON", baseLevel: 59 },
      { speciesKey: "ARCANINE", baseLevel: 59 },
      { speciesKey: "GYARADOS", baseLevel: 60 },
      { speciesKey: aceKey, baseLevel: 63 },
    ],
  };
}

export function getEliteFourSequence(state) {
  return [...ELITE_FOUR_MEMBERS, getChampionRivalChallenge(state)];
}

export function completeEliteFour(state) {
  if (!state.flags) state.flags = {};
  const firstClear = !state.flags.wonEliteFour;
  state.flags.wonEliteFour = true;
  state.flags.isChampion = true;
  const reward = firstClear ? 10000 : 4000;
  state.money = (state.money || 0) + reward;
  return {
    ok: true,
    firstClear,
    reward,
    message:
      `¡ERES EL NUEVO CAMPEÓN DE KANTO (+₽${reward})! ` +
      "Has desbloqueado la Batalla de la Frontera con los 7 Ases repartidos por Kanto.",
  };
}

export function hasLegendaryBirdCaptured(state) {
  const captured = new Set(state?.pokedex?.captured || []);
  for (const id of LEGENDARY_BIRD_IDS) {
    if (captured.has(id)) return true;
  }
  const allMons = [...(state?.party || []), ...(state?.pcBox || [])];
  return allMons.some((m) => LEGENDARY_BIRD_IDS.includes(Number(m?.speciesId)));
}

/**
 * Evalúa si un As de la Frontera específico está desbloqueado según el progreso real.
 */
export function checkFrontierBrainUnlock(brainId, state) {
  const brain = FRONTIER_BY_ID[brainId];
  if (!brain) {
    return { unlocked: false, defeated: false, reason: "As de la Frontera desconocido." };
  }

  const defeatedList = state?.flags?.defeatedFrontierBrains || [];
  const defeated =
    defeatedList.includes(brain.id) || (state?.frontierSymbols || []).includes(brain.symbolId);

  if (!state?.flags?.isChampion) {
    return {
      unlocked: false,
      defeated,
      brain,
      reason: "Debes ganar primero el Alto Mando de la Liga Pokémon para desafiar a los Ases de la Frontera.",
    };
  }

  switch (brain.id) {
    case "noland": {
      const count = (state?.pokedex?.captured || []).length;
      const ok = count >= 30;
      return {
        unlocked: ok,
        defeated,
        brain,
        reason: ok
          ? "Disponible"
          : `Necesitas haber capturado al menos 30 especies en tu Pokédex (llevas ${count}/30).`,
      };
    }
    case "greta": {
      const ok = Boolean(state?.flags?.wonGrandPrixP1);
      return {
        unlocked: ok,
        defeated,
        brain,
        reason: ok ? "Disponible" : "Debes ganar primero el Grand Prix P1 en Ciudad Fucsia.",
      };
    }
    case "tucker": {
      const ok = Boolean(state?.flags?.wonLeagueTournament);
      return {
        unlocked: ok,
        defeated,
        brain,
        reason: ok
          ? "Disponible"
          : "Debes poseer el trofeo del Torneo de la Liga Pokémon (5 rondas).",
      };
    }
    case "lucy": {
      const ok = Boolean(state?.flags?.safariRaceWon);
      return {
        unlocked: ok,
        defeated,
        brain,
        reason: ok ? "Disponible" : "Debes ganar primero la Carrera de la Zona Safari.",
      };
    }
    case "spenser": {
      const ok = hasLegendaryBirdCaptured(state);
      return {
        unlocked: ok,
        defeated,
        brain,
        reason: ok
          ? "Disponible"
          : "Debes capturar al menos 1 Ave Legendaria (Articuno #144, Zapdos #145 o Moltres #146).",
      };
    }
    case "anabel": {
      const ok = Boolean(state?.flags?.wonEliteFour);
      return {
        unlocked: ok,
        defeated,
        brain,
        reason: ok
          ? "Disponible"
          : "Debes derrotar al Alto Mando y al Campeón de Kanto.",
      };
    }
    case "brandon": {
      const otherIds = ["noland", "greta", "tucker", "lucy", "spenser", "anabel"];
      const defeatedSet = new Set([
        ...(state?.flags?.defeatedFrontierBrains || []),
        ...FRONTIER_BRAINS.filter((b) => (state?.frontierSymbols || []).includes(b.symbolId)).map((b) => b.id),
      ]);
      const completedOthers = otherIds.filter((id) => defeatedSet.has(id)).length;
      const ok = completedOthers >= 6;
      return {
        unlocked: ok,
        defeated,
        brain,
        reason: ok
          ? "Disponible"
          : `Derrota primero a los otros 6 Ases de la Frontera (${completedOthers}/6 completados).`,
      };
    }
    default:
      return { unlocked: false, defeated, brain, reason: "Desconocido." };
  }
}

export function getAllFrontierStatus(state) {
  return FRONTIER_BRAINS.map((brain) => ({
    ...brain,
    ...checkFrontierBrainUnlock(brain.id, state),
  }));
}

export function awardFrontierSymbol(state, brainOrId) {
  const brain = typeof brainOrId === "string" ? FRONTIER_BY_ID[brainOrId] : brainOrId;
  if (!brain) return { ok: false, message: "As de la Frontera no válido." };
  if (!Array.isArray(state.frontierSymbols)) state.frontierSymbols = [];
  if (!state.flags) state.flags = {};
  if (!Array.isArray(state.flags.defeatedFrontierBrains)) state.flags.defeatedFrontierBrains = [];

  const firstClear = !state.frontierSymbols.includes(brain.symbolId);
  if (firstClear) {
    state.frontierSymbols.push(brain.symbolId);
  }
  if (!state.flags.defeatedFrontierBrains.includes(brain.id)) {
    state.flags.defeatedFrontierBrains.push(brain.id);
  }
  return {
    ok: true,
    firstClear,
    symbolId: brain.symbolId,
    symbolName: brain.symbolName,
    message: `¡Derrotaste al ${brain.title} ${brain.name}! Obtuviste el ${brain.symbolName}.`,
  };
}
