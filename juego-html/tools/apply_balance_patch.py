#!/usr/bin/env python3
"""
Applies the Phase 1 -> Phase 2 balance patch strictly inside juego-html/data/:
  1. species.json:
     - Updates catchRate for the 7 Safari Zone species with catchRate < 60:
       Chansey -> 90; Kangaskhan, Scyther, Pinsir, Tauros, Dratini, Dragonair -> 105.
     - Adds "activityPeriod" ("diurnal" | "nocturnal" | "any") to all 151 species.
  2. wild_encounters.json:
     - Merges fireRed + leafGreen tables per zone & method into a single unified table.
     - Boosts every species with 1%–4% encounter rate up to 5%–8%, deducting
       proportionally from the most common species in that same table.
     - Adds "environment": "cave" | "outdoor" to every zone.
     - Verifies that every unified encounter table sums to exactly 100%.
  3. evolutions.json & items.json:
     - Filters out evolutions where targetInKanto is false.
     - Converts the 4 Kanto trade evolutions (Kadabra, Machoke, Graveler, Haunter)
       to EVO_ITEM using ITEM_LINKING_CORD (Cordón Unión).
     - Generates juego-html/data/items.json with Poké Balls, healing/status items,
       Revive, Evolution Stones, and Cordón Unión (₽3,000) with evolution guides.
  4. REPORTE_CAPTURA_Y_EVOLUCION.md:
     - Appends/updates Section D summarizing all applied patch changes.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "juego-html" / "data"

SAFARI_CATCH_RATE_OVERRIDES: dict[int, int] = {
    113: 90,   # Chansey (30 -> 90)
    115: 105,  # Kangaskhan (45 -> 105)
    123: 105,  # Scyther (45 -> 105)
    127: 105,  # Pinsir (45 -> 105)
    128: 105,  # Tauros (45 -> 105)
    147: 105,  # Dratini (45 -> 105)
    148: 105,  # Dragonair (45 -> 105)
}

# Lore- and biology-coherent activity periods for all 151 Kanto Pokémon
NOCTURNAL_IDS: set[int] = {
    35, 36,         # Clefairy, Clefable (moonlit nocturnal)
    37, 38,         # Vulpix, Ninetales (nocturnal mystic foxes)
    39, 40,         # Jigglypuff, Wigglytuff
    41, 42,         # Zubat, Golbat
    43, 44, 45,     # Oddish, Gloom, Vileplume
    46, 47,         # Paras, Parasect
    48, 49,         # Venonat, Venomoth
    52, 53,         # Meowth, Persian
    54, 55,         # Psyduck, Golduck
    60, 61, 62,     # Poliwag, Poliwhirl, Poliwrath
    92, 93, 94,     # Gastly, Haunter, Gengar
    96, 97,         # Drowzee, Hypno
    104, 105,       # Cubone, Marowak
    109, 110,       # Koffing, Weezing
}

ANY_PERIOD_IDS: set[int] = {
    19, 20,         # Rattata, Raticate (active day & night across Kanto routes)
    50, 51,         # Diglett, Dugtrio (subterranean)
    63, 64, 65,     # Abra, Kadabra, Alakazam (psychic teleporters)
    72, 73,         # Tentacool, Tentacruel (aquatic)
    74, 75, 76,     # Geodude, Graveler, Golem (cave mineral)
    79, 80,         # Slowpoke, Slowbro (aquatic/shoreline)
    81, 82,         # Magnemite, Magneton (artificial)
    86, 87,         # Seel, Dewgong (aquatic)
    88, 89,         # Grimer, Muk (sludge/artificial)
    90, 91,         # Shellder, Cloyster (aquatic)
    95,             # Onix (cave mineral)
    98, 99,         # Krabby, Kingler (aquatic)
    100, 101,       # Voltorb, Electrode (artificial)
    111, 112,       # Rhyhorn, Rhydon (mineral/rock)
    116, 117,       # Horsea, Seadra (aquatic)
    118, 119,       # Goldeen, Seaking (aquatic)
    120, 121,       # Staryu, Starmie (aquatic)
    124, 125, 126,  # Jynx, Electabuzz, Magmar
    129, 130,       # Magikarp, Gyarados (aquatic)
    131,            # Lapras (aquatic)
    132,            # Ditto (amorphous)
    137,            # Porygon (artificial)
    138, 139,       # Omanyte, Omastar (aquatic fossil)
    140, 141,       # Kabuto, Kabutops (aquatic fossil)
    142,            # Aerodactyl (fossil)
    143,            # Snorlax
    144, 145, 146,  # Articuno, Zapdos, Moltres (legendaries)
    147, 148, 149,  # Dratini, Dragonair, Dragonite (aquatic/dragon)
    150, 151,       # Mewtwo, Mew (legendaries)
}

CAVE_MAP_SUBSTRINGS = (
    "MT_MOON",
    "DIGLETTS_CAVE",
    "ROCK_TUNNEL",
    "VICTORY_ROAD",
    "POKEMON_TOWER",
    "POKEMON_MANSION",
    "POWER_PLANT",
    "SEAFOAM_ISLANDS",
    "CERULEAN_CAVE",
    "MT_EMBER_SUMMIT",
    "MT_EMBER_RUBY",
    "ICEFALL_CAVE",
    "LOST_CAVE",
    "ALTERING_CAVE",
    "CHAMBER",
)


def load_json(name: str) -> Any:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def save_json(name: str, payload: Any) -> None:
    path = DATA_DIR / name
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {path.relative_to(REPO_ROOT)}")


def get_activity_period(species_id: int) -> str:
    if species_id in NOCTURNAL_IDS:
        return "nocturnal"
    if species_id in ANY_PERIOD_IDS:
        return "any"
    return "diurnal"


def classify_environment(map_id: str) -> str:
    return "cave" if any(token in map_id for token in CAVE_MAP_SUBSTRINGS) else "outdoor"


def patch_species() -> dict[str, Any]:
    species = load_json("species.json")
    assert len(species) == 151, f"Expected 151 species, got {len(species)}"

    catch_changes: list[dict[str, Any]] = []
    period_counts = {"diurnal": 0, "nocturnal": 0, "any": 0}

    for sp in species:
        sp_id = sp["id"]
        if sp_id in SAFARI_CATCH_RATE_OVERRIDES:
            old_cr = sp["catchRate"]
            new_cr = SAFARI_CATCH_RATE_OVERRIDES[sp_id]
            sp["catchRate"] = new_cr
            catch_changes.append({"id": sp_id, "name": sp["name"], "old": old_cr, "new": new_cr})

        period = get_activity_period(sp_id)
        sp["activityPeriod"] = period
        period_counts[period] += 1

    save_json("species.json", species)
    return {"catch_changes": catch_changes, "period_counts": period_counts}


def round_to_100_hamilton(raw_weights: dict[str, float]) -> dict[str, int]:
    """Round positive float weights to integers summing to 100, minimum 1 per entry."""
    keys = list(raw_weights.keys())
    if not keys:
        return {}

    floored: dict[str, int] = {}
    remainders: list[tuple[float, str]] = []
    for k in keys:
        val = raw_weights[k]
        base = max(1, int(math.floor(val)))
        floored[k] = base
        remainders.append((val - base, k))

    diff = 100 - sum(floored.values())
    if diff > 0:
        remainders.sort(key=lambda x: (-x[0], x[1]))
        idx = 0
        while diff > 0:
            k = remainders[idx % len(remainders)][1]
            floored[k] += 1
            diff -= 1
            idx += 1
    elif diff < 0:
        # Remove surplus from largest entries while keeping minimum 1
        surplus = -diff
        by_size = sorted(keys, key=lambda k: (-floored[k], k))
        idx = 0
        while surplus > 0:
            k = by_size[idx % len(by_size)]
            if floored[k] > 1:
                floored[k] -= 1
                surplus -= 1
            idx += 1

    assert sum(floored.values()) == 100
    return floored


def boost_rares_and_rebalance(entries: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Takes merged base entries (integer rates summing to 100).
    Boosts all entries with 1 <= rate <= 4 to 5..8, deducting proportionally
    from the most common species in the same table so total remains exactly 100.
    """
    rare_target_map = {1: 5, 2: 6, 3: 7, 4: 8}
    rares = [e for e in entries if 1 <= e["rate"] <= 4]
    if not rares:
        return entries, []

    commons = [e for e in entries if e["rate"] > 8]
    donor_floor = 8
    if not commons or sum(e["rate"] - donor_floor for e in commons) < sum(rare_target_map[e["rate"]] - e["rate"] for e in rares):
        commons = [e for e in entries if e["rate"] > 5]
        donor_floor = 5

    max_available_slack = sum(e["rate"] - donor_floor for e in commons)
    desired_targets = {e["speciesKey"]: rare_target_map[e["rate"]] for e in rares}
    desired_delta = sum(desired_targets[e["speciesKey"]] - e["rate"] for e in rares)

    # If slack is tighter than desired_delta, keep all rares at least 5 and scale extra 6..8 down
    if desired_delta > max_available_slack:
        desired_targets = {e["speciesKey"]: 5 for e in rares}
        desired_delta = sum(5 - e["rate"] for e in rares)
        extra_budget = max_available_slack - desired_delta
        for e in sorted(rares, key=lambda x: -x["rate"]):
            if extra_budget <= 0:
                break
            add = min(3, extra_budget)
            desired_targets[e["speciesKey"]] += add
            extra_budget -= add
        desired_delta = sum(desired_targets[e["speciesKey"]] - e["rate"] for e in rares)

    assert desired_delta <= max_available_slack, "Insufficient donor capacity to boost rares to 5-8%"

    # Deduct desired_delta proportionally from common donors based on their available slack
    total_slack = sum(e["rate"] - donor_floor for e in commons)
    exact_deductions: dict[str, float] = {
        e["speciesKey"]: desired_delta * ((e["rate"] - donor_floor) / total_slack)
        for e in commons
    }
    int_deductions: dict[str, int] = {
        k: int(math.floor(v)) for k, v in exact_deductions.items()
    }
    rem = desired_delta - sum(int_deductions.values())
    if rem > 0:
        order = sorted(
            commons,
            key=lambda e: (-(exact_deductions[e["speciesKey"]] - int_deductions[e["speciesKey"]]), -e["rate"]),
        )
        for e in order:
            if rem == 0:
                break
            k = e["speciesKey"]
            if e["rate"] - int_deductions[k] > donor_floor:
                int_deductions[k] += 1
                rem -= 1

    boost_logs: list[dict[str, Any]] = []
    for e in entries:
        k = e["speciesKey"]
        if k in desired_targets:
            old_r = e["rate"]
            new_r = desired_targets[k]
            e["originalRate"] = old_r
            e["rate"] = new_r
            boost_logs.append({
                "speciesName": e["speciesName"],
                "oldRate": old_r,
                "newRate": new_r,
            })
        elif k in int_deductions:
            e["rate"] -= int_deductions[k]

    # Sort descending by rate, then speciesId
    entries.sort(key=lambda x: (-x["rate"], x["speciesId"]))

    total = sum(e["rate"] for e in entries)
    assert total == 100, f"Table sum mismatch after rebalance: {total}"
    for e in entries:
        assert not (1 <= e["rate"] <= 4), f"Rare species left unboosted: {e}"

    return entries, boost_logs


