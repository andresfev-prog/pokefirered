#!/usr/bin/env python3
"""
Extracción de Recursos Overworld y Gráficos GBA -> Web (Fase 3)
Solo LEE desde las carpetas originales del repositorio (graphics/, data/, src/)
y ESCRIBE exclusivamente dentro de juego-html/.

Genera:
  1. juego-html/assets/sprites/characters/{ash,leaf,gary}.png + characters_manifest.json
  2. juego-html/assets/sprites/characters/npcs/*.png + npcs_manifest.json
  3. juego-html/assets/sprites/pokemon/{001..151}_{front,back}.png
  4. juego-html/assets/tilesets/<pair_key>.png + tilesets_manifest.json
  5. juego-html/data/maps/<MAP_ID>.json + maps_index.json
"""

from __future__ import annotations

import glob
import json
import os
import re
import struct
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_ROOT = REPO_ROOT / "juego-html"

CHAR_OUT_DIR = WEB_ROOT / "assets" / "sprites" / "characters"
NPC_OUT_DIR = CHAR_OUT_DIR / "npcs"
PKM_OUT_DIR = WEB_ROOT / "assets" / "sprites" / "pokemon"
TILESET_OUT_DIR = WEB_ROOT / "assets" / "tilesets"
MAPS_OUT_DIR = WEB_ROOT / "data" / "maps"

SPECIES_JSON_PATH = WEB_ROOT / "data" / "species.json"
WILD_ENCOUNTERS_PATH = WEB_ROOT / "data" / "wild_encounters.json"

NUM_TILES_IN_PRIMARY = 640
NUM_METATILES_IN_PRIMARY = 640
NUM_PALS_IN_PRIMARY = 7
NUM_PALS_TOTAL = 13

# Metatile behaviors (from include/constants/metatile_behaviors.h)
MB_TALL_GRASS = 0x02
MB_CAVE = 0x08
MB_INDOOR_ENCOUNTER = 0x0B
MB_POND_WATER = 0x10
MB_FAST_WATER = 0x11
MB_DEEP_WATER = 0x12
MB_WATERFALL = 0x13
MB_OCEAN_WATER = 0x15
MB_CYCLING_ROAD_WATER = 0x1B
MB_SEAWEED = 0x22
MB_SAND_CAVE = 0x2B
MB_CYCLING_ROAD_PULL_DOWN_GRASS = 0xD1

WATER_BEHAVIORS = {
    MB_POND_WATER,
    MB_FAST_WATER,
    MB_DEEP_WATER,
    MB_WATERFALL,
    MB_OCEAN_WATER,
    MB_CYCLING_ROAD_WATER,
}
ENCOUNTER_BEHAVIORS = {
    MB_TALL_GRASS,
    MB_CAVE,
    MB_INDOOR_ENCOUNTER,
    MB_SEAWEED,
    MB_SAND_CAVE,
    MB_CYCLING_ROAD_PULL_DOWN_GRASS,
}
LEDGE_DIRS = {
    0x38: "right",  # MB_JUMP_EAST
    0x39: "left",   # MB_JUMP_WEST
    0x3A: "up",     # MB_JUMP_NORTH
    0x3B: "down",   # MB_JUMP_SOUTH
}
IMPASSABLE_EDGE_BEHAVIORS = {0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37}
ARROW_WARP_DIRS = {
    0x62: "right",  # MB_EAST_ARROW_WARP
    0x63: "left",   # MB_WEST_ARROW_WARP
    0x64: "up",     # MB_NORTH_ARROW_WARP
    0x65: "down",   # MB_SOUTH_ARROW_WARP
}
DOOR_WARP_BEHAVIORS = {0x69}  # MB_WARP_DOOR

SEVII_AND_EXCLUDED_TOKENS = (
    "Sevii",
    "OneIsland",
    "TwoIsland",
    "ThreeIsland",
    "FourIsland",
    "FiveIsland",
    "SixIsland",
    "SevenIsland",
    "Tanoby",
    "MtEmber",
    "BerryForest",
    "LostCave",
    "DottedHole",
    "PatternBush",
    "IcefallCave",
    "AlteringCave",
    "NavelRock",
    "BirthIsland",
    "TrainerTower",
)
EXCLUDED_EXACT_MAPS = {
    "BattleColosseum_2P",
    "BattleColosseum_4P",
    "RecordCorner",
    "TradeCenter",
    "UnionRoom",
}

FACING_FROM_MOVEMENT = {
    "MOVEMENT_TYPE_FACE_DOWN": "down",
    "MOVEMENT_TYPE_LOOK_AROUND": "down",
    "MOVEMENT_TYPE_WANDER_AROUND": "down",
    "MOVEMENT_TYPE_WANDER_UP_AND_DOWN": "down",
    "MOVEMENT_TYPE_WANDER_DOWN_AND_UP": "down",
    "MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT": "left",
    "MOVEMENT_TYPE_FACE_UP": "up",
    "MOVEMENT_TYPE_FACE_LEFT": "left",
    "MOVEMENT_TYPE_FACE_RIGHT": "right",
    "MOVEMENT_TYPE_NONE": "down",
}


def ensure_dirs() -> None:
    for d in (CHAR_OUT_DIR, NPC_OUT_DIR, PKM_OUT_DIR, TILESET_OUT_DIR, MAPS_OUT_DIR):
        d.mkdir(parents=True, exist_ok=True)


def parse_jasc_pal(pal_path: Path) -> List[Tuple[int, int, int]]:
    lines = pal_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    colors: List[Tuple[int, int, int]] = []
    for line in lines[3:]:
        parts = line.strip().split()
        if len(parts) >= 3:
            colors.append((int(parts[0]), int(parts[1]), int(parts[2])))
        if len(colors) == 16:
            break
    while len(colors) < 16:
        colors.append((0, 0, 0))
    return colors


def indexed_to_rgba(
    arr: np.ndarray, palette: List[Tuple[int, int, int]], transparent_index: int = 0
) -> Image.Image:
    h, w = arr.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    lut = np.zeros((256, 4), dtype=np.uint8)
    for i, rgb in enumerate(palette):
        if i == transparent_index:
            lut[i] = (0, 0, 0, 0)
        else:
            lut[i] = (rgb[0], rgb[1], rgb[2], 255)
    rgba = lut[arr]
    return Image.fromarray(rgba, mode="RGBA")


