# Auditoría de Captura, Aparición Salvaje y Evoluciones (Fase 1)

> **Estado de los datos:** Todos los valores reflejados en este reporte y en los `.json` de `juego-html/data/` corresponden **estrictamente a los datos originales** extraídos de `pret/pokefirered`, sin modificaciones aplicadas todavía.

## Resumen ejecutivo

- **Especies con `catchRate < 60` o en Zona Safari:** 80 (7 en Zona Safari con `catchRate < 60`, 17 en Zona Safari con `catchRate >= 60`, 56 fuera de Zona Safari con `catchRate < 60`).
- **Encuentros salvajes raros (1%–4%):** 97 registros en Kanto + 62 registros en Islas Sete.
- **Evoluciones por intercambio (Kanto #001–#151):** 4 por intercambio directo (`EVO_TRADE`) + 6 por intercambio con objeto (`EVO_TRADE_ITEM`).

---

## A. Pokémon con `catchRate` bajo (< 60) o pertenecientes a la Zona Safari

Total auditado: **80 especies** de las 151 de Kanto:
- **Zona Safari con `catchRate < 60`:** 7 especies (candidatas directas a ajuste moderado 90–120 según `SPEC_MAESTRA.md` §4)
- **Zona Safari con `catchRate >= 60`:** 17 especies
- **Fuera de Zona Safari con `catchRate < 60`:** 56 especies (legendarios, iniciales, fósiles, evoluciones finales, etc.)

### A.1. Especies de la Zona Safari con `catchRate < 60`

| # | ID | Pokémon | Tipos | `catchRate` original | `safariZoneFleeRate` |
|---:|---:|:---|:---|---:|---:|
| 1 | #113 | **Chansey** | NORMAL | `30` | `125` |
| 2 | #115 | **Kangaskhan** | NORMAL | `45` | `125` |
| 3 | #123 | **Scyther** | BUG / FLYING | `45` | `125` |
| 4 | #127 | **Pinsir** | BUG | `45` | `125` |
| 5 | #128 | **Tauros** | NORMAL | `45` | `125` |
| 6 | #147 | **Dratini** | DRAGON | `45` | `100` |
| 7 | #148 | **Dragonair** | DRAGON | `45` | `125` |

### A.2. Resto de especies presentes en la Zona Safari (`catchRate >= 60`)

| # | ID | Pokémon | Tipos | `catchRate` original | `safariZoneFleeRate` |
|---:|---:|:---|:---|---:|---:|
| 1 | #029 | Nidoran♀ | POISON | `235` | `50` |
| 2 | #030 | Nidorina | POISON | `120` | `75` |
| 3 | #032 | Nidoran♂ | POISON | `235` | `50` |
| 4 | #033 | Nidorino | POISON | `120` | `75` |
| 5 | #046 | Paras | BUG / GRASS | `190` | `50` |
| 6 | #047 | Parasect | BUG / GRASS | `75` | `75` |
| 7 | #048 | Venonat | BUG / POISON | `190` | `50` |
| 8 | #049 | Venomoth | BUG / POISON | `75` | `75` |
| 9 | #054 | Psyduck | WATER | `190` | `50` |
| 10 | #060 | Poliwag | WATER | `255` | `50` |
| 11 | #079 | Slowpoke | WATER / PSYCHIC | `190` | `50` |
| 12 | #084 | Doduo | NORMAL / FLYING | `190` | `50` |
| 13 | #102 | Exeggcute | GRASS / PSYCHIC | `90` | `75` |
| 14 | #111 | Rhyhorn | GROUND / ROCK | `120` | `75` |
| 15 | #118 | Goldeen | WATER | `225` | `50` |
| 16 | #119 | Seaking | WATER | `60` | `75` |
| 17 | #129 | Magikarp | WATER | `255` | `25` |

### A.3. Especies fuera de la Zona Safari con `catchRate < 60`

| # | ID | Pokémon | Tipos | `catchRate` original |
|---:|---:|:---|:---|---:|
| 1 | #001 | Bulbasaur | GRASS / POISON | `45` |
| 2 | #002 | Ivysaur | GRASS / POISON | `45` |
| 3 | #003 | Venusaur | GRASS / POISON | `45` |
| 4 | #004 | Charmander | FIRE | `45` |
| 5 | #005 | Charmeleon | FIRE | `45` |
| 6 | #006 | Charizard | FIRE / FLYING | `45` |
| 7 | #007 | Squirtle | WATER | `45` |
| 8 | #008 | Wartortle | WATER | `45` |
| 9 | #009 | Blastoise | WATER | `45` |
| 10 | #012 | Butterfree | BUG / FLYING | `45` |
| 11 | #015 | Beedrill | BUG / POISON | `45` |
| 12 | #018 | Pidgeot | NORMAL / FLYING | `45` |
| 13 | #031 | Nidoqueen | POISON / GROUND | `45` |
| 14 | #034 | Nidoking | POISON / GROUND | `45` |
| 15 | #036 | Clefable | NORMAL | `25` |
| 16 | #040 | Wigglytuff | NORMAL | `50` |
| 17 | #045 | Vileplume | GRASS / POISON | `45` |
| 18 | #051 | Dugtrio | GROUND | `50` |
| 19 | #062 | Poliwrath | WATER / FIGHTING | `45` |
| 20 | #065 | Alakazam | PSYCHIC | `50` |
| 21 | #068 | Machamp | FIGHTING | `45` |
| 22 | #071 | Victreebel | GRASS / POISON | `45` |
| 23 | #076 | Golem | ROCK / GROUND | `45` |
| 24 | #083 | Farfetch'd | NORMAL / FLYING | `45` |
| 25 | #085 | Dodrio | NORMAL / FLYING | `45` |
| 26 | #094 | Gengar | GHOST / POISON | `45` |
| 27 | #095 | Onix | ROCK / GROUND | `45` |
| 28 | #103 | Exeggutor | GRASS / PSYCHIC | `45` |
| 29 | #106 | Hitmonlee | FIGHTING | `45` |
| 30 | #107 | Hitmonchan | FIGHTING | `45` |
| 31 | #108 | Lickitung | NORMAL | `45` |
| 32 | #114 | Tangela | GRASS | `45` |
| 33 | #122 | Mr. Mime | PSYCHIC | `45` |
| 34 | #124 | Jynx | ICE / PSYCHIC | `45` |
| 35 | #125 | Electabuzz | ELECTRIC | `45` |
| 36 | #126 | Magmar | FIRE | `45` |
| 37 | #130 | Gyarados | WATER / FLYING | `45` |
| 38 | #131 | Lapras | WATER / ICE | `45` |
| 39 | #132 | Ditto | NORMAL | `35` |
| 40 | #133 | Eevee | NORMAL | `45` |
| 41 | #134 | Vaporeon | WATER | `45` |
| 42 | #135 | Jolteon | ELECTRIC | `45` |
| 43 | #136 | Flareon | FIRE | `45` |
| 44 | #137 | Porygon | NORMAL | `45` |
| 45 | #138 | Omanyte | ROCK / WATER | `45` |
| 46 | #139 | Omastar | ROCK / WATER | `45` |
| 47 | #140 | Kabuto | ROCK / WATER | `45` |
| 48 | #141 | Kabutops | ROCK / WATER | `45` |
| 49 | #142 | Aerodactyl | ROCK / FLYING | `45` |
| 50 | #143 | Snorlax | NORMAL | `25` |
| 51 | #144 | Articuno | ICE / FLYING | `3` |
| 52 | #145 | Zapdos | ELECTRIC / FLYING | `3` |
| 53 | #146 | Moltres | FIRE / FLYING | `3` |
| 54 | #149 | Dragonite | DRAGON / FLYING | `45` |
| 55 | #150 | Mewtwo | PSYCHIC | `3` |
| 56 | #151 | Mew | PSYCHIC | `45` |

---

## B. Pokémon salvajes con probabilidad de aparición del 1% al 4%

La probabilidad indicada corresponde a la **suma agregada por especie** dentro de cada método de encuentro en la zona (en `pokefirered`, algunas especies ocupan múltiples *slots*; aquí solo se listan aquellas cuya probabilidad total real en la tabla es `1%–4%`).

- **Registros en Kanto:** 97
- **Registros en Islas Sete (Sevii Islands):** 62

### B.1. Kanto (Rutas, Cuevas, Zona Safari y Ciudades)

| # | Ubicación (`mapId`) | Método | Versión | Pokémon | Nivel | Prob. original |
|---:|:---|:---|:---|:---|:---|---:|
| 1 | Mt. Moon 1F (`MAP_MT_MOON_1F`) | Hierba / Cueva | FireRed / LeafGreen | **Clefairy** (#035) | Nv. 8 | **1%** |
| 2 | S.S. Anne Exterior (`MAP_SSANNE_EXTERIOR`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 3 | S.S. Anne Exterior (`MAP_SSANNE_EXTERIOR`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 4 | Safari Zone Center (`MAP_SAFARI_ZONE_CENTER`) | Hierba / Cueva | FireRed / LeafGreen | **Chansey** (#113) | Nv. 23 | **1%** |
| 5 | Safari Zone Center (`MAP_SAFARI_ZONE_CENTER`) | Hierba / Cueva | FireRed | **Scyther** (#123) | Nv. 23 | **4%** |
| 6 | Safari Zone Center (`MAP_SAFARI_ZONE_CENTER`) | Hierba / Cueva | LeafGreen | **Pinsir** (#127) | Nv. 23 | **4%** |
| 7 | Safari Zone Center (`MAP_SAFARI_ZONE_CENTER`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 15–35 | **4%** |
| 8 | Safari Zone Center (`MAP_SAFARI_ZONE_CENTER`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 15–35 | **4%** |
| 9 | Safari Zone Center (`MAP_SAFARI_ZONE_CENTER`) | Supercaña | FireRed / LeafGreen | **Dragonair** (#148) | Nv. 25–35 | **1%** |
| 10 | Safari Zone East (`MAP_SAFARI_ZONE_EAST`) | Hierba / Cueva | FireRed / LeafGreen | **Kangaskhan** (#115) | Nv. 25 | **4%** |
| 11 | Safari Zone East (`MAP_SAFARI_ZONE_EAST`) | Hierba / Cueva | FireRed | **Scyther** (#123) | Nv. 28 | **1%** |
| 12 | Safari Zone East (`MAP_SAFARI_ZONE_EAST`) | Hierba / Cueva | LeafGreen | **Pinsir** (#127) | Nv. 28 | **1%** |
| 13 | Safari Zone East (`MAP_SAFARI_ZONE_EAST`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 15–35 | **4%** |
| 14 | Safari Zone East (`MAP_SAFARI_ZONE_EAST`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 15–35 | **4%** |
| 15 | Safari Zone East (`MAP_SAFARI_ZONE_EAST`) | Supercaña | FireRed / LeafGreen | **Dragonair** (#148) | Nv. 25–35 | **1%** |
| 16 | Safari Zone North (`MAP_SAFARI_ZONE_NORTH`) | Hierba / Cueva | FireRed / LeafGreen | **Chansey** (#113) | Nv. 26 | **4%** |
| 17 | Safari Zone North (`MAP_SAFARI_ZONE_NORTH`) | Hierba / Cueva | FireRed / LeafGreen | **Tauros** (#128) | Nv. 28 | **1%** |
| 18 | Safari Zone North (`MAP_SAFARI_ZONE_NORTH`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 15–35 | **4%** |
| 19 | Safari Zone North (`MAP_SAFARI_ZONE_NORTH`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 15–35 | **4%** |
| 20 | Safari Zone North (`MAP_SAFARI_ZONE_NORTH`) | Supercaña | FireRed / LeafGreen | **Dragonair** (#148) | Nv. 25–35 | **1%** |
| 21 | Safari Zone West (`MAP_SAFARI_ZONE_WEST`) | Hierba / Cueva | FireRed / LeafGreen | **Kangaskhan** (#115) | Nv. 28 | **1%** |
| 22 | Safari Zone West (`MAP_SAFARI_ZONE_WEST`) | Hierba / Cueva | FireRed / LeafGreen | **Tauros** (#128) | Nv. 25 | **4%** |
| 23 | Safari Zone West (`MAP_SAFARI_ZONE_WEST`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 15–35 | **4%** |
| 24 | Safari Zone West (`MAP_SAFARI_ZONE_WEST`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 15–35 | **4%** |
| 25 | Safari Zone West (`MAP_SAFARI_ZONE_WEST`) | Supercaña | FireRed / LeafGreen | **Dragonair** (#148) | Nv. 25–35 | **1%** |
| 26 | Cerulean Cave 1F (`MAP_CERULEAN_CAVE_1F`) | Hierba / Cueva | FireRed / LeafGreen | **Wobbuffet** (#202 (Johto)) | Nv. 55 | **4%** |
| 27 | Cerulean Cave 2F (`MAP_CERULEAN_CAVE_2F`) | Hierba / Cueva | FireRed / LeafGreen | **Electrode** (#101) | Nv. 61 | **4%** |
| 28 | Cerulean Cave B1F (`MAP_CERULEAN_CAVE_B1F`) | Hierba / Cueva | FireRed / LeafGreen | **Electrode** (#101) | Nv. 64 | **4%** |
| 29 | Cerulean Cave B1F (`MAP_CERULEAN_CAVE_B1F`) | Hierba / Cueva | FireRed / LeafGreen | **Wobbuffet** (#202 (Johto)) | Nv. 61 | **1%** |
| 30 | Cerulean Cave B1F (`MAP_CERULEAN_CAVE_B1F`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 15–25 | **4%** |
| 31 | Cerulean Cave B1F (`MAP_CERULEAN_CAVE_B1F`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 15–25 | **4%** |
| 32 | Seafoam Islands B3F (`MAP_SEAFOAM_ISLANDS_B3F`) | Agua (Surf) | FireRed | **Psyduck** (#054) | Nv. 30–40 | **4%** |
| 33 | Seafoam Islands B3F (`MAP_SEAFOAM_ISLANDS_B3F`) | Agua (Surf) | FireRed | **Golduck** (#055) | Nv. 35–40 | **1%** |
| 34 | Seafoam Islands B3F (`MAP_SEAFOAM_ISLANDS_B3F`) | Agua (Surf) | LeafGreen | **Slowpoke** (#079) | Nv. 30–40 | **4%** |
| 35 | Seafoam Islands B3F (`MAP_SEAFOAM_ISLANDS_B3F`) | Agua (Surf) | LeafGreen | **Slowbro** (#080) | Nv. 35–40 | **1%** |
| 36 | Seafoam Islands B3F (`MAP_SEAFOAM_ISLANDS_B3F`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 15–25 | **4%** |
| 37 | Seafoam Islands B3F (`MAP_SEAFOAM_ISLANDS_B3F`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 15–25 | **4%** |
| 38 | Seafoam Islands B4F (`MAP_SEAFOAM_ISLANDS_B4F`) | Agua (Surf) | FireRed | **Psyduck** (#054) | Nv. 30–40 | **4%** |
| 39 | Seafoam Islands B4F (`MAP_SEAFOAM_ISLANDS_B4F`) | Agua (Surf) | FireRed | **Golduck** (#055) | Nv. 35–40 | **1%** |
| 40 | Seafoam Islands B4F (`MAP_SEAFOAM_ISLANDS_B4F`) | Agua (Surf) | LeafGreen | **Slowpoke** (#079) | Nv. 30–40 | **4%** |
| 41 | Seafoam Islands B4F (`MAP_SEAFOAM_ISLANDS_B4F`) | Agua (Surf) | LeafGreen | **Slowbro** (#080) | Nv. 35–40 | **1%** |
| 42 | Seafoam Islands B4F (`MAP_SEAFOAM_ISLANDS_B4F`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 15–25 | **4%** |
| 43 | Seafoam Islands B4F (`MAP_SEAFOAM_ISLANDS_B4F`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 15–25 | **4%** |
| 44 | Pokémon Tower 3F (`MAP_POKEMON_TOWER_3F`) | Hierba / Cueva | FireRed / LeafGreen | **Haunter** (#093) | Nv. 20 | **1%** |
| 45 | Route 3 (`MAP_ROUTE3`) | Hierba / Cueva | FireRed | **Nidoran♀** (#029) | Nv. 6 | **1%** |
| 46 | Route 3 (`MAP_ROUTE3`) | Hierba / Cueva | LeafGreen | **Nidoran♂** (#032) | Nv. 6 | **1%** |
| 47 | Route 4 (`MAP_ROUTE4`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 48 | Route 4 (`MAP_ROUTE4`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 49 | Route 10 (`MAP_ROUTE10`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 50 | Route 10 (`MAP_ROUTE10`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 51 | Route 11 (`MAP_ROUTE11`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 52 | Route 11 (`MAP_ROUTE11`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 53 | Route 12 (`MAP_ROUTE12`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 54 | Route 12 (`MAP_ROUTE12`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 55 | Route 13 (`MAP_ROUTE13`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 56 | Route 13 (`MAP_ROUTE13`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 57 | Route 19 (`MAP_ROUTE19`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 58 | Route 19 (`MAP_ROUTE19`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 59 | Route 19 (`MAP_ROUTE19`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 60 | Route 19 (`MAP_ROUTE19`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 61 | Route 20 (`MAP_ROUTE20`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 62 | Route 20 (`MAP_ROUTE20`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 63 | Route 20 (`MAP_ROUTE20`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 64 | Route 20 (`MAP_ROUTE20`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 65 | Route 21 (North) (`MAP_ROUTE21_NORTH`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 66 | Route 21 (North) (`MAP_ROUTE21_NORTH`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 67 | Route 21 (North) (`MAP_ROUTE21_NORTH`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 68 | Route 21 (North) (`MAP_ROUTE21_NORTH`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 69 | Route 21 (South) (`MAP_ROUTE21_SOUTH`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 70 | Route 21 (South) (`MAP_ROUTE21_SOUTH`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 71 | Route 21 (South) (`MAP_ROUTE21_SOUTH`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 72 | Route 21 (South) (`MAP_ROUTE21_SOUTH`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 73 | Route 24 (`MAP_ROUTE24`) | Hierba / Cueva | FireRed | **Metapod** (#011) | Nv. 8 | **1%** |
| 74 | Route 24 (`MAP_ROUTE24`) | Hierba / Cueva | LeafGreen | **Metapod** (#011) | Nv. 8 | **4%** |
| 75 | Route 24 (`MAP_ROUTE24`) | Hierba / Cueva | FireRed | **Kakuna** (#014) | Nv. 8 | **4%** |
| 76 | Route 24 (`MAP_ROUTE24`) | Hierba / Cueva | LeafGreen | **Kakuna** (#014) | Nv. 8 | **1%** |
| 77 | Route 24 (`MAP_ROUTE24`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 78 | Route 24 (`MAP_ROUTE24`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 79 | Route 25 (`MAP_ROUTE25`) | Hierba / Cueva | FireRed | **Metapod** (#011) | Nv. 9 | **1%** |
| 80 | Route 25 (`MAP_ROUTE25`) | Hierba / Cueva | LeafGreen | **Metapod** (#011) | Nv. 9 | **4%** |
| 81 | Route 25 (`MAP_ROUTE25`) | Hierba / Cueva | FireRed | **Kakuna** (#014) | Nv. 9 | **4%** |
| 82 | Route 25 (`MAP_ROUTE25`) | Hierba / Cueva | LeafGreen | **Kakuna** (#014) | Nv. 9 | **1%** |
| 83 | Pallet Town (`MAP_PALLET_TOWN`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 84 | Pallet Town (`MAP_PALLET_TOWN`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 85 | Pallet Town (`MAP_PALLET_TOWN`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 86 | Pallet Town (`MAP_PALLET_TOWN`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 87 | Cerulean City (`MAP_CERULEAN_CITY`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 88 | Cerulean City (`MAP_CERULEAN_CITY`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 89 | Vermilion City (`MAP_VERMILION_CITY`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 90 | Vermilion City (`MAP_VERMILION_CITY`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 91 | Vermilion City (`MAP_VERMILION_CITY`) | Supercaña | LeafGreen | **Horsea** (#116) | Nv. 25–35 | **4%** |
| 92 | Celadon City (`MAP_CELADON_CITY`) | Agua (Surf) | FireRed / LeafGreen | **Koffing** (#109) | Nv. 30–40 | **1%** |
| 93 | Celadon City (`MAP_CELADON_CITY`) | Supercaña | FireRed / LeafGreen | **Grimer** (#088) | Nv. 30–40 | **1%** |
| 94 | Cinnabar Island (`MAP_CINNABAR_ISLAND`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 95 | Cinnabar Island (`MAP_CINNABAR_ISLAND`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 96 | Cinnabar Island (`MAP_CINNABAR_ISLAND`) | Supercaña | LeafGreen | **Slowbro** (#080) | Nv. 25–35 | **4%** |
| 97 | Cinnabar Island (`MAP_CINNABAR_ISLAND`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |

### B.2. Islas Sete (Sevii Islands)

| # | Ubicación (`mapId`) | Método | Versión | Pokémon | Nivel | Prob. original |
|---:|:---|:---|:---|:---|:---|---:|
| 1 | Four Island Icefall Cave Back (`MAP_FOUR_ISLAND_ICEFALL_CAVE_BACK`) | Agua (Surf) | FireRed / LeafGreen | **Tentacruel** (#073) | Nv. 35–45 | **4%** |
| 2 | Four Island Icefall Cave Back (`MAP_FOUR_ISLAND_ICEFALL_CAVE_BACK`) | Agua (Surf) | FireRed / LeafGreen | **Lapras** (#131) | Nv. 30–45 | **1%** |
| 3 | Four Island Icefall Cave Back (`MAP_FOUR_ISLAND_ICEFALL_CAVE_BACK`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 4 | Four Island Icefall Cave Back (`MAP_FOUR_ISLAND_ICEFALL_CAVE_BACK`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 5 | Four Island Icefall Cave Back (`MAP_FOUR_ISLAND_ICEFALL_CAVE_BACK`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 6 | Four Island Icefall Cave Back (`MAP_FOUR_ISLAND_ICEFALL_CAVE_BACK`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 7 | One Island Kindle Road (`MAP_ONE_ISLAND_KINDLE_ROAD`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 8 | One Island Kindle Road (`MAP_ONE_ISLAND_KINDLE_ROAD`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 9 | One Island Kindle Road (`MAP_ONE_ISLAND_KINDLE_ROAD`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 10 | One Island Kindle Road (`MAP_ONE_ISLAND_KINDLE_ROAD`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 11 | One Island Treasure Beach (`MAP_ONE_ISLAND_TREASURE_BEACH`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 12 | One Island Treasure Beach (`MAP_ONE_ISLAND_TREASURE_BEACH`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 13 | One Island Treasure Beach (`MAP_ONE_ISLAND_TREASURE_BEACH`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 14 | One Island Treasure Beach (`MAP_ONE_ISLAND_TREASURE_BEACH`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 15 | Three Island Bond Bridge (`MAP_THREE_ISLAND_BOND_BRIDGE`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 16 | Three Island Bond Bridge (`MAP_THREE_ISLAND_BOND_BRIDGE`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 17 | Three Island Bond Bridge (`MAP_THREE_ISLAND_BOND_BRIDGE`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 18 | Three Island Bond Bridge (`MAP_THREE_ISLAND_BOND_BRIDGE`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 19 | Five Island Resort Gorgeous (`MAP_FIVE_ISLAND_RESORT_GORGEOUS`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 20 | Five Island Resort Gorgeous (`MAP_FIVE_ISLAND_RESORT_GORGEOUS`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 21 | Five Island Resort Gorgeous (`MAP_FIVE_ISLAND_RESORT_GORGEOUS`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 22 | Five Island Resort Gorgeous (`MAP_FIVE_ISLAND_RESORT_GORGEOUS`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 23 | Five Island Water Labyrinth (`MAP_FIVE_ISLAND_WATER_LABYRINTH`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 24 | Five Island Water Labyrinth (`MAP_FIVE_ISLAND_WATER_LABYRINTH`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 25 | Five Island Water Labyrinth (`MAP_FIVE_ISLAND_WATER_LABYRINTH`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 26 | Five Island Water Labyrinth (`MAP_FIVE_ISLAND_WATER_LABYRINTH`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 27 | Five Island Meadow (`MAP_FIVE_ISLAND_MEADOW`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 28 | Five Island Meadow (`MAP_FIVE_ISLAND_MEADOW`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 29 | Five Island Meadow (`MAP_FIVE_ISLAND_MEADOW`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 30 | Five Island Meadow (`MAP_FIVE_ISLAND_MEADOW`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 31 | Five Island Memorial Pillar (`MAP_FIVE_ISLAND_MEMORIAL_PILLAR`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 32 | Five Island Memorial Pillar (`MAP_FIVE_ISLAND_MEMORIAL_PILLAR`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 33 | Five Island Memorial Pillar (`MAP_FIVE_ISLAND_MEMORIAL_PILLAR`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 34 | Five Island Memorial Pillar (`MAP_FIVE_ISLAND_MEMORIAL_PILLAR`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 35 | Six Island Outcast Island (`MAP_SIX_ISLAND_OUTCAST_ISLAND`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 36 | Six Island Outcast Island (`MAP_SIX_ISLAND_OUTCAST_ISLAND`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 37 | Six Island Outcast Island (`MAP_SIX_ISLAND_OUTCAST_ISLAND`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 38 | Six Island Outcast Island (`MAP_SIX_ISLAND_OUTCAST_ISLAND`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 39 | Six Island Green Path (`MAP_SIX_ISLAND_GREEN_PATH`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 40 | Six Island Green Path (`MAP_SIX_ISLAND_GREEN_PATH`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 41 | Six Island Green Path (`MAP_SIX_ISLAND_GREEN_PATH`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 42 | Six Island Green Path (`MAP_SIX_ISLAND_GREEN_PATH`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 43 | Six Island Water Path (`MAP_SIX_ISLAND_WATER_PATH`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 44 | Six Island Water Path (`MAP_SIX_ISLAND_WATER_PATH`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 45 | Six Island Water Path (`MAP_SIX_ISLAND_WATER_PATH`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 46 | Six Island Water Path (`MAP_SIX_ISLAND_WATER_PATH`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 47 | Seven Island Trainer Tower (`MAP_SEVEN_ISLAND_TRAINER_TOWER`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 48 | Seven Island Trainer Tower (`MAP_SEVEN_ISLAND_TRAINER_TOWER`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 49 | Seven Island Trainer Tower (`MAP_SEVEN_ISLAND_TRAINER_TOWER`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 50 | Seven Island Trainer Tower (`MAP_SEVEN_ISLAND_TRAINER_TOWER`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 51 | Seven Island Tanoby Ruins (`MAP_SEVEN_ISLAND_TANOBY_RUINS`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 52 | Seven Island Tanoby Ruins (`MAP_SEVEN_ISLAND_TANOBY_RUINS`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 53 | Seven Island Tanoby Ruins (`MAP_SEVEN_ISLAND_TANOBY_RUINS`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 54 | Seven Island Tanoby Ruins (`MAP_SEVEN_ISLAND_TANOBY_RUINS`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 55 | One Island (`MAP_ONE_ISLAND`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 56 | One Island (`MAP_ONE_ISLAND`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 57 | One Island (`MAP_ONE_ISLAND`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 58 | One Island (`MAP_ONE_ISLAND`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |
| 59 | Five Island (`MAP_FIVE_ISLAND`) | Supercaña | FireRed | **Psyduck** (#054) | Nv. 25–35 | **1%** |
| 60 | Five Island (`MAP_FIVE_ISLAND`) | Supercaña | LeafGreen | **Slowpoke** (#079) | Nv. 25–35 | **1%** |
| 61 | Five Island (`MAP_FIVE_ISLAND`) | Supercaña | LeafGreen | **Kingler** (#099) | Nv. 25–35 | **4%** |
| 62 | Five Island (`MAP_FIVE_ISLAND`) | Supercaña | FireRed | **Seadra** (#117) | Nv. 25–35 | **4%** |

---

## C. Pokémon que originalmente evolucionan por intercambio

En `src/data/pokemon/evolution.h`, dentro de los 151 Pokémon de Kanto existen **dos variantes** de evolución por intercambio:
- **Intercambio directo (`EVO_TRADE`):** 4 especies
- **Intercambio con objeto equipado (`EVO_TRADE_ITEM`):** 6 evoluciones (todas desembocan en especies de Johto introducidas en Gen 2)

### C.1. Intercambio directo (`EVO_TRADE`)

| # | Origen | Evoluciona a | Método original | Dex destino |
|---:|:---|:---|:---|:---|
| 1 | **#064 Kadabra** | **#065 Alakazam** | `EVO_TRADE` | Kanto (#001–#151) |
| 2 | **#067 Machoke** | **#068 Machamp** | `EVO_TRADE` | Kanto (#001–#151) |
| 3 | **#075 Graveler** | **#076 Golem** | `EVO_TRADE` | Kanto (#001–#151) |
| 4 | **#093 Haunter** | **#094 Gengar** | `EVO_TRADE` | Kanto (#001–#151) |

### C.2. Intercambio con objeto equipado (`EVO_TRADE_ITEM`)

| # | Origen | Evoluciona a | Método original | Objeto requerido originalmente | Dex destino |
|---:|:---|:---|:---|:---|:---|
| 1 | **#061 Poliwhirl** | **#186 Politoed** | `EVO_TRADE_ITEM` | King's Rock | Johto (Dex Nacional) |
| 2 | **#079 Slowpoke** | **#199 Slowking** | `EVO_TRADE_ITEM` | King's Rock | Johto (Dex Nacional) |
| 3 | **#095 Onix** | **#208 Steelix** | `EVO_TRADE_ITEM` | Metal Coat | Johto (Dex Nacional) |
| 4 | **#117 Seadra** | **#230 Kingdra** | `EVO_TRADE_ITEM` | Dragon Scale | Johto (Dex Nacional) |
| 5 | **#123 Scyther** | **#212 Scizor** | `EVO_TRADE_ITEM` | Metal Coat | Johto (Dex Nacional) |
| 6 | **#137 Porygon** | **#233 Porygon2** | `EVO_TRADE_ITEM` | Up-Grade | Johto (Dex Nacional) |

> **Nota de alcance:** En la base completa de Gen 3 (`evolution.h`) existe además una especie de Hoenn con intercambio (`#366 Clamperl` -> `Huntail` / `Gorebyss` con *DeepSeaTooth* / *DeepSeaScale*), fuera del conjunto de los 151 Pokémon de Kanto.

<!-- BALANCE_PATCH_SECTION -->
---

## D. Resumen de cambios aplicados tras el parche de balanceo (`apply_balance_patch.py`)

> Las secciones **A, B y C** anteriores documentan la línea base original extraída de `pokefirered`. A continuación se resumen las modificaciones aplicadas en `juego-html/data/`.

### D.1. Ajuste de `catchRate` en Zona Safari y hábitos horarios (`species.json`)

- **Especies modificadas:** 7 especies de la Zona Safari con `catchRate < 60` (las otras 144 especies permanecen intactas):
  - **#113 Chansey:** `30` → `90`
  - **#115 Kangaskhan:** `45` → `105`
  - **#123 Scyther:** `45` → `105`
  - **#127 Pinsir:** `45` → `105`
  - **#128 Tauros:** `45` → `105`
  - **#147 Dratini:** `45` → `105`
  - **#148 Dragonair:** `45` → `105`
- **Distribución de `activityPeriod` (151 especies):** `63` diurnas (`diurnal`), `31` nocturnas (`nocturnal`), `57` sin restricción (`any`).

### D.2. Unificación de encuentros, rarezas y entorno (`wild_encounters.json`)

- **Zonas procesadas:** 132 zonas totales (`62` con `environment: "outdoor"` y `70` con `environment: "cave"`).
- **Tablas unificadas (`fireRed` + `leafGreen`):** 327 tablas de encuentro (todas verificadas al **100 % exacto**).
- **Ajuste de especies raras (1 %–4 % → 5 %–8 %):** 263 apariciones elevadas en total, descontando la diferencia proporcionalmente de las especies más comunes de cada tabla.

### D.3. Filtrado de evoluciones y `Cordón Unión` (`evolutions.json` y `items.json`)

- **Cadenas evolutivas resultantes en Kanto:** 70 entradas activas.
- **Evoluciones fuera de Kanto filtradas (`targetInKanto: false`):** 11 (Golbat -> Crobat, Gloom -> Bellossom, Poliwhirl -> Politoed, Slowpoke -> Slowking, Onix -> Steelix, Chansey -> Blissey, Seadra -> Kingdra, Scyther -> Scizor, Eevee -> Espeon, Eevee -> Umbreon, Porygon -> Porygon2).
- **Evoluciones por intercambio convertidas a `ITEM_LINKING_CORD` (Cordón Unión):** 4 (Kadabra -> Alakazam, Machoke -> Machamp, Graveler -> Golem, Haunter -> Gengar).
- **Catálogo de tienda (`items.json`):** 20 objetos configurados (4 Poké Balls, 10 objetos de curación/estado/revivir, 5 Piedras Evolutivas y **Cordón Unión** a ₽3,000 con guía de evolución integrada).
