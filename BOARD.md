# Board page — how it works

The Board tab (`board.html`) is generated from whatever is sitting in
`photos/board/`. Nobody should ever be editing a list of names by hand.

## Adding next year's board

1. Make the folder: `photos/board/26-27/`
2. Drop the photos in, named `first-last_role.jpg`:

   ```
   photos/board/26-27/
     priya-shah_director.jpg
     arun-menon_media.jpg
     dev-patel_intern.jpg
     full-board-1.jpg          # group shots, any number
   ```

   The part before the `_` becomes the displayed name, the part after
   becomes the role. Dashes turn into spaces. `full-board-*` files are
   treated as group photos and shown in the band at the top.

3. Run the script:

   ```bash
   pip install pillow opencv-python-headless
   python3 tools/build-board-photos.py
   ```

That's it. The script writes web-sized images into
`photos/board/26-27/web/` and regenerates `board-data.js`. The page picks
up the new season automatically and shows it as the default tab.

## Why the script exists

The raw photos are huge — some are 7008px wide, and the folder is about
62 MB. Shipping those directly would make the page unusable on phones.
The script produces two derivatives per person:

| File | Size | Used for |
|---|---|---|
| `<name>-card.webp` | 640×854 | the grid tiles |
| `<name>-full.webp` | ≤1600px wide | the lightbox |

Group photos get a single ≤2400px version. Everything is WebP. Both
seasons together come to roughly 7.6 MB.

Derivatives are cached — re-running the script only processes photos that
don't have a `web/` version yet. Use `--force` to rebuild everything, and
`--years 26-27` to limit `--force` to one season.

## Cropping

The tiles are 3:4 portraits, but most source photos are wide landscape
shots, so something has to decide where to crop. Face detection alone
does not work here: the pier pillars in the Scripps shoot register as
faces constantly and the crops came out with people cut off at the edge.

What the script actually does:

1. The portraits are shot wide-open, so the subject is the only sharp
   thing in frame. Column-wise edge energy finds them reliably.
2. A face detector runs too, but its result is only used when it agrees
   with the focus pass — it contributes the vertical anchor.
3. The result is clamped to the middle third of the frame, since these
   are posed portraits and the subject is never at the edge.

### Fixing a bad crop

Some photos defeat all of that — Bhagya's is a night shot where he's
small and off to one side. For those, add an entry to
`tools/crop-overrides.json`:

```json
{
  "25-26/bhagya-arora_intern.jpg": { "cx": 0.65, "cy": 0.60, "zoom": 2.4 }
}
```

`cx`/`cy` are the subject's centre as a fraction of the image (0 = left
or top, 1 = right or bottom). `zoom` above 1 tightens the crop. Then:

```bash
python3 tools/build-board-photos.py --force --years 25-26
```

Check the result before committing. A quick way to eyeball a whole season
at once is to open the `web/` folder in Finder with large icons.

## Changing the grid order

Within a tier, members are sorted by their committee's position in
`ROLE_ORDER` at the top of `tools/build-board-photos.py`, then
alphabetically within the committee. Moving a committee in that list moves
everyone on it, in every season. Re-run the script after editing.

## Which roles count as directors

The page sorts everyone into three tiers. A member lands in **Directors**
only if their role slug is `director`, `executive-advisor`, or starts with
`vp-`. **Interns** are role slug `intern`. Everyone else — including head
liaisons — is a **Committee chair**.

That rule lives in one place, the `TIERS` array at the top of `board.js`,
and `board-preview.js` uses the same test. If the board structure changes,
edit it there rather than special-casing anyone.

## Files

| File | What it is |
|---|---|
| `board.html` | the page |
| `board.css` | styles, scoped to this page so it doesn't collide with `styles.css` |
| `board.js` | renders the grid and runs the lightbox |
| `board-data.js` | **generated** — do not edit by hand |
| `board-preview.js` | optional strip for the landing page |
| `snippets/landing-board-section.html` | markup + install notes for that strip |
| `tools/build-board-photos.py` | the generator |
| `tools/crop-overrides.json` | manual crop fixes |

## Still to hook up

`board.html` links to itself in its own nav and footer. The nav on
`index.html`, `placings.html`, `history.html` and `contact.html` still
needs a `<li><a href="board.html">Board</a></li>` adding — left out on
purpose while the landing page is being rewritten, to avoid conflicts.