def image_palette_list(im: Image.Image) -> List[Tuple[int, int, int]]:
    raw = im.getpalette() or []
    cols: List[Tuple[int, int, int]] = []
    for i in range(0, min(len(raw), 48), 3):
        cols.append((raw[i], raw[i + 1], raw[i + 2]))
    while len(cols) < 16:
        cols.append((0, 0, 0))
    return cols


# ---------------------------------------------------------------------------
# 1. Protagonist Sprite Sheets (Ash / Leaf / Gary) -> 384x96 (12x3 of 32x32)
# ---------------------------------------------------------------------------
def slice_frames(img_path: Path, frame_w: int, frame_h: int) -> Tuple[List[np.ndarray], List[Tuple[int, int, int]]]:
    im = Image.open(img_path)
    pal = image_palette_list(im)
    arr = np.array(im, dtype=np.uint8)
    count = im.size[0] // frame_w
    frames = [arr[:, i * frame_w : (i + 1) * frame_w].copy() for i in range(count)]
    return frames, pal


def assemble_protagonist_grid(
    walk_frames: List[np.ndarray],
    run_frames: List[np.ndarray],
    bike_frames: List[np.ndarray],
) -> Dict[str, List[np.ndarray]]:
    # Verified against src/data/object_events/object_event_pic_tables.h & object_event_anims.h:
    # walk (16x32): down=[0,3,4], up=[1,5,6], left=[2,7,8], right=flip([2,7,8])
    # run  (16x32): down=[3,4,5], up=[6,7,8], left=[9,10,11], right=flip([9,10,11])
    # bike (32x32): down=[0,3,4], up=[1,5,6], left=[2,7,8], right=flip([2,7,8])
    return {
        "walk": [
            walk_frames[0], walk_frames[3], walk_frames[4],
            walk_frames[1], walk_frames[5], walk_frames[6],
            walk_frames[2], walk_frames[7], walk_frames[8],
            np.fliplr(walk_frames[2]), np.fliplr(walk_frames[7]), np.fliplr(walk_frames[8]),
        ],
        "run": [
            run_frames[3], run_frames[4], run_frames[5],
            run_frames[6], run_frames[7], run_frames[8],
            run_frames[9], run_frames[10], run_frames[11],
            np.fliplr(run_frames[9]), np.fliplr(run_frames[10]), np.fliplr(run_frames[11]),
        ],
        "bike": [
            bike_frames[0], bike_frames[3], bike_frames[4],
            bike_frames[1], bike_frames[5], bike_frames[6],
            bike_frames[2], bike_frames[7], bike_frames[8],
            np.fliplr(bike_frames[2]), np.fliplr(bike_frames[7]), np.fliplr(bike_frames[8]),
        ],
    }


def build_standard_sheet(
    grid: Dict[str, List[np.ndarray]], palette: List[Tuple[int, int, int]]
) -> Image.Image:
    sheet = Image.new("RGBA", (384, 96), (0, 0, 0, 0))
    row_order = ("walk", "run", "bike")
    for r_idx, mode_name in enumerate(row_order):
        for c_idx, frame in enumerate(grid[mode_name]):
            rgba = indexed_to_rgba(frame, palette, 0)
            fh, fw = frame.shape
            x_off = c_idx * 32 + (32 - fw) // 2
            y_off = r_idx * 32 + (32 - fh)
            sheet.paste(rgba, (x_off, y_off))
    return sheet


