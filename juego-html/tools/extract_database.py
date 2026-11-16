#!/usr/bin/env python3
"""
Extracts clean JSON game data for Pokémon FireRed/LeafGreen Web Edition
from the read-only pret/pokefirered C/JSON sources into juego-html/data/.

Outputs:
  - juego-html/data/species.json
  - juego-html/data/moves.json
  - juego-html/data/type_chart.json
  - juego-html/data/evolutions.json
  - juego-html/data/wild_encounters.json
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_OUT = REPO_ROOT / "juego-html" / "data"

KANTO_MAX_ID = 151

PHYSICAL_TYPES = {
    "NORMAL",
    "FIGHTING",
    "FLYING",
    "POISON",
    "GROUND",
    "ROCK",
    "BUG",
    "GHOST",
    "STEEL",
}

SPECIAL_TYPES = {
    "FIRE",
    "WATER",
    "GRASS",
    "ELECTRIC",
    "PSYCHIC",
    "ICE",
    "DRAGON",
    "DARK",
}

BATTLE_TYPES = [
    "NORMAL",
    "FIGHTING",
    "FLYING",
    "POISON",
    "GROUND",
    "ROCK",
    "BUG",
    "GHOST",
    "STEEL",
    "FIRE",
    "WATER",
    "GRASS",
    "ELECTRIC",
    "PSYCHIC",
    "ICE",
    "DRAGON",
    "DARK",
]

SEVII_MAP_PREFIXES = (
    "MAP_ONE_ISLAND",
    "MAP_TWO_ISLAND",
    "MAP_THREE_ISLAND",
    "MAP_FOUR_ISLAND",
    "MAP_FIVE_ISLAND",
    "MAP_SIX_ISLAND",
    "MAP_SEVEN_ISLAND",
    "MAP_MT_EMBER",
)


def read_text(rel_path: str) -> str:
    return (REPO_ROOT / rel_path).read_text(encoding="utf-8")


def format_gba_name(raw: str) -> str:
    """Convert GBA uppercase text like FARFETCH'D or DOUBLE-EDGE to Title Case."""
    def cap_token(token: str) -> str:
        if not token:
            return token
        if "'" in token:
            head, tail = token.split("'", 1)
            return head.capitalize() + "'" + tail.lower()
        return token.capitalize()

    parts = raw.split(" ")
    formatted_parts = []
    for part in parts:
        subparts = part.split("-")
        formatted_parts.append("-".join(cap_token(sp) for sp in subparts))
    return " ".join(formatted_parts)


def format_map_name(map_id: str, variant_suffix: str = "") -> str:
    """Convert MAP_MT_MOON_1F into readable name like 'Mt. Moon 1F'."""
    name = map_id.removeprefix("MAP_")
    special_tokens = {
        "SSANNE": "S.S. Anne",
        "MT": "Mt.",
        "DIGLETTS": "Diglett's",
        "POKEMON": "Pokémon",
        "1F": "1F",
        "2F": "2F",
        "3F": "3F",
        "4F": "4F",
        "5F": "5F",
        "6F": "6F",
        "7F": "7F",
        "B1F": "B1F",
        "B2F": "B2F",
        "B3F": "B3F",
        "B4F": "B4F",
    }

    # Handle ROUTE1 .. ROUTE25
    m_route = re.match(r"^ROUTE(\d+)(?:_(NORTH|SOUTH|EAST|WEST))?$", name)
    if m_route:
        num = m_route.group(1)
        direction = m_route.group(2)
        if direction:
            return f"Route {num} ({direction.capitalize()})"
        return f"Route {num}"

    tokens = name.split("_")
    out: list[str] = []
    for tok in tokens:
        if tok in special_tokens:
            out.append(special_tokens[tok])
        elif re.match(r"^ROOM\d+$", tok):
            out.append(f"Room {tok[4:]}")
        else:
            out.append(tok.capitalize())

    label = " ".join(out)
    if variant_suffix:
        label = f"{label} ({variant_suffix})"
    return label


