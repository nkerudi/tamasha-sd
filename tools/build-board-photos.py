#!/usr/bin/env python3
"""
Tamasha SD — board photo pipeline.

Reads the raw board photos in photos/board/<year>/ and writes web-ready
derivatives into photos/board/<year>/web/:

  <slug>-card.webp   640x854  (3:4 portrait, face-centred) — grid tiles
  <slug>-full.webp   <=1600w  (original framing)           — lightbox
  full-board-N.webp  <=2400w  (original framing)           — page header

It also regenerates board-data.js from the filenames, so adding next year's
board is: drop the photos in photos/board/26-27/, run this script, done.

Filename convention (this is what the script reads):
    first-last_role-with-dashes.jpg
    full-board-1.jpg          (group photos, any number)

Usage:
    pip install pillow opencv-python-headless
    python3 tools/build-board-photos.py
    python3 tools/build-board-photos.py --years 26-27      # just one year
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    print("Missing opencv. Run: pip install opencv-python-headless")
    sys.exit(1)

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Missing pillow. Run: pip install pillow")
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
BOARD_DIR = ROOT / "photos" / "board"

CARD_W, CARD_H = 640, 854          # 3:4 grid tile, 2x for ~320px display
FULL_MAX_W = 1600                  # lightbox
GROUP_MAX_W = 2400                 # header group shots
CARD_QUALITY = 82
FULL_QUALITY = 80

# Where a face should sit inside the card, as a fraction of card height.
FACE_Y_TARGET = 0.30

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

# Grid order. Members are sorted by their role's position in this list, then
# alphabetically within the role, so moving a committee here moves everyone
# on it. Anything not listed sorts just before the interns. Roles must match
# the slugs used in the filenames.
ROLE_ORDER = [
    "director",
    "executive-advisor",
    "vp-internal",
    "vp-external",
    "vp-finance",
    "head-liaison",
    "exhibition-and-outreach",
    "judging",
    "registration",
    "logistics",
    "tech",
    "tech-logistics-chair",
    "media",
    "hospitality",
    "social-venue",
    "finance",
    "safety-and-wellness",
    "intern",
]

# Roles that should be shown under a friendlier label than the slug.
ROLE_LABELS = {
    "vp-internal": "VP Internal",
    "vp-external": "VP External",
    "vp-finance": "VP Finance",
    "safety-and-wellness": "Safety & Wellness",
    "exhibition-and-outreach": "Exhibition & Outreach",
    "social-venue": "Social & Venue",
    "tech": "Tech",
    "tech-logistics-chair": "Tech & Logistics",
    "head-liaison": "Head Liaison",
    "executive-advisor": "Executive Advisor",
}

# Small-word handling for auto-titlecasing names and roles.
LOWER_WORDS = {"and", "of", "the"}


def titlecase(slug: str) -> str:
    words = slug.replace("_", " ").replace("-", " ").split()
    out = []
    for i, w in enumerate(words):
        if w in LOWER_WORDS and i > 0:
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


def role_label(slug: str) -> str:
    if slug in ROLE_LABELS:
        return ROLE_LABELS[slug]
    label = titlecase(slug)
    return label.replace(" And ", " & ").replace(" and ", " & ")


def role_rank(slug: str) -> int:
    if slug in ROLE_ORDER:
        return ROLE_ORDER.index(slug)
    if slug == "intern":
        return len(ROLE_ORDER)
    return len(ROLE_ORDER) - 1


# --------------------------------------------------------------------------
# Face-aware cropping
# --------------------------------------------------------------------------

_cascade = None

# Subjects in these shoots are always framed near the middle. Anything the
# detectors report outside this band is a false positive (pier pillars read as
# faces surprisingly often), so we clamp rather than trust it.
X_BAND = (0.33, 0.67)


def cascade():
    global _cascade
    if _cascade is None:
        base = Path(cv2.data.haarcascades)
        _cascade = cv2.CascadeClassifier(
            str(base / "haarcascade_frontalface_default.xml"))
    return _cascade


def focus_centre(gray):
    """Horizontal centre of the in-focus subject.

    The portraits are shot at a wide aperture, so the subject is the only
    sharp thing in frame. Column-wise edge energy finds them without a model.
    Returns (cx_fraction, confidence).
    """
    lap = np.abs(cv2.Laplacian(cv2.GaussianBlur(gray, (3, 3), 0), cv2.CV_32F))
    lap = cv2.GaussianBlur(lap, (0, 0), 9)
    cols = lap.mean(axis=0)
    spread = float(np.ptp(cols))
    if spread < 1e-6:
        return 0.5, 0.0
    cols = (cols - cols.min()) / spread

    iw = len(cols)
    x = np.linspace(-1, 1, iw)
    weighted = cols * (1 - 0.45 * np.abs(x))        # pull toward centre
    weighted = cv2.GaussianBlur(weighted.reshape(1, -1), (0, 0), iw * 0.03).ravel()

    cx = float(np.argmax(weighted)) / iw
    # Confidence: how much the peak stands out from the frame's average.
    conf = float(weighted.max() - weighted.mean())
    return cx, conf


def find_subject(img_path: Path):
    """Return (cx, cy) as fractions of image size, plus a note for logging."""
    img = cv2.imread(str(img_path))
    if img is None:
        return 0.5, 0.28, "unreadable — centred"

    h, w = img.shape[:2]
    scale = 900 / max(h, w)
    small = cv2.resize(img, (int(w * scale), int(h * scale))) if scale < 1 else img
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    ih, iw = gray.shape[:2]

    cx, conf = focus_centre(gray)

    # A face gives us a vertical anchor that edge energy can't. Only believe
    # detections that land near where the focus pass already points.
    faces = cascade().detectMultiScale(cv2.equalizeHist(gray), scaleFactor=1.08,
                                       minNeighbors=7, minSize=(36, 36))
    best, note = None, "focus"
    for (x, y, fw, fh) in faces:
        fcx = (x + fw / 2) / iw
        if abs(fcx - cx) < 0.12 and X_BAND[0] < fcx < X_BAND[1]:
            if best is None or fw * fh > best[2] * best[3]:
                best = (x, y, fw, fh)

    if best is not None:
        x, y, fw, fh = best
        cx = (x + fw / 2) / iw
        cy = (y + fh / 2) / ih
        note = "face"
    else:
        # No trustworthy face: assume a standing portrait and put the head in
        # the upper third.
        cy = 0.22
        if conf < 0.08:
            cx, note = 0.5, "low contrast — centred"

    cx = min(max(cx, X_BAND[0]), X_BAND[1])
    return cx, cy, note


OVERRIDE_PATH = ROOT / "tools" / "crop-overrides.json"
_overrides = None


def overrides():
    """Manual crop nudges for photos the automatic pass gets wrong.

    Keyed by "<year>/<filename>", each entry may set:
      cx, cy  subject centre as a 0-1 fraction of the image
      zoom    >1 tightens the crop around that point
    """
    global _overrides
    if _overrides is None:
        if OVERRIDE_PATH.exists():
            _overrides = json.loads(OVERRIDE_PATH.read_text())
        else:
            _overrides = {}
    return _overrides


def crop_card(src: Path, dest: Path):
    im = Image.open(src)
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size

    target = CARD_W / CARD_H  # 0.75
    if w / h > target:
        crop_h = h
        crop_w = int(round(h * target))
    else:
        crop_w = w
        crop_h = int(round(w / target))

    key = f"{src.parent.name}/{src.name}"
    ov = overrides().get(key)
    if ov:
        cxf = ov.get("cx", 0.5)
        cyf = ov.get("cy", 0.28)
        note = "override"
        zoom = float(ov.get("zoom", 1))
        if zoom > 1:
            crop_w = max(8, int(round(crop_w / zoom)))
            crop_h = max(8, int(round(crop_h / zoom)))
    else:
        cxf, cyf, note = find_subject(src)

    left = cxf * w - crop_w / 2
    top = cyf * h - crop_h * FACE_Y_TARGET

    left = int(round(max(0, min(left, w - crop_w))))
    top = int(round(max(0, min(top, h - crop_h))))

    im = im.crop((left, top, left + crop_w, top + crop_h))
    im = im.resize((CARD_W, CARD_H), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=CARD_QUALITY, method=6)
    return note


def downscale(src: Path, dest: Path, max_w: int, quality: int):
    im = Image.open(src)
    im = ImageOps.exif_transpose(im).convert("RGB")
    if im.width > max_w:
        ratio = max_w / im.width
        im = im.resize((max_w, int(round(im.height * ratio))), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=quality, method=6)


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

def build_year(year_dir: Path, force: bool):
    year = year_dir.name
    web = year_dir / "web"
    members, groups = [], []

    files = sorted(p for p in year_dir.iterdir()
                   if p.suffix.lower() in IMAGE_EXTS and not p.name.startswith("."))

    for src in files:
        stem = src.stem
        if stem.startswith("full-board"):
            dest = web / f"{stem}.webp"
            if force or not dest.exists():
                downscale(src, dest, GROUP_MAX_W, FULL_QUALITY)
            groups.append(f"photos/board/{year}/web/{dest.name}")
            print(f"  group  {stem}")
            continue

        if "_" not in stem:
            print(f"  skip   {src.name}  (expected name_role.ext)")
            continue

        name_slug, role_slug = stem.split("_", 1)
        role_slug = re.sub(r"-chair$", "", role_slug)  # "media-chair" -> "media"

        card = web / f"{name_slug}-card.webp"
        full = web / f"{name_slug}-full.webp"
        note = "cached"
        if force or not card.exists():
            note = crop_card(src, card)
        if force or not full.exists():
            downscale(src, full, FULL_MAX_W, FULL_QUALITY)

        print(f"  member {name_slug:<26} {role_label(role_slug):<24} [{note}]")

        members.append({
            "name": titlecase(name_slug),
            "role": role_label(role_slug),
            "roleSlug": role_slug,
            "card": f"photos/board/{year}/web/{card.name}",
            "full": f"photos/board/{year}/web/{full.name}",
        })

    members.sort(key=lambda m: (role_rank(m["roleSlug"]), m["name"]))
    groups.sort()
    return {"year": year, "groups": groups, "members": members}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", nargs="*",
                    help="limit --force to these seasons, e.g. 25-26 26-27")
    ap.add_argument("--force", action="store_true",
                    help="rebuild derivatives that already exist")
    args = ap.parse_args()

    year_dirs = sorted(
        (d for d in BOARD_DIR.iterdir()
         if d.is_dir() and re.fullmatch(r"\d{2}-\d{2}", d.name)),
        key=lambda d: d.name, reverse=True,
    )
    # Every season is always indexed so board-data.js stays complete;
    # --years only narrows which derivatives get regenerated.
    selected = set(args.years) if args.years else {d.name for d in year_dirs}

    seasons = []
    for d in year_dirs:
        print(f"\n{d.name}")
        seasons.append(build_year(d, args.force and d.name in selected))

    out = ROOT / "board-data.js"
    payload = json.dumps(seasons, indent=2)
    out.write_text(
        "// Generated by tools/build-board-photos.py — do not edit by hand.\n"
        "// To add a season: drop photos into photos/board/<yy-yy>/ using the\n"
        "// first-last_role.jpg convention, then re-run the script.\n"
        f"window.TAMASHA_BOARD = {payload};\n"
    )
    total = sum(len(s["members"]) for s in seasons)
    print(f"\nWrote {out.relative_to(ROOT)} — {len(seasons)} season(s), {total} members.")


if __name__ == "__main__":
    main()