def _build_gary_frame_rgba(
    frame: np.ndarray, col_idx: int, red_pal: List[Tuple[int, int, int]]
) -> Image.Image:
    """
    Clona un fotograma indexado de Red y lo transforma visualmente en Gary Oak:
    - Cabello castaño puntiagudo (sin gorra ni visera ni emblema blanco).
    - Chaqueta/playera púrpura real (#8C52D4 / #6432A8 / #3B1872) + pantalones carbón azulados.
    - Bicicleta y mochila con acentos verde-azulado/plata distintos de Red.
    """
    h, w = frame.shape
    dir_idx = col_idx // 3  # 0=down, 1=up, 2=left, 3=right
    arr = frame.copy()

    # Palette index lookup table for body vs head
    # Indices in player.pal:
    # 0=transp, 1=dark brown, 2..4=skin, 5..7=blue clothes,
    # 8,11,12=red cap/jacket, 9,10=white/silver trim, 13,14=gold backpack, 15=black
    hair_colors = {
        1: (118, 66, 28, 255),    # hair shadow
        6: (102, 54, 22, 255),    # hair under-fringe
        8: (74, 38, 16, 255),     # chestnut dark outline
        9: (196, 132, 54, 255),   # spiky highlight
        10: (162, 98, 34, 255),   # chestnut mid-light
        11: (196, 132, 54, 255),  # chestnut highlight
        12: (152, 88, 28, 255),   # chestnut midtone
    }
    body_colors = {
        1: (74, 38, 16, 255),     # dark brown belt/sideburn
        2: (*red_pal[2], 255),
        3: (*red_pal[3], 255),
        4: (*red_pal[4], 255),
        5: (76, 86, 118, 255),    # slate-navy jeans/bike light
        6: (52, 60, 88, 255),     # slate-navy mid
        7: (118, 134, 168, 255),  # cool gray highlight
        8: (56, 24, 108, 255),    # deep plum outline
        9: (232, 228, 248, 255),  # crisp lavender-white collar
        10: (180, 174, 210, 255), # shaded collar
        11: (144, 82, 214, 255),  # Gary's purple jacket highlight
        12: (104, 48, 168, 255),  # Gary's purple jacket mid
        13: (72, 194, 168, 255),  # teal trim / pack
        14: (42, 132, 114, 255),  # dark teal shadow
        15: (0, 0, 0, 255),
    }

    ys = np.where(arr > 0)[0]
    if len(ys) == 0:
        return Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y_top = int(ys.min())

    # Locate face/eye band accurately using skin pixels inside upper half
    y_eye = y_top + 9
    for y_scan in range(y_top + 6, min(h, y_top + 13)):
        row_vals = set(int(v) for v in arr[y_scan])
        if (2 in row_vals or 3 in row_vals) and 15 in row_vals:
            y_eye = y_scan
            break

    # Reshape cap dome & protruding visor into spiky chestnut hair silhouette
    # Trim Red's baseball cap brim protrusion on Left / Right views
    if dir_idx == 2:  # left
        for y in range(max(0, y_top), min(h, y_eye)):
            for x in range(0, min(w, 4 if w == 16 else 12)):
                # Only clear isolated horizontal cap visor tip on left edge
                if w == 16 and x < 3 and arr[y, x] in (8, 9, 10, 15):
                    arr[y, x] = 0
                elif w == 32 and x < 11 and arr[y, x] in (8, 9, 10, 15):
                    arr[y, x] = 0
    elif dir_idx == 3:  # right
        for y in range(max(0, y_top), min(h, y_eye)):
            start_x = 13 if w == 16 else 21
            for x in range(start_x, w):
                if arr[y, x] in (8, 9, 10, 15):
                    arr[y, x] = 0

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            v = int(arr[y, x])
            if v == 0:
                continue
            # Head / hair region down to eye line; below eye line use body outfit palette
            is_head_cap = (y < y_eye - 1) or (y <= y_eye + 1 and v in (8, 9, 10, 11, 12))
            if is_head_cap and v in hair_colors:
                rgba[y, x] = hair_colors[v]
            elif v in body_colors:
                rgba[y, x] = body_colors[v]

    # Add signature Gary spiky hair tufts on crown (`y_top - 1 .. y_top + 2`)
    cx = w // 2
    spike_outline = (74, 38, 16, 255)
    spike_dark = (152, 88, 28, 255)
    spike_light = (196, 132, 54, 255)

    # Clear rounded flat dome center pixels on top row and sculpt 3 spiky peaks
    if y_top >= 2:
        # Carve notches at x = cx-2 and x = cx+1 along y_top for jagged silhouette
        for nx in (cx - 2, cx + 1):
            if 0 <= nx < w:
                rgba[y_top, nx] = (0, 0, 0, 0)
                if y_top + 1 < h and (rgba[y_top + 1, nx, 3] > 0):
                    rgba[y_top + 1, nx] = spike_outline
        # Draw spiky tips poking upward
        if dir_idx == 0:  # front/down spiky peaks
            peaks = [(cx - 4, -1), (cx - 1, -1), (cx, -2), (cx + 3, -1), (cx + 4, 0)]
        elif dir_idx == 1:  # back/up full spiky crown
            peaks = [(cx - 4, -1), (cx - 1, -2), (cx + 1, -1), (cx + 3, -1)]
        elif dir_idx == 2:  # facing left spikes sweeping back-right
            peaks = [(cx - 2, -1), (cx + 1, -2), (cx + 2, -1), (cx + 4, -1)]
        else:  # facing right spikes sweeping back-left
            peaks = [(cx + 1, -1), (cx - 2, -2), (cx - 3, -1), (cx - 5, -1)]

        for px, dy in peaks:
            py = y_top + dy
            if 0 <= px < w and 0 <= py < h:
                rgba[py, px] = spike_outline
                if py + 1 < h and rgba[py + 1, px, 3] == 0:
                    rgba[py + 1, px] = spike_dark
                elif py + 1 < h:
                    rgba[py + 1, px] = spike_light

    return Image.fromarray(rgba, mode="RGBA")


def build_gary_sheet(
    grid: Dict[str, List[np.ndarray]], red_pal: List[Tuple[int, int, int]]
) -> Image.Image:
    sheet = Image.new("RGBA", (384, 96), (0, 0, 0, 0))
    row_order = ("walk", "run", "bike")
    for r_idx, mode_name in enumerate(row_order):
        for c_idx, frame in enumerate(grid[mode_name]):
            rgba = _build_gary_frame_rgba(frame, c_idx, red_pal)
            fh, fw = frame.shape
            x_off = c_idx * 32 + (32 - fw) // 2
            y_off = r_idx * 32 + (32 - fh)
            sheet.paste(rgba, (x_off, y_off))
    return sheet