def patch_wild_encounters() -> dict[str, Any]:
    wild = load_json("wild_encounters.json")

    unified_tables = 0
    boosted_entries = 0
    env_counts = {"cave": 0, "outdoor": 0}
    sample_boosts: list[dict[str, Any]] = []

    for zone in wild["zones"]:
        env = classify_environment(zone["mapId"])
        zone["environment"] = env
        env_counts[env] += 1

        if "fireRed" in zone or "leafGreen" in zone:
            fr_methods = zone.pop("fireRed", {})
            lg_methods = zone.pop("leafGreen", {})
            all_methods = sorted(set(fr_methods) | set(lg_methods))
            unified_methods: dict[str, Any] = {}

            for method in all_methods:
                fr_obj = fr_methods.get(method)
                lg_obj = lg_methods.get(method)

                rates_present = [obj["encounterRate"] for obj in (fr_obj, lg_obj) if obj]
                enc_rate = round(sum(rates_present) / len(rates_present))

                fr_map = {e["speciesKey"]: e for e in (fr_obj or {}).get("encounters", [])}
                lg_map = {e["speciesKey"]: e for e in (lg_obj or {}).get("encounters", [])}
                all_keys = sorted(
                    set(fr_map) | set(lg_map),
                    key=lambda k: (fr_map.get(k) or lg_map.get(k))["speciesId"],
                )

                raw_avgs: dict[str, float] = {}
                merged_meta: dict[str, dict[str, Any]] = {}
                for k in all_keys:
                    efr = fr_map.get(k)
                    elg = lg_map.get(k)
                    r_fr = efr["rate"] if efr else 0
                    r_lg = elg["rate"] if elg else 0
                    raw_avgs[k] = (r_fr + r_lg) / 2.0

                    mins = [x["minLevel"] for x in (efr, elg) if x]
                    maxs = [x["maxLevel"] for x in (efr, elg) if x]
                    ref = efr or elg
                    merged_meta[k] = {
                        "speciesId": ref["speciesId"],
                        "speciesKey": ref["speciesKey"],
                        "speciesName": ref["speciesName"],
                        "isKanto": ref["isKanto"],
                        "minLevel": min(mins),
                        "maxLevel": max(maxs),
                    }

                base_int_rates = round_to_100_hamilton(raw_avgs)
                base_entries = []
                for k in all_keys:
                    entry = dict(merged_meta[k])
                    entry["rate"] = base_int_rates[k]
                    base_entries.append(entry)

                rebalanced, boost_logs = boost_rares_and_rebalance(base_entries)
                unified_tables += 1
                boosted_entries += len(boost_logs)

                for b in boost_logs:
                    if zone["region"] == "kanto":
                        sample_boosts.append({
                            "zoneName": zone["name"],
                            "method": method,
                            **b,
                        })

                unified_methods[method] = {
                    "encounterRate": enc_rate,
                    "encounters": rebalanced,
                }

            zone["methods"] = unified_methods
        else:
            # Idempotent verification if already unified
            for method_obj in zone.get("methods", {}).values():
                unified_tables += 1
                total = sum(e["rate"] for e in method_obj["encounters"])
                assert total == 100, f"{zone['zoneId']} sum={total}"

    wild["metadata"]["versions"] = ["unified"]
    wild["metadata"]["unified"] = True
    save_json("wild_encounters.json", wild)

    return {
        "zones": len(wild["zones"]),
        "unified_tables": unified_tables,
        "boosted_entries": boosted_entries,
        "env_counts": env_counts,
        "kanto_boosts": sample_boosts,
    }


