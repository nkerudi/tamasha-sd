#!/usr/bin/env python3
"""
Tamasha SD — homepage showcase photo pipeline.

Generates the small, curated set of web-ready images used by the Tamasha /
Sanedo showcase panels on index.html: a handful of "rotating" photos (the
auto-advancing gallery) and a few "static" photos (the fixed row) per
competition.

Reads from the raw photos in photos/tamasha_gallery/ and photos/sanedo_gallery/
and writes 4:3 center-cropped derivatives into a "web" subfolder of each.

Usage:
    pip install pillow
    python3 tools/build-showcase-photos.py
"""

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "photos"

ROTATE_W, ROTATE_H = 1200, 900   # 4:3, shown large in the rotator
STATIC_W, STATIC_H = 640, 480    # 4:3, shown small in the fixed row
QUALITY = 82

# (source filename, output name) — curated by hand, spread across the raw
# folders for variety. Edit these lists and re-run to swap which photos show.
SHOWCASE = {
    "tamasha_gallery": {
        "slug": "tamasha",
        "rotate": [
            "Copy of 20260214-TamashaSD-Jodie-Hitosis-5818.jpg",
            "Copy of IMG_0059.jpg",
            "Copy of _MG_6091.jpg",
            "Copy of _MG_7554.jpg",
            "KSV_1223.jpg",
            "KSV_8828.jpg",
            "RGBTV 2024 Tamasha SD 03 UW Kahaani February 24, 2024 RAL_0936.jpg",
            "RGBTV 2024 Tamasha SD 06 RU SAPA February 24, 2024 RAL_4573.jpg",
        ],
        "static": [
            "Copy of 20260214-TamashaSD-Jodie-Hitosis-5917.jpg",
            "Copy of _MG_7252.jpg",
            "KSV_8304.jpg",
            "RGBTV 2024 Tamasha SD 04 UCB Azaad February 24, 2024 RAL_1351.jpg",
        ],
        # One distinct photo per placings.html year-card — deliberately
        # disjoint from "rotate"/"static" above so the placings page never
        # repeats a photo already shown on the homepage.
        "year": [
            "Copy of 20260214-TamashaSD-Jodie-Hitosis-5890.jpg",
            "Copy of IMG_0048.jpg",
            "Copy of IMG_9659.jpg",
            "Copy of IMG_9949.jpg",
            "Copy of _MG_6007.jpg",
            "Copy of _MG_7205.jpg",
            "KSV_0158.jpg",
            "KSV_1192.jpg",
            "KSV_8046.jpg",
            "RGBTV 2024 Highlights Tamasha SD 04 UCB Azaad February 24, 2024 RAL_1742.jpg",
            "RGBTV 2024 Tamasha SD 04 UCB Azaad February 24, 2024 RAL_1073.jpg",
        ],
    },
    "sanedo_gallery": {
        "slug": "sanedo",
        "rotate": [
            "Touchups-206.jpg",
            "Touchups-376.jpg",
            "Touchups-454.jpg",
            "Touchups-500.jpg",
            "Touchups-508.jpg",
            "Touchups-673.jpg",
        ],
        "static": [],
        # Sanedo only has 9 raw photos total. All 6 "rotate" derivatives
        # are built (the placings.html spotlight carousel uses all of
        # them), but index.html's homepage rotator only shows rotate-1..3
        # — that's what actually keeps the "year" photos below from ever
        # appearing on the homepage.
        "year": [
            "Touchups-500.jpg",
            "Touchups-507.jpg",
            "Touchups-508.jpg",
            "Touchups-547.jpg",
            "Touchups-673.jpg",
            "Touchups-679.jpg",
        ],
    },
}


def crop_and_save(src: Path, dest: Path, w: int, h: int):
    im = Image.open(src)
    im = ImageOps.exif_transpose(im).convert("RGB")
    sw, sh = im.size

    target = w / h
    if sw / sh > target:
        crop_w = int(round(sh * target))
        crop_h = sh
    else:
        crop_w = sw
        crop_h = int(round(sw / target))

    left = (sw - crop_w) // 2
    top = (sh - crop_h) // 2
    im = im.crop((left, top, left + crop_w, top + crop_h))
    im = im.resize((w, h), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=QUALITY, method=6)


def build(dir_name: str, cfg: dict):
    src_dir = PHOTOS / dir_name
    web = src_dir / "web"
    slug = cfg["slug"]
    print(f"\n{dir_name}")

    for i, name in enumerate(cfg["rotate"], start=1):
        src = src_dir / name
        dest = web / f"{slug}-rotate-{i}.webp"
        crop_and_save(src, dest, ROTATE_W, ROTATE_H)
        print(f"  rotate-{i}  {name}")

    for i, name in enumerate(cfg["static"], start=1):
        src = src_dir / name
        dest = web / f"{slug}-static-{i}.webp"
        crop_and_save(src, dest, STATIC_W, STATIC_H)
        print(f"  static-{i}  {name}")

    for i, name in enumerate(cfg.get("year", []), start=1):
        src = src_dir / name
        dest = web / f"{slug}-year-{i}.webp"
        crop_and_save(src, dest, STATIC_W, STATIC_H)
        print(f"  year-{i}  {name}")


def main():
    for dir_name, cfg in SHOWCASE.items():
        build(dir_name, cfg)
    print("\nDone.")


if __name__ == "__main__":
    main()