def strip_c_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"//.*", "", text)
    return text


def parse_define_ints(rel_path: str, prefix: str) -> dict[str, int]:
    txt = strip_c_comments(read_text(rel_path))
    pattern = re.compile(rf"#define\s+({re.escape(prefix)}\w+)\s+(\d+)")
    return {m.group(1): int(m.group(2)) for m in pattern.finditer(txt)}


def parse_gba_text_table(rel_path: str, key_prefix: str) -> dict[str, str]:
    txt = strip_c_comments(read_text(rel_path))
    pattern = re.compile(rf"\[({re.escape(key_prefix)}\w+)\]\s*=\s*_\(\"([^\"]*)\"\)")
    return {m.group(1): m.group(2) for m in pattern.finditer(txt)}


def eval_gender_ratio(expr: str) -> int:
    expr = expr.strip()
    if expr == "MON_MALE":
        return 0
    if expr == "MON_FEMALE":
        return 254
    if expr == "MON_GENDERLESS":
        return 255
    m = re.match(r"PERCENT_FEMALE\(\s*([0-9.]+)\s*\)", expr)
    if m:
        pct = float(m.group(1))
        return min(254, int(math.floor((pct * 255.0) / 100.0)))
    return int(expr)


def extract_brace_block(text: str, start_brace_idx: int) -> tuple[str, int]:
    """Return content inside matching braces starting at start_brace_idx."""
    assert text[start_brace_idx] == "{"
    depth = 0
    i = start_brace_idx
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start_brace_idx + 1 : i], i
        i += 1
    raise ValueError("Unmatched '{' while parsing C file")


def parse_species_constants() -> tuple[dict[str, int], dict[int, str]]:
    sp_map = parse_define_ints("include/constants/species.h", "SPECIES_")
    id_to_const = {v: k for k, v in sp_map.items() if 1 <= v <= 411}
    return sp_map, id_to_const


def parse_move_constants() -> tuple[dict[str, int], dict[int, str]]:
    mv_map = parse_define_ints("include/constants/moves.h", "MOVE_")
    id_to_const = {v: k for k, v in mv_map.items() if v > 0}
    return mv_map, id_to_const


def parse_item_names() -> dict[str, str]:
    items_json = json.loads(read_text("src/data/items.json"))
    out: dict[str, str] = {}
    for item in items_json.get("items", []):
        item_id = item.get("itemId", "")
        eng = item.get("english", "")
        if item_id:
            out[item_id] = format_gba_name(eng) if eng else item_id
    return out


def parse_level_up_learnsets(move_consts: dict[str, int], move_names: dict[str, str]) -> dict[str, list[dict[str, Any]]]:
    ptrs_txt = strip_c_comments(read_text("src/data/pokemon/level_up_learnset_pointers.h"))
    ptr_map = dict(re.findall(r"\[(SPECIES_\w+)\]\s*=\s*(\w+),", ptrs_txt))

    learnsets_txt = strip_c_comments(read_text("src/data/pokemon/level_up_learnsets.h"))
    table_map: dict[str, list[dict[str, Any]]] = {}

    for m in re.finditer(r"static\s+const\s+u16\s+(\w+)\[\]\s*=\s*\{([^}]*)\}", learnsets_txt):
        tbl_name = m.group(1)
        body = m.group(2)
        entries: list[dict[str, Any]] = []
        for lm in re.finditer(r"LEVEL_UP_MOVE\(\s*(\d+)\s*,\s*(MOVE_\w+)\s*\)", body):
            lvl = int(lm.group(1))
            mv_const = lm.group(2)
            entries.append({
                "level": lvl,
                "moveId": move_consts[mv_const],
                "moveKey": mv_const.removeprefix("MOVE_"),
                "moveName": format_gba_name(move_names[mv_const]),
            })
        table_map[tbl_name] = entries

    by_species: dict[str, list[dict[str, Any]]] = {}
    for sp_const, tbl_name in ptr_map.items():
        if sp_const != "SPECIES_NONE":
            by_species[sp_const] = table_map.get(tbl_name, [])
    return by_species