def patch_evolutions() -> dict[str, Any]:
    evolutions = load_json("evolutions.json")
    filtered_out: list[str] = []
    converted_trade: list[str] = []
    new_evolutions: list[dict[str, Any]] = []

    for chain in evolutions:
        kept_evos: list[dict[str, Any]] = []
        for evo in chain["evolutions"]:
            if not evo.get("targetInKanto", True):
                filtered_out.append(f"{chain['speciesName']} -> {evo['targetSpeciesName']}")
                continue

            if evo["method"] == "EVO_TRADE" or (evo["method"] == "EVO_ITEM" and evo.get("item") == "LINKING_CORD"):
                evo["method"] = "EVO_ITEM"
                evo["param"] = "ITEM_LINKING_CORD"
                evo["level"] = None
                evo["item"] = "LINKING_CORD"
                evo["itemName"] = "Cordón Unión"
                evo["requiresTrade"] = False
                converted_trade.append(f"{chain['speciesName']} -> {evo['targetSpeciesName']}")

            kept_evos.append(evo)

        if kept_evos:
            chain["evolutions"] = kept_evos
            new_evolutions.append(chain)

    save_json("evolutions.json", new_evolutions)
    return {
        "chains_count": len(new_evolutions),
        "filtered_out": filtered_out,
        "converted_trade": converted_trade,
    }