def extract_protagonists() -> Dict[str, dict]:
    people_dir = REPO_ROOT / "graphics" / "object_events" / "pics" / "people"

    red_walk, red_pal = slice_frames(people_dir / "red_normal.png", 16, 32)
    red_run, _ = slice_frames(people_dir / "red_surf_run.png", 16, 32)
    red_bike, _ = slice_frames(people_dir / "red_bike.png", 32, 32)
    red_grid = assemble_protagonist_grid(red_walk, red_run, red_bike)

    green_walk, green_pal = slice_frames(people_dir / "green_normal.png", 16, 32)
    green_run, _ = slice_frames(people_dir / "green_surf_run.png", 16, 32)
    green_bike, _ = slice_frames(people_dir / "green_bike.png", 32, 32)
    green_grid = assemble_protagonist_grid(green_walk, green_run, green_bike)

    ash_img = build_standard_sheet(red_grid, red_pal)
    leaf_img = build_standard_sheet(green_grid, green_pal)
    gary_img = build_gary_sheet(red_grid, red_pal)

    ash_img.save(CHAR_OUT_DIR / "ash.png")
    leaf_img.save(CHAR_OUT_DIR / "leaf.png")
    gary_img.save(CHAR_OUT_DIR / "gary.png")

    manifest = {
        "cellWidth": 32,
        "cellHeight": 32,
        "footAnchor": {"x": 16, "y": 31},
        "rows": {"walk": 0, "run": 1, "bike": 2},
        "directions": {
            "down": {"cols": [0, 1, 2]},
            "up": {"cols": [3, 4, 5]},
            "left": {"cols": [6, 7, 8]},
            "right": {"cols": [9, 10, 11]},
        },
        "characters": {
            "ash": {"name": "Ash (Red)", "file": "assets/sprites/characters/ash.png", "width": 384, "height": 96},
            "gary": {"name": "Gary (Blue)", "file": "assets/sprites/characters/gary.png", "width": 384, "height": 96},
            "leaf": {"name": "Leaf (Green)", "file": "assets/sprites/characters/leaf.png", "width": 384, "height": 96},
        },
    }
    (CHAR_OUT_DIR / "characters_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    return manifest


# ---------------------------------------------------------------------------
# 2. NPC & Object Event Sprites
# ---------------------------------------------------------------------------
def extract_npcs() -> Dict[str, dict]:
    obj_dir = REPO_ROOT / "src" / "data" / "object_events"
    ptr_txt = (obj_dir / "object_event_graphics_info_pointers.h").read_text(encoding="utf-8")
    info_txt = (obj_dir / "object_event_graphics_info.h").read_text(encoding="utf-8")
    pic_tbl_txt = (obj_dir / "object_event_pic_tables.h").read_text(encoding="utf-8")
    gfx_txt = (obj_dir / "object_event_graphics.h").read_text(encoding="utf-8")

    # Map gObjectEventPic_* -> path
    pic_paths: Dict[str, Path] = {}
    for m in re.finditer(r'(gObjectEventPic_\w+)\[\]\s*=\s*INCBIN_U\d+\("([^"]+)\.4bpp"\)', gfx_txt):
        png_path = REPO_ROOT / f"{m.group(2)}.png"
        if png_path.exists():
            pic_paths[m.group(1)] = png_path

    # Map sPicTable_* -> first gObjectEventPic_*
    pic_table_first: Dict[str, str] = {}
    for m in re.finditer(r"static const struct SpriteFrameImage (sPicTable_\w+)\[\]\s*=\s*\{(.*?)\};", pic_tbl_txt, re.S):
        first = re.search(r"overworld_frame\((gObjectEventPic_\w+),", m.group(2))
        if first:
            pic_table_first[m.group(1)] = first.group(1)

    # Map gObjectEventGraphicsInfo_* -> {width, height, images}
    info_structs: Dict[str, dict] = {}
    for m in re.finditer(r"const struct ObjectEventGraphicsInfo (gObjectEventGraphicsInfo_\w+)\s*=\s*\{(.*?)\};", info_txt, re.S):
        body = m.group(2)
        wm = re.search(r"\.width\s*=\s*(\d+)", body)
        hm = re.search(r"\.height\s*=\s*(\d+)", body)
        im_m = re.search(r"\.images\s*=\s*(\w+)", body)
        if wm and hm and im_m:
            info_structs[m.group(1)] = {
                "width": int(wm.group(1)),
                "height": int(hm.group(1)),
                "picTable": im_m.group(1),
            }

    # Map OBJ_EVENT_GFX_* -> gObjectEventGraphicsInfo_*
    gfx_entries: Dict[str, str] = {}
    for m in re.finditer(r"\[(OBJ_EVENT_GFX_\w+)\]\s*=\s*&(gObjectEventGraphicsInfo_\w+)", ptr_txt):
        gfx_entries[m.group(1)] = m.group(2)

    manifest: Dict[str, dict] = {}
    saved_cache: Dict[str, Tuple[int, int, int]] = {}

    for gfx_const, info_name in gfx_entries.items():
        info = info_structs.get(info_name)
        if not info:
            continue
        pic_sym = pic_table_first.get(info["picTable"])
        src_png = pic_paths.get(pic_sym or "")
        if not src_png or not src_png.exists():
            continue

        slug = gfx_const.replace("OBJ_EVENT_GFX_", "").lower()
        out_name = f"{slug}.png"
        out_path = NPC_OUT_DIR / out_name

        im = Image.open(src_png)
        if out_name not in saved_cache:
            if im.mode == "P":
                pal = image_palette_list(im)
                arr = np.array(im, dtype=np.uint8)
                rgba = indexed_to_rgba(arr, pal, 0)
            else:
                rgba = im.convert("RGBA")
            rgba.save(out_path)
            fw = info["width"]
            fh = info["height"]
            saved_cache[out_name] = (rgba.size[0], rgba.size[1], max(1, rgba.size[0] // max(1, fw)))

        sw, sh, frame_count = saved_cache[out_name]
        fw = info["width"]
        fh = info["height"]
        # Standard FireRed 9-frame layout: 0=down, 1=up, 2=left (+ flip for right)
        # 3-frame static NPC (gym leaders): 0=down, 1=up, 2=left
        # 4-frame Nurse: 0=down, 1=up, 2=left (with bow frame)
        manifest[gfx_const] = {
            "file": f"assets/sprites/characters/npcs/{out_name}",
            "frameWidth": fw,
            "frameHeight": fh,
            "sheetWidth": sw,
            "sheetHeight": sh,
            "frameCount": frame_count,
            "hasFourDirs": frame_count >= 3,
        }

    # Explicit friendly NPC aliases requested for Phase 3/4 storytelling
    friendly_aliases = {
        "prof_oak.png": "prof_oak.png",
        "nurse_joy.png": "nurse.png",
        "officer_jenny.png": "policeman.png",
        "brock.png": "brock.png",
        "misty.png": "misty.png",
        "lt_surge.png": "lt_surge.png",
        "erika.png": "erika.png",
        "koga.png": "koga.png",
        "sabrina.png": "sabrina.png",
        "blaine.png": "blaine.png",
        "giovanni.png": "giovanni.png",
        "rocket_m.png": "rocket_m.png",
        "rocket_f.png": "rocket_f.png",
        "gary_npc.png": "blue.png",
    }
    for alias_name, target_name in friendly_aliases.items():
        src_target = NPC_OUT_DIR / target_name
        dst_alias = NPC_OUT_DIR / alias_name
        if src_target.exists() and not dst_alias.exists():
            dst_alias.write_bytes(src_target.read_bytes())

    (NPC_OUT_DIR / "npcs_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    return manifest


# ---------------------------------------------------------------------------
# 3. 151 Kanto Pokémon Sprites (front.png & back.png -> 001_front.png .. 151_back.png)
# ---------------------------------------------------------------------------
def extract_pokemon_sprites() -> int:
    species_list = json.loads(SPECIES_JSON_PATH.read_text(encoding="utf-8"))
    count = 0
    for sp in species_list:
        dex = f"{sp['id']:03d}"
        folder = REPO_ROOT / "graphics" / "pokemon" / sp["key"].lower()
        pal = parse_jasc_pal(folder / "normal.pal")

        for side in ("front", "back"):
            src = folder / f"{side}.png"
            dst = PKM_OUT_DIR / f"{dex}_{side}.png"
            im = Image.open(src)
            if im.mode in ("P", "L"):
                arr = np.array(im, dtype=np.uint8)
                out_im = indexed_to_rgba(arr, pal, 0)
            else:
                out_im = im.convert("RGBA")
            out_im.save(dst)
            count += 1
    return count


# ---------------------------------------------------------------------------
# 4. Tilesets & Mainland Kanto Maps
# ---------------------------------------------------------------------------
def load_tileset_definitions() -> Dict[str, dict]:
    headers_txt = (REPO_ROOT / "src" / "data" / "tilesets" / "headers.h").read_text(encoding="utf-8")
    gfx_txt = (
        (REPO_ROOT / "src" / "data" / "tilesets" / "graphics.h").read_text(encoding="utf-8")
        + "\n"
        + (REPO_ROOT / "src" / "graphics.c").read_text(encoding="utf-8")
    )
    metatiles_txt = (REPO_ROOT / "src" / "data" / "tilesets" / "metatiles.h").read_text(encoding="utf-8")

    tile_folders: Dict[str, str] = {}
    for m in re.finditer(r'(gTilesetTiles_\w+)\[\]\s*=\s*INCBIN_U\d+\("([^"]+)/tiles\.4bpp', gfx_txt):
        tile_folders[m.group(1)] = m.group(2)

    pal_folders: Dict[str, str] = {}
    for m in re.finditer(r'(gTilesetPalettes_\w+)\[\]\[16\]\s*=\s*\{\s*INCBIN_U\d+\("([^"]+)/palettes/', gfx_txt):
        pal_folders[m.group(1)] = m.group(2)

    meta_folders: Dict[str, str] = {}
    for m in re.finditer(r'(gMetatiles_\w+)\[\]\s*=\s*INCBIN_U\d+\("([^"]+)/metatiles\.bin', metatiles_txt):
        meta_folders[m.group(1)] = m.group(2)

    attr_folders: Dict[str, str] = {}
    for m in re.finditer(r'(gMetatileAttributes_\w+)\[\]\s*=\s*INCBIN_U\d+\("([^"]+)/metatile_attributes\.bin', metatiles_txt):
        attr_folders[m.group(1)] = m.group(2)

    tilesets: Dict[str, dict] = {}
    for m in re.finditer(r"const struct Tileset (gTileset_\w+)\s*=\s*\{(.*?)\};", headers_txt, re.S):
        name, body = m.group(1), m.group(2)

        def get_field(f: str) -> Optional[str]:
            fm = re.search(rf"\.{f}\s*=\s*(\w+)", body)
            return fm.group(1) if fm else None

        tiles_sym = get_field("tiles")
        pals_sym = get_field("palettes")
        meta_sym = get_field("metatiles")
        attr_sym = get_field("metatileAttributes")
        tilesets[name] = {
            "name": name,
            "isSecondary": get_field("isSecondary") == "TRUE",
            "tilesDir": tile_folders.get(tiles_sym or ""),
            "palettesDir": pal_folders.get(pals_sym or ""),
            "metatilesDir": meta_folders.get(meta_sym or ""),
            "attrsDir": attr_folders.get(attr_sym or ""),
        }
    return tilesets


def load_tile_sheet(tiles_dir: str) -> np.ndarray:
    im = Image.open(REPO_ROOT / tiles_dir / "tiles.png")
    arr = np.array(im, dtype=np.uint8)
    # 128px wide (16 tiles per row) -> reshape to (num_tiles, 8, 8)
    h, w = arr.shape
    cols = w // 8
    rows = h // 8
    tiles = arr.reshape(rows, 8, cols, 8).transpose(0, 2, 1, 3).reshape(rows * cols, 8, 8)
    return tiles


def load_palettes(primary_dir: str, secondary_dir: str) -> np.ndarray:
    lut = np.zeros((16, 16, 4), dtype=np.uint8)
    for idx in range(NUM_PALS_TOTAL):
        base_dir = REPO_ROOT / (primary_dir if idx < NUM_PALS_IN_PRIMARY else secondary_dir)
        pal_file = base_dir / "palettes" / f"{idx:02d}.pal"
        if not pal_file.exists():
            continue
        cols = parse_jasc_pal(pal_file)
        for ci, (r, g, b) in enumerate(cols):
            if ci == 0:
                lut[idx, ci] = (0, 0, 0, 0)
            else:
                lut[idx, ci] = (r, g, b, 255)
    return lut


def bake_tileset_pair(
    pair_key: str, primary_ts: dict, secondary_ts: dict
) -> Tuple[dict, List[int]]:
    """
    Combines primary + secondary tilesets into a 512px-wide two-layer metatile atlas PNG.
      Top half    = belowLayer (rendered below player/NPCs)
      Bottom half = aboveLayer (rendered above player/NPCs: roofs, tree crowns)
    Returns (manifest_entry, combined_attributes_u32_list).
    """
    p_tiles = load_tile_sheet(primary_ts["tilesDir"])
    s_tiles = load_tile_sheet(secondary_ts["tilesDir"])
    pals_lut = load_palettes(primary_ts["palettesDir"], secondary_ts["palettesDir"])

    p_meta_bytes = (REPO_ROOT / primary_ts["metatilesDir"] / "metatiles.bin").read_bytes()
    s_meta_bytes = (REPO_ROOT / secondary_ts["metatilesDir"] / "metatiles.bin").read_bytes()
    p_attr_bytes = (REPO_ROOT / primary_ts["attrsDir"] / "metatile_attributes.bin").read_bytes()
    s_attr_bytes = (REPO_ROOT / secondary_ts["attrsDir"] / "metatile_attributes.bin").read_bytes()

    p_count = min(NUM_METATILES_IN_PRIMARY, len(p_meta_bytes) // 16)
    s_count = len(s_meta_bytes) // 16

    p_attrs = list(struct.unpack(f"<{len(p_attr_bytes)//4}I", p_attr_bytes))[:p_count]
    s_attrs = list(struct.unpack(f"<{len(s_attr_bytes)//4}I", s_attr_bytes))[:s_count]

    p_metas = [struct.unpack_from("<8H", p_meta_bytes, i * 16) for i in range(p_count)]
    s_metas = [struct.unpack_from("<8H", s_meta_bytes, i * 16) for i in range(s_count)]

    total_metas = NUM_METATILES_IN_PRIMARY + s_count
    cols = 32
    rows = (total_metas + cols - 1) // cols
    layer_h = rows * 16
    atlas_w = cols * 16
    atlas_h = layer_h * 2

    below_buf = np.zeros((layer_h, atlas_w, 4), dtype=np.uint8)
    above_buf = np.zeros((layer_h, atlas_w, 4), dtype=np.uint8)

    # Combined attributes array of length total_metas (pad gap between p_count..639 if needed)
    combined_attrs: List[int] = [0] * total_metas
    for i, a in enumerate(p_attrs):
        combined_attrs[i] = a
    for i, a in enumerate(s_attrs):
        combined_attrs[NUM_METATILES_IN_PRIMARY + i] = a

    def decode_8x8(entry: int) -> np.ndarray:
        tid = entry & 0x3FF
        xflip = (entry >> 10) & 1
        yflip = (entry >> 11) & 1
        pal_idx = (entry >> 12) & 0xF

        if tid < NUM_TILES_IN_PRIMARY:
            t = p_tiles[tid] if tid < len(p_tiles) else p_tiles[0]
        else:
            st = tid - NUM_TILES_IN_PRIMARY
            t = s_tiles[st] if st < len(s_tiles) else p_tiles[0]

        if xflip:
            t = t[:, ::-1]
        if yflip:
            t = t[::-1, :]
        return pals_lut[pal_idx][t]

    def blit_quad(entries4: Tuple[int, ...], dest: np.ndarray, mx: int, my: int, alpha_over: bool) -> None:
        offsets = ((0, 0), (8, 0), (0, 8), (8, 8))
        for sub, (ox, oy) in zip(entries4, offsets):
            tile_rgba = decode_8x8(sub)
            yy = my + oy
            xx = mx + ox
            if not alpha_over:
                dest[yy : yy + 8, xx : xx + 8] = tile_rgba
            else:
                mask = tile_rgba[:, :, 3] > 0
                dest[yy : yy + 8, xx : xx + 8][mask] = tile_rgba[mask]

    all_entries: List[Optional[Tuple[int, ...]]] = [None] * total_metas
    for i, m in enumerate(p_metas):
        all_entries[i] = m
    for i, m in enumerate(s_metas):
        all_entries[NUM_METATILES_IN_PRIMARY + i] = m

    for idx, entries in enumerate(all_entries):
        if entries is None:
            continue
        mx = (idx % cols) * 16
        my = (idx // cols) * 16
        attr = combined_attrs[idx]
        layer_type = (attr >> 29) & 0x3  # 0=NORMAL, 1=COVERED, 2=SPLIT
        bottom4 = entries[0:4]
        top4 = entries[4:8]

        # Match GBA src/field_camera.c layer composition
        blit_quad(bottom4, below_buf, mx, my, alpha_over=False)
        if layer_type == 1:  # COVERED: top4 sits in BG1 (still below player)
            blit_quad(top4, below_buf, mx, my, alpha_over=True)
        else:  # NORMAL (0) or SPLIT (2): top4 sits in BG2 (above player)
            blit_quad(top4, above_buf, mx, my, alpha_over=False)

    full_buf = np.vstack([below_buf, above_buf])
    Image.fromarray(full_buf, mode="RGBA").save(TILESET_OUT_DIR / f"{pair_key}.png")

    entry = {
        "file": f"assets/tilesets/{pair_key}.png",
        "primary": primary_ts["name"],
        "secondary": secondary_ts["name"],
        "cols": cols,
        "rows": rows,
        "layerHeight": layer_h,
        "atlasWidth": atlas_w,
        "atlasHeight": atlas_h,
        "numMetatiles": total_metas,
    }
    return entry, combined_attrs


def format_display_name(map_name: str, wild_name: Optional[str] = None) -> str:
    if wild_name:
        return wild_name
    clean = map_name.replace("_", " — ")
    clean = re.sub(r"([a-z])([A-Z])", r"\1 \2", clean)
    clean = re.sub(r"([A-Za-z])(\d)", r"\1 \2", clean)
    return clean.replace("1 F", "PB").replace("2 F", "P2").replace("3 F", "P3")


def resolve_environment(map_id: str, map_type: str, wild_envs: Dict[str, str]) -> str:
    if map_id in wild_envs:
        return wild_envs[map_id]
    if map_type == "MAP_TYPE_UNDERGROUND":
        return "cave"
    if map_type in ("MAP_TYPE_INDOOR", "MAP_TYPE_SECRET_BASE"):
        return "indoor"
    return "outdoor"


def build_collision_and_behaviors(
    words: Tuple[int, ...],
    attrs: List[int],
    width: int,
    warps: List[dict],
) -> Tuple[List[int], List[int], List[int], Dict[str, str]]:
    """
    Returns (metatiles, collisions, behaviors, ledgeDirs)
    Collision semantics:
      0: walkable
      1: blocked
      2: wild encounter grass / cave floor
      3: water / Surf
      4: unidirectional ledge hop
    """
    warp_coords = {(wp["x"], wp["y"]) for wp in warps}
    metatiles: List[int] = []
    collisions: List[int] = []
    behaviors: List[int] = []
    ledge_dirs: Dict[str, str] = {}

    for idx, w in enumerate(words):
        mt_id = w & 0x3FF
        raw_col = (w >> 10) & 0x3
        attr = attrs[mt_id] if mt_id < len(attrs) else 0
        beh = attr & 0x1FF

        metatiles.append(mt_id)
        behaviors.append(beh)

        x = idx % width
        y = idx // width

        if beh in LEDGE_DIRS:
            collisions.append(4)
            ledge_dirs[str(idx)] = LEDGE_DIRS[beh]
        elif beh in WATER_BEHAVIORS:
            collisions.append(3)
        elif beh in IMPASSABLE_EDGE_BEHAVIORS:
            collisions.append(1)
        elif (x, y) in warp_coords:
            # Keep exact passability from raw_col on warps (0=step mat, 1=push door)
            collisions.append(0 if raw_col == 0 else 1)
        elif raw_col != 0:
            collisions.append(1)
        elif beh in ENCOUNTER_BEHAVIORS:
            collisions.append(2)
        else:
            collisions.append(0)

    return metatiles, collisions, behaviors, ledge_dirs


def extract_maps_and_tilesets(npc_manifest: dict) -> Tuple[dict, dict, List[str]]:
    tileset_defs = load_tileset_definitions()
    layouts_json = json.loads((REPO_ROOT / "data" / "layouts" / "layouts.json").read_text(encoding="utf-8"))
    layouts_by_id = {
        l["id"]: l
        for l in layouts_json["layouts"]
        if isinstance(l, dict) and "id" in l
    }

    wild_data = json.loads(WILD_ENCOUNTERS_PATH.read_text(encoding="utf-8"))
    wild_envs: Dict[str, str] = {}
    wild_names: Dict[str, str] = {}
    for z in wild_data["zones"]:
        if z.get("region") == "kanto":
            wild_envs[z["mapId"]] = z["environment"]
            wild_names[z["mapId"]] = z["name"]

    tilesets_manifest: Dict[str, dict] = {}
    tileset_attrs_cache: Dict[str, List[int]] = {}
    maps_index: List[dict] = []
    exported_ids: set = set()

    raw_maps: List[dict] = []
    for map_file in sorted(glob.glob(str(REPO_ROOT / "data" / "maps" / "*" / "map.json"))):
        d = json.loads(Path(map_file).read_text(encoding="utf-8"))
        name = d["name"]
        if any(tok in name for tok in SEVII_AND_EXCLUDED_TOKENS) or name in EXCLUDED_EXACT_MAPS:
            continue
        raw_maps.append(d)
        exported_ids.add(d["id"])

    # Bake every unique (primary, secondary) pair once
    for d in raw_maps:
        lay = layouts_by_id[d["layout"]]
        p_name = lay["primary_tileset"]
        s_name = lay["secondary_tileset"]
        pair_key = f"{p_name.replace('gTileset_', '').lower()}__{s_name.replace('gTileset_', '').lower()}"

        if pair_key not in tilesets_manifest:
            entry, combined_attrs = bake_tileset_pair(
                pair_key, tileset_defs[p_name], tileset_defs[s_name]
            )
            tilesets_manifest[pair_key] = entry
            tileset_attrs_cache[pair_key] = combined_attrs

    # Export each Kanto map JSON
    for d in raw_maps:
        mid = d["id"]
        name = d["name"]
        lay = layouts_by_id[d["layout"]]
        p_name = lay["primary_tileset"]
        s_name = lay["secondary_tileset"]
        pair_key = f"{p_name.replace('gTileset_', '').lower()}__{s_name.replace('gTileset_', '').lower()}"
        attrs = tileset_attrs_cache[pair_key]

        width = lay["width"]
        height = lay["height"]
        raw_block = (REPO_ROOT / lay["blockdata_filepath"]).read_bytes()
        words = struct.unpack(f"<{len(raw_block)//2}H", raw_block)

        raw_border_path = REPO_ROOT / lay["border_filepath"]
        border_words = []
        if raw_border_path.exists():
            rb = raw_border_path.read_bytes()
            border_words = [w & 0x3FF for w in struct.unpack(f"<{len(rb)//2}H", rb)]

        warps = []
        for w_idx, wp in enumerate(d.get("warp_events", [])):
            dest_raw = str(wp.get("dest_warp_id", "0"))
            dest_warp_id = int(dest_raw) if dest_raw.isdigit() else 0
            wx, wy = int(wp["x"]), int(wp["y"])
            beh = 0
            if 0 <= wy < height and 0 <= wx < width:
                mt_id = words[wy * width + wx] & 0x3FF
                if mt_id < len(attrs):
                    beh = attrs[mt_id] & 0x1FF

            kind = "step"
            arrow_dir = ARROW_WARP_DIRS.get(beh)
            if beh in DOOR_WARP_BEHAVIORS:
                kind = "door"
            elif arrow_dir:
                kind = f"arrow_{arrow_dir}"
            elif wy * width + wx < len(words) and ((words[wy * width + wx] >> 10) & 3) != 0:
                kind = "door"

            warps.append({
                "warpId": w_idx,
                "x": wx,
                "y": wy,
                "elevation": int(wp.get("elevation", 0)),
                "destMap": wp["dest_map"],
                "destWarpId": dest_warp_id,
                "behavior": beh,
                "kind": kind,
            })

        metatiles, collisions, behaviors, ledge_dirs = build_collision_and_behaviors(
            words, attrs, width, warps
        )

        # Normalize NPCs / object events
        npcs = []
        for idx_obj, obj in enumerate(d.get("object_events", [])):
            gfx_id = obj.get("graphics_id", "")
            npc_info = npc_manifest.get(gfx_id)
            npcs.append({
                "id": obj.get("local_id") or f"OBJ_{idx_obj}",
                "x": int(obj["x"]),
                "y": int(obj["y"]),
                "elevation": int(obj.get("elevation", 3)),
                "graphicsId": gfx_id,
                "spriteFile": npc_info["file"] if npc_info else None,
                "frameWidth": npc_info["frameWidth"] if npc_info else 16,
                "frameHeight": npc_info["frameHeight"] if npc_info else 32,
                "frameCount": npc_info["frameCount"] if npc_info else 1,
                "facing": FACING_FROM_MOVEMENT.get(obj.get("movement_type", ""), "down"),
                "movementType": obj.get("movement_type", "MOVEMENT_TYPE_NONE"),
                "trainerType": obj.get("trainer_type", "TRAINER_TYPE_NONE"),
                "script": obj.get("script", "0x0"),
                "flag": obj.get("flag", "0"),
            })

        connections = []
        for c in (d.get("connections") or []):
            connections.append({
                "direction": c["direction"],
                "offset": int(c.get("offset", 0)),
                "map": c["map"],
            })

        env = resolve_environment(mid, d.get("map_type", "MAP_TYPE_INDOOR"), wild_envs)
        display_name = format_display_name(name, wild_names.get(mid))

        map_payload = {
            "id": mid,
            "name": name,
            "displayName": display_name,
            "mapType": d.get("map_type", ""),
            "regionMapSection": d.get("region_map_section", ""),
            "environment": env,
            "weather": d.get("weather", "WEATHER_NONE"),
            "allowCycling": bool(d.get("allow_cycling", False)),
            "allowRunning": bool(d.get("allow_running", True)),
            "width": width,
            "height": height,
            "tileset": pair_key,
            "border": {
                "width": int(lay.get("border_width", 2)),
                "height": int(lay.get("border_height", 2)),
                "metatiles": border_words,
            },
            "metatiles": metatiles,
            "collisions": collisions,
            "behaviors": behaviors,
            "ledgeDirs": ledge_dirs,
            "connections": connections,
            "warps": warps,
            "npcs": npcs,
            "signs": [
                {"x": int(b["x"]), "y": int(b["y"]), "type": b.get("type", "sign"), "script": b.get("script", "")}
                for b in (d.get("bg_events") or [])
            ],
        }

        (MAPS_OUT_DIR / f"{mid}.json").write_text(
            json.dumps(map_payload, separators=(",", ":")), encoding="utf-8"
        )

        # Find safe spawn inside map (first warp or walkable tile near center)
        spawn = {"x": width // 2, "y": height // 2}
        if warps:
            w0 = warps[0]
            spawn = {"x": w0["x"], "y": w0["y"]}
            if w0["kind"] == "door" and w0["y"] + 1 < height and collisions[(w0["y"] + 1) * width + w0["x"]] in (0, 2):
                spawn = {"x": w0["x"], "y": w0["y"] + 1}
        else:
            cx, cy = width // 2, height // 2
            best_d = 10**9
            for yy in range(height):
                for xx in range(width):
                    if collisions[yy * width + xx] in (0, 2):
                        dist = abs(xx - cx) + abs(yy - cy)
                        if dist < best_d:
                            best_d = dist
                            spawn = {"x": xx, "y": yy}

        has_encounters = (mid in wild_envs) and (2 in collisions or 3 in collisions)
        maps_index.append({
            "id": mid,
            "name": name,
            "displayName": display_name,
            "mapType": d.get("map_type", ""),
            "environment": env,
            "width": width,
            "height": height,
            "tileset": pair_key,
            "defaultSpawn": spawn,
            "hasWildEncounters": has_encounters,
            "warpCount": len(warps),
            "connectionCount": len(connections),
        })

    (TILESET_OUT_DIR / "tilesets_manifest.json").write_text(
        json.dumps(tilesets_manifest, indent=2), encoding="utf-8"
    )
    maps_index.sort(key=lambda m: (
        {"MAP_TYPE_TOWN": 0, "MAP_TYPE_CITY": 0, "MAP_TYPE_ROUTE": 1, "MAP_TYPE_UNDERGROUND": 2}.get(m["mapType"], 3),
        m["name"],
    ))
    (MAPS_OUT_DIR / "maps_index.json").write_text(
        json.dumps({"count": len(maps_index), "maps": maps_index}, indent=2), encoding="utf-8"
    )
    return tilesets_manifest, {"count": len(maps_index), "exportedIds": exported_ids}, list(exported_ids)


# ---------------------------------------------------------------------------
# 5. Built-in Integrity Verification
# ---------------------------------------------------------------------------
def self_verify(exported_ids: List[str], tilesets_manifest: dict) -> None:
    exported_set = set(exported_ids)
    wild_data = json.loads(WILD_ENCOUNTERS_PATH.read_text(encoding="utf-8"))
    kanto_wild = [z["mapId"] for z in wild_data["zones"] if z.get("region") == "kanto"]
    missing_wild = [m for m in kanto_wild if m not in exported_set]
    assert not missing_wild, f"Faltan zonas salvajes de Kanto: {missing_wild}"

    for ts_key, ts in tilesets_manifest.items():
        p = WEB_ROOT / ts["file"]
        assert p.exists(), f"Falta tileset PNG: {p}"

    warp_errors = []
    for mid in exported_ids:
        mp = json.loads((MAPS_OUT_DIR / f"{mid}.json").read_text(encoding="utf-8"))
        total_cells = mp["width"] * mp["height"]
        assert len(mp["metatiles"]) == total_cells
        assert len(mp["collisions"]) == total_cells
        for wp in mp["warps"]:
            dm = wp["destMap"]
            if dm in exported_set:
                target = json.loads((MAPS_OUT_DIR / f"{dm}.json").read_text(encoding="utf-8"))
                if wp["destWarpId"] >= len(target["warps"]):
                    warp_errors.append((mid, wp["warpId"], dm, wp["destWarpId"]))
    assert not warp_errors, f"Errores en warps: {warp_errors[:5]}"


def main() -> None:
    ensure_dirs()
    print("[1/4] Extrayendo sprites de protagonistas (Ash, Leaf, Gary)...")
    char_man = extract_protagonists()
    print(f"      -> {len(char_man['characters'])} hojas de protagonistas generadas en {CHAR_OUT_DIR}")

    print("[2/4] Extrayendo sprites de NPCs y objetos del Overworld...")
    npc_man = extract_npcs()
    print(f"      -> {len(npc_man)} entradas GFX de NPCs procesadas en {NPC_OUT_DIR}")

    print("[3/4] Extrayendo sprites front/back de los 151 Pokémon...")
    pkm_count = extract_pokemon_sprites()
    print(f"      -> {pkm_count} PNGs Pokémon guardados en {PKM_OUT_DIR}")

    print("[4/4] Renderizando tilesets PNG y extrayendo mapas de Kanto...")
    ts_man, map_summary, exported_ids = extract_maps_and_tilesets(npc_man)
    print(f"      -> {len(ts_man)} atlas de tilesets PNG en {TILESET_OUT_DIR}")
    print(f"      -> {map_summary['count']} mapas JSON de Kanto en {MAPS_OUT_DIR}")

    self_verify(exported_ids, ts_man)
    print("OK: Autoverificación completada sin errores.")


if __name__ == "__main__":
    main()