def parse_tmhm_learnsets(valid_moves: set[str]) -> dict[str, list[str]]:
    txt = strip_c_comments(read_text("src/data/pokemon/tmhm_learnsets.h"))
    out: dict[str, list[str]] = {}
    for chunk in txt.split("[SPECIES_")[1:]:
        sp_const = "SPECIES_" + chunk.split("]", 1)[0].strip()
        if sp_const == "SPECIES_NONE":
            continue
        tms = re.findall(r"TMHM\(\s*([^)\s]+)\s*\)", chunk)
        moves: list[str] = []
        for tm in tms:
            mv_const = "MOVE_" + re.sub(r"^(?:TM\d+|HM\d+)_", "", tm)
            if mv_const in valid_moves:
                moves.append(mv_const)
        out[sp_const] = moves
    return out


def parse_tutor_learnsets() -> dict[str, list[str]]:
    txt = strip_c_comments(read_text("src/data/pokemon/tutor_learnsets.h"))
    out: dict[str, list[str]] = {}
    for chunk in txt.split("[SPECIES_")[1:]:
        sp_const = "SPECIES_" + chunk.split("]", 1)[0].strip()
        if sp_const == "SPECIES_NONE":
            continue
        out[sp_const] = re.findall(r"TUTOR\(\s*(MOVE_\w+)\s*\)", chunk)
    return out


def parse_egg_moves() -> dict[str, list[str]]:
    txt = strip_c_comments(read_text("src/data/pokemon/egg_moves.h"))
    out: dict[str, list[str]] = {}
    for m in re.finditer(r"egg_moves\(\s*(\w+)\s*,([^)]+)\)", txt):
        sp_const = "SPECIES_" + m.group(1)
        out[sp_const] = re.findall(r"MOVE_\w+", m.group(2))
    return out