def generate_items_catalog() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = [
        # Poké Balls
        {
            "id": 1,
            "key": "POKE_BALL",
            "itemId": "ITEM_POKE_BALL",
            "name": "Poké Ball",
            "category": "pokeball",
            "price": 200,
            "usableInBattle": True,
            "usableInOverworld": False,
            "catchMultiplier": 1.0,
            "description": "Dispositivo estándar para capturar Pokémon salvajes (ratio ×1.0).",
        },
        {
            "id": 2,
            "key": "GREAT_BALL",
            "itemId": "ITEM_GREAT_BALL",
            "name": "Super Ball",
            "category": "pokeball",
            "price": 600,
            "usableInBattle": True,
            "usableInOverworld": False,
            "catchMultiplier": 1.5,
            "description": "Poké Ball de alto rendimiento con mejor tasa de captura que una Poké Ball normal (ratio ×1.5).",
        },
        {
            "id": 3,
            "key": "ULTRA_BALL",
            "itemId": "ITEM_ULTRA_BALL",
            "name": "Ultra Ball",
            "category": "pokeball",
            "price": 1200,
            "usableInBattle": True,
            "usableInOverworld": False,
            "catchMultiplier": 2.0,
            "description": "Poké Ball de grado superior con una probabilidad de captura muy alta (ratio ×2.0).",
        },
        {
            "id": 4,
            "key": "SAFARI_BALL",
            "itemId": "ITEM_SAFARI_BALL",
            "name": "Safari Ball",
            "category": "pokeball",
            "price": 0,
            "usableInBattle": True,
            "usableInOverworld": False,
            "catchMultiplier": 1.5,
            "safariOnly": True,
            "description": "Poké Ball especial exclusiva de la Zona Safari (ratio ×1.5).",
        },
        # Curación y Estado
        {
            "id": 5,
            "key": "POTION",
            "itemId": "ITEM_POTION",
            "name": "Poción",
            "category": "healing",
            "price": 300,
            "usableInBattle": True,
            "usableInOverworld": True,
            "healHp": 20,
            "description": "Medicina en espray que restaura 20 PS de un Pokémon.",
        },
        {
            "id": 6,
            "key": "SUPER_POTION",
            "itemId": "ITEM_SUPER_POTION",
            "name": "Superpoción",
            "category": "healing",
            "price": 700,
            "usableInBattle": True,
            "usableInOverworld": True,
            "healHp": 50,
            "description": "Medicina en espray que restaura 50 PS de un Pokémon.",
        },
        {
            "id": 7,
            "key": "HYPER_POTION",
            "itemId": "ITEM_HYPER_POTION",
            "name": "Hiperpoción",
            "category": "healing",
            "price": 1200,
            "usableInBattle": True,
            "usableInOverworld": True,
            "healHp": 200,
            "description": "Medicina en espray que restaura 200 PS de un Pokémon.",
        },
        {
            "id": 8,
            "key": "FULL_RESTORE",
            "itemId": "ITEM_FULL_RESTORE",
            "name": "Restaurar Todo",
            "category": "healing",
            "price": 3000,
            "usableInBattle": True,
            "usableInOverworld": True,
            "healHp": "full",
            "cureStatus": "ALL",
            "description": "Medicina de lujo que restaura todos los PS y cura cualquier problema de estado.",
        },
        {
            "id": 9,
            "key": "ANTIDOTE",
            "itemId": "ITEM_ANTIDOTE",
            "name": "Antídoto",
            "category": "status",
            "price": 100,
            "usableInBattle": True,
            "usableInOverworld": True,
            "cureStatus": "POISON",
            "description": "Cura el envenenamiento (normal o grave) de un Pokémon.",
        },
        {
            "id": 10,
            "key": "PARALYZE_HEAL",
            "itemId": "ITEM_PARALYZE_HEAL",
            "name": "Antiparalizar",
            "category": "status",
            "price": 200,
            "usableInBattle": True,
            "usableInOverworld": True,
            "cureStatus": "PARALYSIS",
            "description": "Cura la parálisis de un Pokémon.",
        },
        {
            "id": 11,
            "key": "AWAKENING",
            "itemId": "ITEM_AWAKENING",
            "name": "Despertar",
            "category": "status",
            "price": 250,
            "usableInBattle": True,
            "usableInOverworld": True,
            "cureStatus": "SLEEP",
            "description": "Despierta a un Pokémon dormido.",
        },
        {
            "id": 12,
            "key": "BURN_HEAL",
            "itemId": "ITEM_BURN_HEAL",
            "name": "Antiquemar",
            "category": "status",
            "price": 250,
            "usableInBattle": True,
            "usableInOverworld": True,
            "cureStatus": "BURN",
            "description": "Cura las quemaduras de un Pokémon.",
        },
        {
            "id": 13,
            "key": "ICE_HEAL",
            "itemId": "ITEM_ICE_HEAL",
            "name": "Antihielo",
            "category": "status",
            "price": 250,
            "usableInBattle": True,
            "usableInOverworld": True,
            "cureStatus": "FREEZE",
            "description": "Descongela a un Pokémon congelado.",
        },
        {
            "id": 14,
            "key": "REVIVE",
            "itemId": "ITEM_REVIVE",
            "name": "Revivir",
            "category": "revive",
            "price": 1500,
            "usableInBattle": True,
            "usableInOverworld": True,
            "revive": True,
            "healFraction": 0.5,
            "description": "Reanima a un Pokémon debilitado y restaura la mitad de sus PS máximos.",
        },
        # Piedras y Objetos Evolutivos (con guía integrada)
        {
            "id": 15,
            "key": "FIRE_STONE",
            "itemId": "ITEM_FIRE_STONE",
            "name": "Piedra Fuego",
            "category": "evolution",
            "price": 2100,
            "usableInBattle": False,
            "usableInOverworld": True,
            "evolvesSpecies": [
                {"from": "Vulpix", "to": "Ninetales"},
                {"from": "Growlithe", "to": "Arcanine"},
                {"from": "Eevee", "to": "Flareon"},
            ],
            "description": "Piedra evolutiva ardiente. Evoluciona a: Vulpix -> Ninetales, Growlithe -> Arcanine y Eevee -> Flareon.",
        },
        {
            "id": 16,
            "key": "WATER_STONE",
            "itemId": "ITEM_WATER_STONE",
            "name": "Piedra Agua",
            "category": "evolution",
            "price": 2100,
            "usableInBattle": False,
            "usableInOverworld": True,
            "evolvesSpecies": [
                {"from": "Poliwhirl", "to": "Poliwrath"},
                {"from": "Shellder", "to": "Cloyster"},
                {"from": "Staryu", "to": "Starmie"},
                {"from": "Eevee", "to": "Vaporeon"},
            ],
            "description": "Piedra evolutiva cristalina. Evoluciona a: Poliwhirl -> Poliwrath, Shellder -> Cloyster, Staryu -> Starmie y Eevee -> Vaporeon.",
        },
        {
            "id": 17,
            "key": "THUNDER_STONE",
            "itemId": "ITEM_THUNDER_STONE",
            "name": "Piedra Trueno",
            "category": "evolution",
            "price": 2100,
            "usableInBattle": False,
            "usableInOverworld": True,
            "evolvesSpecies": [
                {"from": "Pikachu", "to": "Raichu"},
                {"from": "Eevee", "to": "Jolteon"},
            ],
            "description": "Piedra evolutiva eléctrica. Evoluciona a: Pikachu -> Raichu y Eevee -> Jolteon.",
        },
        {
            "id": 18,
            "key": "LEAF_STONE",
            "itemId": "ITEM_LEAF_STONE",
            "name": "Piedra Hoja",
            "category": "evolution",
            "price": 2100,
            "usableInBattle": False,
            "usableInOverworld": True,
            "evolvesSpecies": [
                {"from": "Gloom", "to": "Vileplume"},
                {"from": "Weepinbell", "to": "Victreebel"},
                {"from": "Exeggcute", "to": "Exeggutor"},
            ],
            "description": "Piedra evolutiva frondosa. Evoluciona a: Gloom -> Vileplume, Weepinbell -> Victreebel y Exeggcute -> Exeggutor.",
        },
        {
            "id": 19,
            "key": "MOON_STONE",
            "itemId": "ITEM_MOON_STONE",
            "name": "Piedra Lunar",
            "category": "evolution",
            "price": 2100,
            "usableInBattle": False,
            "usableInOverworld": True,
            "evolvesSpecies": [
                {"from": "Nidorina", "to": "Nidoqueen"},
                {"from": "Nidorino", "to": "Nidoking"},
                {"from": "Clefairy", "to": "Clefable"},
                {"from": "Jigglypuff", "to": "Wigglytuff"},
            ],
            "description": "Piedra evolutiva nocturna. Evoluciona a: Nidorina -> Nidoqueen, Nidorino -> Nidoking, Clefairy -> Clefable y Jigglypuff -> Wigglytuff.",
        },
        {
            "id": 20,
            "key": "LINKING_CORD",
            "itemId": "ITEM_LINKING_CORD",
            "name": "Cordón Unión",
            "category": "evolution",
            "price": 3000,
            "usableInBattle": False,
            "usableInOverworld": True,
            "evolvesSpecies": [
                {"from": "Kadabra", "to": "Alakazam"},
                {"from": "Machoke", "to": "Machamp"},
                {"from": "Graveler", "to": "Golem"},
                {"from": "Haunter", "to": "Gengar"},
            ],
            "description": "Cable especial que libera la evolución sin necesidad de intercambio. Evoluciona a: Kadabra -> Alakazam, Machoke -> Machamp, Graveler -> Golem y Haunter -> Gengar.",
        },
    ]

    save_json("items.json", items)
    return items


