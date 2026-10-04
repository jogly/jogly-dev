# Photo import dry run

The importer creates a reviewable local stage and has no upload or publish code.
It never writes into the source directory. The default stage lives under
`.photo-build/`, which is ignored by Git.

## Run it

```bash
bun run photos:import -- \
  --album cotswolds \
  --source "/Users/joe/Downloads/iCloud Photos from Joseph Gilley" \
  --dry-run
```

Optional flags:

- `--output <directory>` changes the local stage. Paths inside this repository
  are accepted only below `.photo-build/`; existing non-empty targets must
  already be owned by this importer.
- `--max-edge <pixels>` defaults to `2560`.
- `--quality <1-100>` defaults to `90`.

The `--dry-run` flag is mandatory. Source and output paths may not overlap.

## Outputs

`.photo-build/cotswolds/` contains:

- `masters/<sha256>.jpg`: auto-oriented, sRGB, metadata-free web masters.
- `thumbnails/<sha256>.jpg`: local review thumbnails.
- `manifest.json`: publish-safe order, dimensions, object keys, alt text, and
  captions. It excludes source paths, devices, GPS, and capture timestamps.
- `import-report.json`: local-only source hashes and inspection metadata.
- `contact-sheet.jpg` and `contact-sheet.html`: labeled review sheets.
- `.jogly-photo-stage.json`: ownership marker used to prevent accidental
  replacement of an unrelated directory.

Master names hash the normalized JPEG bytes, so a recipe or pixel change gets a
new immutable key. Initial order uses the absolute EXIF capture instant, including
each photo's UTC offset. A missing offset is inferred only when photos from the
same camera make/model unanimously use one offset. Every rerun recomputes the
complete chronological sequence, so a newly added earlier photo lands in the
right place. Edited `alt` and `caption` values are preserved when the source hash
still matches. Stale masters are deliberately not deleted.
Each completed generation is installed with a directory swap; a failed install
rolls the previous complete stage back into place.

## Export the public manifest

After reviewing the contact sheet, edit alt text and optional captions in
`src/content/photos/cotswolds.json`, then refresh its dimensions, keys, and order
from the local stage:

```bash
bun run photos:export -- --album cotswolds
```

The exporter writes only the publish-safe manifest into `src/content/photos/`.
It preserves existing `title`, `dateRange`, `alt`, and `caption` values by image
ID, so another import does not overwrite editorial work. It does not copy image
bytes into Git.

## Safety and HEIC handling

The importer snapshots and re-hashes every source image before committing the
stage. A decode failure leaves the last successful manifest and contact sheets
unchanged.

JPEG processing uses Sharp. On macOS, HEIC first passes through the system
ImageIO decoder via `sips`; ImageMagick with HEIC support is the fallback. Sharp
then applies orientation, converts to sRGB, resizes without upscaling, and emits
a JPEG without EXIF, XMP, IPTC, ICC, GPS, device, or face-region metadata.
Temporary HEIC decodes live in a generation-local `.scratch/` directory and are
removed before the stage is installed.

No remote credentials are read, and no network request is made.
