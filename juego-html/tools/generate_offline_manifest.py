#!/usr/bin/env python3
"""
Generador de Manifiesto de Recursos Offline e Íconos PWA para juego-html/
- Crea icon-192.png e icon-512.png usando el sprite de Pikachu (025_front.png)
  centrado sobre un emblema rojo/dorado estilo Pokémon FireRed.
- Escanea todos los recursos estáticos necesarios dentro de juego-html/ y escribe
  juego-html/data/offline_assets.json usando exclusivamente rutas relativas (./).
"""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw

JUEGO_DIR = Path(__file__).resolve().parent.parent
PIKACHU_SPRITE = JUEGO_DIR / "assets" / "sprites" / "pokemon" / "025_front.png"
ASSETS_DIR = JUEGO_DIR / "assets"
DATA_DIR = JUEGO_DIR / "data"
OUTPUT_MANIFEST = DATA_DIR / "offline_assets.json"


def generate_pwa_icon(size: int, out_path: Path) -> None:
    """Genera un ícono PNG cuadrado estilizado con Pikachu pixel-art centrado."""
    canvas = Image.new("RGBA", (size, size), (15, 23, 42, 255))
    draw = ImageDraw.Draw(canvas)

    # Fondo degradado carmesí superior -> azul noche inferior (estética Pokéball / FireRed)
    half = size // 2
    for y in range(size):
        if y < half:
            t = y / max(1, half - 1)
            r = int(215 - 45 * t)
            g = int(38 - 10 * t)
            b = int(38 - 8 * t)
        else:
            t = (y - half) / max(1, size - half - 1)
            r = int(26 - 12 * t)
            g = int(36 - 16 * t)
            b = int(64 - 24 * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Franja central estilo Pokéball con borde dorado
    band_h = max(8, int(size * 0.09))
    y0 = half - band_h // 2
    y1 = half + band_h // 2
    draw.rectangle([0, y0, size, y1], fill=(17, 24, 39, 255))
    border_w = max(2, int(size * 0.018))
    draw.rectangle([0, y0, size, y0 + border_w], fill=(251, 191, 36, 255))
    draw.rectangle([0, y1 - border_w, size, y1], fill=(251, 191, 36, 255))

    # Medallón circular central luminoso
    radius = int(size * 0.34)
    cx, cy = size // 2, size // 2
    draw.ellipse(
        [cx - radius - border_w, cy - radius - border_w, cx + radius + border_w, cy + radius + border_w],
        fill=(251, 191, 36, 255),
    )
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=(248, 250, 252, 245),
    )

    # Marco sutil exterior
    outer_pad = max(2, int(size * 0.02))
    draw.rounded_rectangle(
        [outer_pad, outer_pad, size - outer_pad, size - outer_pad],
        radius=int(size * 0.16),
        outline=(251, 191, 36, 200),
        width=max(2, int(size * 0.025)),
    )

    if not PIKACHU_SPRITE.exists():
        raise FileNotFoundError(f"Falta el sprite de Pikachu requerido en {PIKACHU_SPRITE}")

    pika = Image.open(PIKACHU_SPRITE).convert("RGBA")
    bbox = pika.getbbox()
    if bbox:
        pika = pika.crop(bbox)

    # Escalar con Nearest Neighbor para conservar pixel-art nítido
    target_dim = int(size * 0.64)
    scale = max(1, min(target_dim // max(1, pika.width), target_dim // max(1, pika.height)))
    new_w = pika.width * scale
    new_h = pika.height * scale
    pika_scaled = pika.resize((new_w, new_h), Image.Resampling.NEAREST)

    px = (size - new_w) // 2
    py = (size - new_h) // 2
    canvas.alpha_composite(pika_scaled, dest=(px, py))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def collect_offline_assets() -> dict:
    """Escanea todos los archivos necesarios para ejecución 100% offline usando rutas relativas ./."""
    rel_paths = set()
    categories = {
        "core": [],
        "js": [],
        "data": [],
        "maps": [],
        "assets": [],
    }

    # 1. Carcasa principal de la aplicación PWA
    for shell_rel in ["index.html", "manifest.json", "css/game.css"]:
        full = JUEGO_DIR / shell_rel
        if full.exists():
            p = f"./{shell_rel}"
            rel_paths.add(p)
            categories["core"].append(p)

    # 2. Todos los módulos JS de la aplicación (battle, overworld, game)
    js_dir = JUEGO_DIR / "js"
    for f in sorted(js_dir.rglob("*.js")):
        rel = "./" + f.relative_to(JUEGO_DIR).as_posix()
        rel_paths.add(rel)
        categories["js"].append(rel)

    # 3. Datos JSON (raíz de data/ y data/maps/)
    for f in sorted(DATA_DIR.glob("*.json")):
        if f.name == "offline_assets.json":
            continue
        rel = "./" + f.relative_to(JUEGO_DIR).as_posix()
        rel_paths.add(rel)
        categories["data"].append(rel)

    maps_dir = DATA_DIR / "maps"
    if maps_dir.exists():
        for f in sorted(maps_dir.glob("*.json")):
            rel = "./" + f.relative_to(JUEGO_DIR).as_posix()
            rel_paths.add(rel)
            categories["maps"].append(rel)

    # 4. Todos los gráficos .png y manifiestos .json dentro de assets/
    for f in sorted(ASSETS_DIR.rglob("*")):
        if f.is_file() and f.suffix.lower() in {".png", ".json"}:
            rel = "./" + f.relative_to(JUEGO_DIR).as_posix()
            rel_paths.add(rel)
            categories["assets"].append(rel)

    ordered_assets = (
        sorted(categories["core"])
        + sorted(categories["js"])
        + sorted(categories["data"])
        + sorted(categories["maps"])
        + sorted(categories["assets"])
    )

    # Calcular digest determinista sobre rutas y tamaños de archivo
    h = hashlib.sha256()
    total_bytes = 0
    for rel in ordered_assets:
        fp = JUEGO_DIR / rel[2:]
        size = fp.stat().st_size if fp.exists() else 0
        total_bytes += size
        h.update(f"{rel}:{size}\n".encode("utf-8"))

    version = f"v1-{h.hexdigest()[:10]}"
    return {
        "version": version,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalAssets": len(ordered_assets),
        "totalSizeMB": round(total_bytes / (1024 * 1024), 2),
        "coreShell": sorted(categories["core"]) + sorted(categories["js"]) + [
            p for p in sorted(categories["data"]) if p != "./data/wild_encounters.json"
        ],
        "counts": {k: len(v) for k, v in categories.items()},
        "assets": ordered_assets,
    }


def main() -> None:
    print("Generando íconos PWA con Pikachu (025_front.png)...")
    generate_pwa_icon(192, ASSETS_DIR / "icon-192.png")
    generate_pwa_icon(512, ASSETS_DIR / "icon-512.png")

    print("Escaneando recursos estáticos en juego-html/...")
    manifest_data = collect_offline_assets()

    OUTPUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_MANIFEST.write_text(
        json.dumps(manifest_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(
        f"Manifiesto generado: {OUTPUT_MANIFEST.relative_to(JUEGO_DIR)} "
        f"({manifest_data['totalAssets']} archivos, {manifest_data['totalSizeMB']} MB, "
        f"versión {manifest_data['version']})"
    )
    print("Desglose:", manifest_data["counts"])


if __name__ == "__main__":
    main()