def parse_species_and_safari_set(
    sp_consts: dict[str, int],
    sp_names: dict[str, str],
    level_up_map: dict[str, list[dict[str, Any]]],
    tmhm_map: dict[str, list[str]],
    safari_species_set: set[str],
) -> list[dict[str, Any]]:
    raw_txt = strip_c_comments(read_text("src/data/pokemon/species_info.h"))
    # Isolate gSpeciesInfo[] body to avoid OLD_UNOWN_SPECIES_INFO macro definition
    idx_start = raw_txt.index("const struct SpeciesInfo gSpeciesInfo[]")
    brace_idx = raw_txt.index("{", idx_start)
    info_body, _ = extract_brace_block(raw_txt, brace_idx)

    species_by_const: dict[str, dict[str, Any]] = {}
    pos = 0
    entry_re = re.compile(r"\[(SPECIES_\w+)\]\s*=\s*\{")

    while True:
        m = entry_re.search(info_body, pos)
        if not m:
            break
        sp_const = m.group(1)
        open_brace = m.end() - 1
        block, end_brace = extract_brace_block(info_body, open_brace)
        pos = end_brace + 1

        sp_id = sp_consts.get(sp_const, 0)
        if not (1 <= sp_id <= KANTO_MAX_ID):
            continue

        def get_int(field: str) -> int:
            fm = re.search(rf"\.{field}\s*=\s*(\d+)", block)
            if not fm:
                raise ValueError(f"Missing .{field} for {sp_const}")
            return int(fm.group(1))

        def get_str(field: str) -> str:
            fm = re.search(rf"\.{field}\s*=\s*([^\n,]+)", block)
            if not fm:
                raise ValueError(f"Missing .{field} for {sp_const}")
            return fm.group(1).strip()

        types_m = re.search(r"\.types\s*=\s*\{\s*(TYPE_\w+)\s*,\s*(TYPE_\w+)\s*\}", block)
        assert types_m, f"Missing .types for {sp_const}"
        t1 = types_m.group(1).removeprefix("TYPE_")
        t2 = types_m.group(2).removeprefix("TYPE_")
        types = [t1] if t1 == t2 else [t1, t2]

        ab_m = re.search(r"\.abilities\s*=\s*\{\s*(ABILITY_\w+)\s*,\s*(ABILITY_\w+)\s*\}", block)
        assert ab_m, f"Missing .abilities for {sp_const}"
        abilities = [
            ab.removeprefix("ABILITY_")
            for ab in (ab_m.group(1), ab_m.group(2))
            if ab != "ABILITY_NONE"
        ]

        growth_rate = get_str("growthRate").removeprefix("GROWTH_")
        gender_ratio = eval_gender_ratio(get_str("genderRatio"))
        safari_flee = get_int("safariZoneFleeRate")

        species_by_const[sp_const] = {
            "id": sp_id,
            "key": sp_const.removeprefix("SPECIES_"),
            "name": format_gba_name(sp_names[sp_const]),
            "types": types,
            "baseStats": {
                "hp": get_int("baseHP"),
                "attack": get_int("baseAttack"),
                "defense": get_int("baseDefense"),
                "speed": get_int("baseSpeed"),
                "spAttack": get_int("baseSpAttack"),
                "spDefense": get_int("baseSpDefense"),
            },
            "catchRate": get_int("catchRate"),
            "expYield": get_int("expYield"),
            "evYield": {
                "hp": get_int("evYield_HP"),
                "attack": get_int("evYield_Attack"),
                "defense": get_int("evYield_Defense"),
                "speed": get_int("evYield_Speed"),
                "spAttack": get_int("evYield_SpAttack"),
                "spDefense": get_int("evYield_SpDefense"),
            },
            "growthRate": growth_rate,
            "abilities": abilities,
            "genderRatio": gender_ratio,
            "safariZoneFleeRate": safari_flee,
            "inSafariZone": sp_const in safari_species_set,
            "levelUpMoves": level_up_map.get(sp_const, []),
            "tmhmMoves": [mv.removeprefix("MOVE_") for mv in tmhm_map.get(sp_const, [])],
        }

    species_list = sorted(species_by_const.values(), key=lambda s: s["id"])
    assert len(species_list) == KANTO_MAX_ID, f"Expected 151 species, got {len(species_list)}"
    return species_list


def parse_move_descriptions() -> dict[str, str]:
    txt = strip_c_comments(read_text("src/move_descriptions.c"))
    # Parse const u8 gMoveDescription_X[] = _("...");
    var_to_desc: dict[str, str] = {}
    for m in re.finditer(r"const\s+u8\s+(gMoveDescription_\w+)\[\]\s*=\s*_\((.*?)\);", txt, flags=re.S):
        var_name = m.group(1)
        raw_parts = re.findall(r'"([^"]*)"', m.group(2))
        joined = "".join(raw_parts).replace("\\n", " ").replace("  ", " ").strip()
        var_to_desc[var_name] = joined

    ptr_block_m = re.search(
        r"const\s+u8\s+\*const\s+gMoveDescriptionPointers\[[^\]]+\]\s*=\s*\{([^}]+)\}",
        txt,
        flags=re.S,
    )
    assert ptr_block_m, "Could not find gMoveDescriptionPointers"
    out: dict[str, str] = {}
    for pm in re.finditer(r"\[(MOVE_\w+)\s*-\s*1\]\s*=\s*(gMoveDescription_\w+)", ptr_block_m.group(1)):
        out[pm.group(1)] = var_to_desc.get(pm.group(2), "")
    return out


