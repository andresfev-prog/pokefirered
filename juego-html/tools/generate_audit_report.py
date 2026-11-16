#!/usr/bin/env python3
"""
Generates juego-html/data/REPORTE_CAPTURA_Y_EVOLUCION.md from the unmodified
extracted JSON databases in juego-html/data/.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "juego-html" / "data"
REPORT_PATH = DATA_DIR / "REPORTE_CAPTURA_Y_EVOLUCION.md"

METHOD_LABELS = {
    "land": "Hierba / Cueva",
    "water": "Agua (Surf)",
    "rockSmash": "Golpe Roca",
    "oldRod": "Caña Vieja",
    "goodRod": "Caña Buena",
    "superRod": "Supercaña",
}


def load_json(name: str) -> Any:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def format_level_range(mn: int, mx: int) -> str:
    return f"Nv. {mn}" if mn == mx else f"Nv. {mn}–{mx}"


def build_section_a(species: list[dict[str, Any]]) -> tuple[list[str], dict[str, int]]:
    safari_low = [s for s in species if s["inSafariZone"] and s["catchRate"] < 60]
    safari_other = [s for s in species if s["inSafariZone"] and s["catchRate"] >= 60]
    non_safari_low = [s for s in species if not s["inSafariZone"] and s["catchRate"] < 60]

    lines: list[str] = [
        "## A. Pokémon con `catchRate` bajo (< 60) o pertenecientes a la Zona Safari",
        "",
        f"Total auditado: **{len(safari_low) + len(safari_other) + len(non_safari_low)} especies** de las 151 de Kanto:",
        f"- **Zona Safari con `catchRate < 60`:** {len(safari_low)} especies (candidatas directas a ajuste moderado 90–120 según `SPEC_MAESTRA.md` §4)",
        f"- **Zona Safari con `catchRate >= 60`:** {len(safari_other)} especies",
        f"- **Fuera de Zona Safari con `catchRate < 60`:** {len(non_safari_low)} especies (legendarios, iniciales, fósiles, evoluciones finales, etc.)",
        "",
        "### A.1. Especies de la Zona Safari con `catchRate < 60`",
        "",
        "| # | ID | Pokémon | Tipos | `catchRate` original | `safariZoneFleeRate` |",
        "|---:|---:|:---|:---|---:|---:|",
    ]

    for idx, s in enumerate(safari_low, 1):
        types_str = " / ".join(s["types"])
        lines.append(
            f"| {idx} | #{s['id']:03d} | **{s['name']}** | {types_str} | `{s['catchRate']}` | `{s['safariZoneFleeRate']}` |"
        )

    lines.extend([
        "",
        "### A.2. Resto de especies presentes en la Zona Safari (`catchRate >= 60`)",
        "",
        "| # | ID | Pokémon | Tipos | `catchRate` original | `safariZoneFleeRate` |",
        "|---:|---:|:---|:---|---:|---:|",
    ])
    for idx, s in enumerate(safari_other, 1):
        types_str = " / ".join(s["types"])
        lines.append(
            f"| {idx} | #{s['id']:03d} | {s['name']} | {types_str} | `{s['catchRate']}` | `{s['safariZoneFleeRate']}` |"
        )

    lines.extend([
        "",
        "### A.3. Especies fuera de la Zona Safari con `catchRate < 60`",
        "",
        "| # | ID | Pokémon | Tipos | `catchRate` original |",
        "|---:|---:|:---|:---|---:|",
    ])
    for idx, s in enumerate(non_safari_low, 1):
        types_str = " / ".join(s["types"])
        lines.append(
            f"| {idx} | #{s['id']:03d} | {s['name']} | {types_str} | `{s['catchRate']}` |"
        )

    counts = {
        "safari_low": len(safari_low),
        "safari_other": len(safari_other),
        "non_safari_low": len(non_safari_low),
        "total_a": len(safari_low) + len(safari_other) + len(non_safari_low),
    }
    return lines, counts


def collect_rare_rows(wild: dict[str, Any], region: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for zone in wild["zones"]:
        if zone["region"] != region:
            continue

        fr_entries: dict[tuple[str, str], dict[str, Any]] = {}
        lg_entries: dict[tuple[str, str], dict[str, Any]] = {}

        for ver_key, target in (("fireRed", fr_entries), ("leafGreen", lg_entries)):
            for method, method_obj in zone[ver_key].items():
                for enc in method_obj["encounters"]:
                    if 1 <= enc["rate"] <= 4:
                        target[(method, enc["speciesKey"])] = enc

        all_keys = sorted(
            set(fr_entries) | set(lg_entries),
            key=lambda k: (
                list(METHOD_LABELS.keys()).index(k[0]) if k[0] in METHOD_LABELS else 99,
                (fr_entries.get(k) or lg_entries.get(k))["speciesId"],
            ),
        )

        for method, sp_key in all_keys:
            efr = fr_entries.get((method, sp_key))
            elg = lg_entries.get((method, sp_key))

            if efr and elg and efr["rate"] == elg["rate"] and efr["minLevel"] == elg["minLevel"] and efr["maxLevel"] == elg["maxLevel"]:
                rows.append({
                    "zoneName": zone["name"],
                    "mapId": zone["mapId"],
                    "method": METHOD_LABELS.get(method, method),
                    "version": "FireRed / LeafGreen",
                    "speciesId": efr["speciesId"],
                    "speciesName": efr["speciesName"],
                    "isKanto": efr["isKanto"],
                    "levels": format_level_range(efr["minLevel"], efr["maxLevel"]),
                    "rate": efr["rate"],
                })
            else:
                if efr:
                    rows.append({
                        "zoneName": zone["name"],
                        "mapId": zone["mapId"],
                        "method": METHOD_LABELS.get(method, method),
                        "version": "FireRed",
                        "speciesId": efr["speciesId"],
                        "speciesName": efr["speciesName"],
                        "isKanto": efr["isKanto"],
                        "levels": format_level_range(efr["minLevel"], efr["maxLevel"]),
                        "rate": efr["rate"],
                    })
                if elg:
                    rows.append({
                        "zoneName": zone["name"],
                        "mapId": zone["mapId"],
                        "method": METHOD_LABELS.get(method, method),
                        "version": "LeafGreen",
                        "speciesId": elg["speciesId"],
                        "speciesName": elg["speciesName"],
                        "isKanto": elg["isKanto"],
                        "levels": format_level_range(elg["minLevel"], elg["maxLevel"]),
                        "rate": elg["rate"],
                    })
    return rows


def build_section_b(wild: dict[str, Any]) -> tuple[list[str], dict[str, int]]:
    kanto_rows = collect_rare_rows(wild, "kanto")
    sevii_rows = collect_rare_rows(wild, "sevii")

    lines: list[str] = [
        "## B. Pokémon salvajes con probabilidad de aparición del 1% al 4%",
        "",
        "La probabilidad indicada corresponde a la **suma agregada por especie** dentro de cada método de encuentro en la zona (en `pokefirered`, algunas especies ocupan múltiples *slots*; aquí solo se listan aquellas cuya probabilidad total real en la tabla es `1%–4%`).",
        "",
        f"- **Registros en Kanto:** {len(kanto_rows)}",
        f"- **Registros en Islas Sete (Sevii Islands):** {len(sevii_rows)}",
        "",
        "### B.1. Kanto (Rutas, Cuevas, Zona Safari y Ciudades)",
        "",
        "| # | Ubicación (`mapId`) | Método | Versión | Pokémon | Nivel | Prob. original |",
        "|---:|:---|:---|:---|:---|:---|---:|",
    ]

    for idx, r in enumerate(kanto_rows, 1):
        dex_tag = f"#{r['speciesId']:03d}" if r["isKanto"] else f"#{r['speciesId']:03d} (Johto)"
        lines.append(
            f"| {idx} | {r['zoneName']} (`{r['mapId']}`) | {r['method']} | {r['version']} | **{r['speciesName']}** ({dex_tag}) | {r['levels']} | **{r['rate']}%** |"
        )

    lines.extend([
        "",
        "### B.2. Islas Sete (Sevii Islands)",
        "",
        "| # | Ubicación (`mapId`) | Método | Versión | Pokémon | Nivel | Prob. original |",
        "|---:|:---|:---|:---|:---|:---|---:|",
    ])

    for idx, r in enumerate(sevii_rows, 1):
        dex_tag = f"#{r['speciesId']:03d}" if r["isKanto"] else f"#{r['speciesId']:03d} (Johto)"
        lines.append(
            f"| {idx} | {r['zoneName']} (`{r['mapId']}`) | {r['method']} | {r['version']} | **{r['speciesName']}** ({dex_tag}) | {r['levels']} | **{r['rate']}%** |"
        )

    return lines, {"kanto_rare": len(kanto_rows), "sevii_rare": len(sevii_rows)}


def build_section_c(evolutions: list[dict[str, Any]]) -> tuple[list[str], dict[str, int]]:
    direct_trade: list[dict[str, Any]] = []
    item_trade: list[dict[str, Any]] = []

    for chain in evolutions:
        for evo in chain["evolutions"]:
            entry = {
                "fromId": chain["speciesId"],
                "fromName": chain["speciesName"],
                "method": evo["method"],
                "item": evo["itemName"],
                "toId": evo["targetSpeciesId"],
                "toName": evo["targetSpeciesName"],
                "toInKanto": evo["targetInKanto"],
            }
            if evo["method"] == "EVO_TRADE":
                direct_trade.append(entry)
            elif evo["method"] == "EVO_TRADE_ITEM":
                item_trade.append(entry)

    lines: list[str] = [
        "## C. Pokémon que originalmente evolucionan por intercambio",
        "",
        "En `src/data/pokemon/evolution.h`, dentro de los 151 Pokémon de Kanto existen **dos variantes** de evolución por intercambio:",
        f"- **Intercambio directo (`EVO_TRADE`):** {len(direct_trade)} especies",
        f"- **Intercambio con objeto equipado (`EVO_TRADE_ITEM`):** {len(item_trade)} evoluciones (todas desembocan en especies de Johto introducidas en Gen 2)",
        "",
        "### C.1. Intercambio directo (`EVO_TRADE`)",
        "",
        "| # | Origen | Evoluciona a | Método original | Dex destino |",
        "|---:|:---|:---|:---|:---|",
    ]

    for idx, e in enumerate(direct_trade, 1):
        dex = "Kanto (#001–#151)" if e["toInKanto"] else "Johto (Dex Nacional)"
        lines.append(
            f"| {idx} | **#{e['fromId']:03d} {e['fromName']}** | **#{e['toId']:03d} {e['toName']}** | `EVO_TRADE` | {dex} |"
        )

    lines.extend([
        "",
        "### C.2. Intercambio con objeto equipado (`EVO_TRADE_ITEM`)",
        "",
        "| # | Origen | Evoluciona a | Método original | Objeto requerido originalmente | Dex destino |",
        "|---:|:---|:---|:---|:---|:---|",
    ])

    for idx, e in enumerate(item_trade, 1):
        dex = "Kanto (#001–#151)" if e["toInKanto"] else "Johto (Dex Nacional)"
        lines.append(
            f"| {idx} | **#{e['fromId']:03d} {e['fromName']}** | **#{e['toId']:03d} {e['toName']}** | `EVO_TRADE_ITEM` | {e['item']} | {dex} |"
        )

    lines.extend([
        "",
        "> **Nota de alcance:** En la base completa de Gen 3 (`evolution.h`) existe además una especie de Hoenn con intercambio (`#366 Clamperl` -> `Huntail` / `Gorebyss` con *DeepSeaTooth* / *DeepSeaScale*), fuera del conjunto de los 151 Pokémon de Kanto.",
    ])

    return lines, {"direct_trade": len(direct_trade), "item_trade": len(item_trade)}


def main() -> None:
    species = load_json("species.json")
    wild = load_json("wild_encounters.json")
    evolutions = load_json("evolutions.json")

    sec_a, counts_a = build_section_a(species)
    sec_b, counts_b = build_section_b(wild)
    sec_c, counts_c = build_section_c(evolutions)

    header = [
        "# Auditoría de Captura, Aparición Salvaje y Evoluciones (Fase 1)",
        "",
        "> **Estado de los datos:** Todos los valores reflejados en este reporte y en los `.json` de `juego-html/data/` corresponden **estrictamente a los datos originales** extraídos de `pret/pokefirered`, sin modificaciones aplicadas todavía.",
        "",
        "## Resumen ejecutivo",
        "",
        f"- **Especies con `catchRate < 60` o en Zona Safari:** {counts_a['total_a']} ({counts_a['safari_low']} en Zona Safari con `catchRate < 60`, {counts_a['safari_other']} en Zona Safari con `catchRate >= 60`, {counts_a['non_safari_low']} fuera de Zona Safari con `catchRate < 60`).",
        f"- **Encuentros salvajes raros (1%–4%):** {counts_b['kanto_rare']} registros en Kanto + {counts_b['sevii_rare']} registros en Islas Sete.",
        f"- **Evoluciones por intercambio (Kanto #001–#151):** {counts_c['direct_trade']} por intercambio directo (`EVO_TRADE`) + {counts_c['item_trade']} por intercambio con objeto (`EVO_TRADE_ITEM`).",
        "",
        "---",
        "",
    ]

    content = "\n".join(header + sec_a + ["", "---", ""] + sec_b + ["", "---", ""] + sec_c + [""])
    REPORT_PATH.write_text(content, encoding="utf-8")
    print(f"Wrote {REPORT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