def update_audit_report(
    sp_summary: dict[str, Any],
    wild_summary: dict[str, Any],
    evo_summary: dict[str, Any],
    items_list: list[dict[str, Any]],
) -> None:
    report_path = DATA_DIR / "REPORTE_CAPTURA_Y_EVOLUCION.md"
    raw = report_path.read_text(encoding="utf-8")

    marker = "<!-- BALANCE_PATCH_SECTION -->"
    if marker in raw:
        base_text = raw.split(marker, 1)[0].rstrip()
    else:
        base_text = raw.rstrip()

    lines: list[str] = [
        "",
        "",
        marker,
        "---",
        "",
        "## D. Resumen de cambios aplicados tras el parche de balanceo (`apply_balance_patch.py`)",
        "",
        "> Las secciones **A, B y C** anteriores documentan la línea base original extraída de `pokefirered`. A continuación se resumen las modificaciones aplicadas en `juego-html/data/`.",
        "",
        "### D.1. Ajuste de `catchRate` en Zona Safari y hábitos horarios (`species.json`)",
        "",
        f"- **Especies modificadas:** {len(sp_summary['catch_changes'])} especies de la Zona Safari con `catchRate < 60` (las otras 144 especies permanecen intactas):",
    ]

    for ch in sp_summary["catch_changes"]:
        lines.append(f"  - **#{ch['id']:03d} {ch['name']}:** `{ch['old']}` → `{ch['new']}`")

    pc = sp_summary["period_counts"]
    lines.extend([
        f"- **Distribución de `activityPeriod` (151 especies):** `{pc['diurnal']}` diurnas (`diurnal`), `{pc['nocturnal']}` nocturnas (`nocturnal`), `{pc['any']}` sin restricción (`any`).",
        "",
        "### D.2. Unificación de encuentros, rarezas y entorno (`wild_encounters.json`)",
        "",
        f"- **Zonas procesadas:** {wild_summary['zones']} zonas totales (`{wild_summary['env_counts']['outdoor']}` con `environment: \"outdoor\"` y `{wild_summary['env_counts']['cave']}` con `environment: \"cave\"`).",
        f"- **Tablas unificadas (`fireRed` + `leafGreen`):** {wild_summary['unified_tables']} tablas de encuentro (todas verificadas al **100 % exacto**).",
        f"- **Ajuste de especies raras (1 %–4 % → 5 %–8 %):** {wild_summary['boosted_entries']} apariciones elevadas en total, descontando la diferencia proporcionalmente de las especies más comunes de cada tabla.",
        "",
        "### D.3. Filtrado de evoluciones y `Cordón Unión` (`evolutions.json` y `items.json`)",
        "",
        f"- **Cadenas evolutivas resultantes en Kanto:** {evo_summary['chains_count']} entradas activas.",
        f"- **Evoluciones fuera de Kanto filtradas (`targetInKanto: false`):** {len(evo_summary['filtered_out'])} ({', '.join(evo_summary['filtered_out'])}).",
        f"- **Evoluciones por intercambio convertidas a `ITEM_LINKING_CORD` (Cordón Unión):** {len(evo_summary['converted_trade'])} ({', '.join(evo_summary['converted_trade'])}).",
        f"- **Catálogo de tienda (`items.json`):** {len(items_list)} objetos configurados (4 Poké Balls, 10 objetos de curación/estado/revivir, 5 Piedras Evolutivas y **Cordón Unión** a ₽3,000 con guía de evolución integrada).",
        "",
    ])

    report_path.write_text(base_text + "\n".join(lines), encoding="utf-8")
    print(f"Updated {report_path.relative_to(REPO_ROOT)}")


def main() -> None:
    sp_summary = patch_species()
    wild_summary = patch_wild_encounters()
    evo_summary = patch_evolutions()
    items_list = generate_items_catalog()
    update_audit_report(sp_summary, wild_summary, evo_summary, items_list)
    print("Balance patch applied and verified successfully.")


if __name__ == "__main__":
    main()