def parse_moves(
    used_move_consts: set[str],
    move_consts: dict[str, int],
    move_names: dict[str, str],
    move_descs: dict[str, str],
) -> list[dict[str, Any]]:
    raw_txt = strip_c_comments(read_text("src/data/battle_moves.h"))
    idx_start = raw_txt.index("const struct BattleMove gBattleMoves")
    brace_idx = raw_txt.index("{", idx_start)
    moves_body, _ = extract_brace_block(raw_txt, brace_idx)

    moves_list: list[dict[str, Any]] = []
    pos = 0
    entry_re = re.compile(r"\[(MOVE_\w+)\]\s*=\s*\{")

    while True:
        m = entry_re.search(moves_body, pos)
        if not m:
            break
        mv_const = m.group(1)
        open_brace = m.end() - 1
        block, end_brace = extract_brace_block(moves_body, open_brace)
        pos = end_brace + 1

        if mv_const == "MOVE_NONE" or mv_const not in used_move_consts:
            continue

        def get_int(field: str) -> int:
            fm = re.search(rf"\.{field}\s*=\s*(-?\d+)", block)
            if not fm:
                raise ValueError(f"Missing .{field} for {mv_const}")
            return int(fm.group(1))

        def get_str(field: str) -> str:
            fm = re.search(rf"\.{field}\s*=\s*([^\n,]+)", block)
            if not fm:
                raise ValueError(f"Missing .{field} for {mv_const}")
            return fm.group(1).strip()

        power = get_int("power")
        mv_type = get_str("type").removeprefix("TYPE_")
        if power == 0:
            category = "status"
        elif mv_type in PHYSICAL_TYPES:
            category = "physical"
        elif mv_type in SPECIAL_TYPES:
            category = "special"
        else:
            category = "status"

        flags_str = get_str("flags")
        effect = get_str("effect")

        moves_list.append({
            "id": move_consts[mv_const],
            "key": mv_const.removeprefix("MOVE_"),
            "name": format_gba_name(move_names[mv_const]),
            "type": mv_type,
            "category": category,
            "power": power,
            "accuracy": get_int("accuracy"),
            "pp": get_int("pp"),
            "priority": get_int("priority"),
            "effect": effect,
            "effectChance": get_int("secondaryEffectChance"),
            "target": get_str("target"),
            "makesContact": "FLAG_MAKES_CONTACT" in flags_str,
            "description": move_descs.get(mv_const, ""),
        })

    moves_list.sort(key=lambda x: x["id"])
    return moves_list


def parse_type_chart() -> dict[str, Any]:
    txt = strip_c_comments(read_text("src/battle_main.c"))
    m = re.search(r"const\s+u8\s+gTypeEffectiveness\[\d+\]\s*=\s*\{([^}]+)\}", txt, flags=re.S)
    assert m, "Could not find gTypeEffectiveness in src/battle_main.c"
    tokens = re.findall(r"(TYPE_\w+)", m.group(1))

    mul_map = {
        "TYPE_MUL_SUPER_EFFECTIVE": 2.0,
        "TYPE_MUL_NORMAL": 1.0,
        "TYPE_MUL_NOT_EFFECTIVE": 0.5,
        "TYPE_MUL_NO_EFFECT": 0.0,
    }

    effectiveness: dict[str, dict[str, float]] = {
        atk: {defn: 1.0 for defn in BATTLE_TYPES} for atk in BATTLE_TYPES
    }
    foresight_immunities: list[dict[str, str]] = []
    after_foresight = False

    for i in range(0, len(tokens), 3):
        atk_tok, def_tok, mul_tok = tokens[i], tokens[i + 1], tokens[i + 2]
        if atk_tok == "TYPE_ENDTABLE":
            break
        if atk_tok == "TYPE_FORESIGHT":
            after_foresight = True
            continue
        atk = atk_tok.removeprefix("TYPE_")
        defn = def_tok.removeprefix("TYPE_")
        mult = mul_map[mul_tok]
        effectiveness[atk][defn] = mult
        if after_foresight and mult == 0.0:
            foresight_immunities.append({"attack": atk, "defend": defn})

    return {
        "types": BATTLE_TYPES,
        "physicalTypes": sorted(PHYSICAL_TYPES, key=BATTLE_TYPES.index),
        "specialTypes": sorted(SPECIAL_TYPES, key=BATTLE_TYPES.index),
        "foresightIgnoresImmunity": foresight_immunities,
        "effectiveness": effectiveness,
    }


def parse_evolutions(
    sp_consts: dict[str, int],
    sp_names: dict[str, str],
    item_names: dict[str, str],
) -> list[dict[str, Any]]:
    raw_txt = strip_c_comments(read_text("src/data/pokemon/evolution.h"))
    idx_start = raw_txt.index("const struct Evolution gEvolutionTable")
    brace_idx = raw_txt.index("{", idx_start)
    body, _ = extract_brace_block(raw_txt, brace_idx)

    evolutions_list: list[dict[str, Any]] = []
    pos = 0
    entry_re = re.compile(r"\[(SPECIES_\w+)\]\s*=\s*\{")

    while True:
        m = entry_re.search(body, pos)
        if not m:
            break
        from_const = m.group(1)
        open_brace = m.end() - 1
        block, end_brace = extract_brace_block(body, open_brace)
        pos = end_brace + 1

        from_id = sp_consts.get(from_const, 0)
        if not (1 <= from_id <= KANTO_MAX_ID):
            continue

        evos: list[dict[str, Any]] = []
        for em in re.finditer(r"\{\s*(EVO_\w+)\s*,\s*([^,]+?)\s*,\s*(SPECIES_\w+)\s*\}", block):
            method = em.group(1)
            param_raw = em.group(2).strip()
            target_const = em.group(3)
            target_id = sp_consts[target_const]

            item_key = None
            item_name = None
            level = None
            if method in ("EVO_ITEM", "EVO_TRADE_ITEM"):
                item_key = param_raw.removeprefix("ITEM_")
                item_name = item_names.get(param_raw, format_gba_name(item_key.replace("_", " ")))
            elif method == "EVO_LEVEL":
                level = int(param_raw)

            evos.append({
                "method": method,
                "param": param_raw,
                "level": level,
                "item": item_key,
                "itemName": item_name,
                "requiresTrade": method in ("EVO_TRADE", "EVO_TRADE_ITEM"),
                "targetSpeciesId": target_id,
                "targetSpeciesKey": target_const.removeprefix("SPECIES_"),
                "targetSpeciesName": format_gba_name(sp_names[target_const]),
                "targetInKanto": target_id <= KANTO_MAX_ID,
            })

        evolutions_list.append({
            "speciesId": from_id,
            "speciesKey": from_const.removeprefix("SPECIES_"),
            "speciesName": format_gba_name(sp_names[from_const]),
            "evolutions": evos,
        })

    evolutions_list.sort(key=lambda e: e["speciesId"])
    return evolutions_list


def aggregate_encounter_group(
    enc_entry: dict[str, Any],
    fields_meta: dict[str, Any],
    sp_consts: dict[str, int],
    sp_names: dict[str, str],
) -> dict[str, Any]:
    """Aggregate slots by encounter method (and rod sub-type) for one version entry."""
    method_map = {
        "land_mons": ("land", None),
        "water_mons": ("water", None),
        "rock_smash_mons": ("rockSmash", None),
        "fishing_mons": ("fishing", {"old_rod": "oldRod", "good_rod": "goodRod", "super_rod": "superRod"}),
    }

    result: dict[str, Any] = {}
    for raw_type, (out_name, rod_rename) in method_map.items():
        if raw_type not in enc_entry:
            continue
        raw_obj = enc_entry[raw_type]
        rates = fields_meta[raw_type]["encounter_rates"]
        mons = raw_obj["mons"]
        enc_rate = raw_obj["encounter_rate"]

        if rod_rename:
            subgroups = fields_meta[raw_type]["groups"]
            target_groups = [(rod_rename[sub_k], idxs) for sub_k, idxs in subgroups.items()]
        else:
            target_groups = [(out_name, list(range(len(mons))))]

        for method_key, indices in target_groups:
            by_species: dict[str, dict[str, Any]] = {}
            for idx in indices:
                mon = mons[idx]
                sp_const = mon["species"]
                sp_id = sp_consts[sp_const]
                slot_rate = rates[idx]
                mn = mon["min_level"]
                mx = mon["max_level"]

                if sp_const not in by_species:
                    by_species[sp_const] = {
                        "speciesId": sp_id,
                        "speciesKey": sp_const.removeprefix("SPECIES_"),
                        "speciesName": format_gba_name(sp_names[sp_const]),
                        "isKanto": sp_id <= KANTO_MAX_ID,
                        "minLevel": mn,
                        "maxLevel": mx,
                        "rate": 0,
                        "slots": [],
                    }
                entry = by_species[sp_const]
                entry["rate"] += slot_rate
                entry["minLevel"] = min(entry["minLevel"], mn)
                entry["maxLevel"] = max(entry["maxLevel"], mx)
                entry["slots"].append({
                    "slot": idx,
                    "rate": slot_rate,
                    "minLevel": mn,
                    "maxLevel": mx,
                })

            # Sort encounters from highest rate to lowest rate, then by speciesId
            sorted_encs = sorted(
                by_species.values(),
                key=lambda x: (-x["rate"], x["speciesId"]),
            )
            result[method_key] = {
                "encounterRate": enc_rate,
                "encounters": sorted_encs,
            }

    return result


def parse_wild_encounters(
    sp_consts: dict[str, int],
    sp_names: dict[str, str],
) -> tuple[dict[str, Any], set[str]]:
    raw = json.loads(read_text("src/data/wild_encounters.json"))
    group = raw["wild_encounter_groups"][0]
    fields_meta = {f["type"]: f for f in group["fields"]}

    # Pair FireRed and LeafGreen entries by stripped base_label
    paired: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    safari_species: set[str] = set()

    for enc in group["encounters"]:
        base_label = enc["base_label"]
        if base_label.endswith("_FireRed"):
            ver = "fireRed"
            zone_key = base_label.removesuffix("_FireRed")
        elif base_label.endswith("_LeafGreen"):
            ver = "leafGreen"
            zone_key = base_label.removesuffix("_LeafGreen")
        else:
            raise ValueError(f"Unexpected base_label: {base_label}")

        map_id = enc["map"]
        is_safari = "SAFARI_ZONE" in map_id
        if is_safari:
            for t in ("land_mons", "water_mons", "rock_smash_mons", "fishing_mons"):
                if t in enc:
                    for m in enc[t]["mons"]:
                        safari_species.add(m["species"])

        # Handle Altering Cave variant labels like sSixIslandAlteringCave_2
        variant_suffix = ""
        m_alt = re.match(r"^sSixIslandAlteringCave_(\d+)$", zone_key)
        if m_alt:
            variant_suffix = f"Variant {m_alt.group(1)}"
        elif zone_key == "sSixIslandAlteringCave":
            variant_suffix = "Variant 1"

        if zone_key not in paired:
            order.append(zone_key)
            region = "sevii" if map_id.startswith(SEVII_MAP_PREFIXES) else "kanto"
            paired[zone_key] = {
                "zoneId": zone_key.removeprefix("s"),
                "mapId": map_id,
                "name": format_map_name(map_id, variant_suffix),
                "region": region,
                "isSafariZone": is_safari,
                "fireRed": {},
                "leafGreen": {},
            }

        paired[zone_key][ver] = aggregate_encounter_group(enc, fields_meta, sp_consts, sp_names)

    zones = [paired[k] for k in order]
    wild_data = {
        "metadata": {
            "source": "src/data/wild_encounters.json",
            "versions": ["fireRed", "leafGreen"],
            "slotWeights": {
                "land": fields_meta["land_mons"]["encounter_rates"],
                "water": fields_meta["water_mons"]["encounter_rates"],
                "rockSmash": fields_meta["rock_smash_mons"]["encounter_rates"],
                "oldRod": [fields_meta["fishing_mons"]["encounter_rates"][i] for i in fields_meta["fishing_mons"]["groups"]["old_rod"]],
                "goodRod": [fields_meta["fishing_mons"]["encounter_rates"][i] for i in fields_meta["fishing_mons"]["groups"]["good_rod"]],
                "superRod": [fields_meta["fishing_mons"]["encounter_rates"][i] for i in fields_meta["fishing_mons"]["groups"]["super_rod"]],
            },
        },
        "zones": zones,
    }
    return wild_data, safari_species


def collect_kanto_trainer_moves(kanto_consts: set[str]) -> set[str]:
    txt = strip_c_comments(read_text("src/data/trainer_parties.h"))
    tr_moves: set[str] = set()
    for m in re.finditer(r"\{[^}]*\.species\s*=\s*(SPECIES_\w+)[^}]*\.moves\s*=\s*\{([^}]+)\}[^}]*\}", txt):
        if m.group(1) in kanto_consts:
            for mv in re.findall(r"MOVE_\w+", m.group(2)):
                if mv != "MOVE_NONE":
                    tr_moves.add(mv)
    return tr_moves


def write_json(filename: str, payload: Any) -> None:
    DATA_OUT.mkdir(parents=True, exist_ok=True)
    path = DATA_OUT / filename
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {path.relative_to(REPO_ROOT)}")


def main() -> None:
    sp_consts, id_to_sp = parse_species_constants()
    mv_consts, _ = parse_move_constants()
    sp_names = parse_gba_text_table("src/data/text/species_names.h", "SPECIES_")
    mv_names = parse_gba_text_table("src/data/text/move_names.h", "MOVE_")
    item_names = parse_item_names()

    kanto_consts = {id_to_sp[i] for i in range(1, KANTO_MAX_ID + 1)}
    valid_moves = set(mv_consts.keys()) - {"MOVE_NONE", "MOVE_UNAVAILABLE"}

    wild_data, safari_species = parse_wild_encounters(sp_consts, sp_names)
    level_up_map = parse_level_up_learnsets(mv_consts, mv_names)
    tmhm_map = parse_tmhm_learnsets(valid_moves)
    tutor_map = parse_tutor_learnsets()
    egg_map = parse_egg_moves()
    trainer_moves = collect_kanto_trainer_moves(kanto_consts)

    species_list = parse_species_and_safari_set(
        sp_consts=sp_consts,
        sp_names=sp_names,
        level_up_map=level_up_map,
        tmhm_map=tmhm_map,
        safari_species_set=safari_species,
    )

    used_moves: set[str] = {"MOVE_STRUGGLE", "MOVE_FRENZY_PLANT", "MOVE_BLAST_BURN", "MOVE_HYDRO_CANNON"}
    used_moves.update(trainer_moves)
    for sp_const in kanto_consts:
        for lv_entry in level_up_map.get(sp_const, []):
            used_moves.add("MOVE_" + lv_entry["moveKey"])
        used_moves.update(tmhm_map.get(sp_const, []))
        used_moves.update(tutor_map.get(sp_const, []))
        used_moves.update(egg_map.get(sp_const, []))

    move_descs = parse_move_descriptions()
    moves_list = parse_moves(used_moves, mv_consts, mv_names, move_descs)
    type_chart = parse_type_chart()
    evolutions_list = parse_evolutions(sp_consts, sp_names, item_names)

    write_json("species.json", species_list)
    write_json("moves.json", moves_list)
    write_json("type_chart.json", type_chart)
    write_json("evolutions.json", evolutions_list)
    write_json("wild_encounters.json", wild_data)

    print(
        f"Extraction complete: {len(species_list)} species, {len(moves_list)} moves, "
        f"{len(type_chart['types'])} types, {len(evolutions_list)} evolution chains, "
        f"{len(wild_data['zones'])} encounter zones."
    )


if __name__ == "__main__":
    main()
