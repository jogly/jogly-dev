# Cotswolds photo gallery

The gallery and its photos deploy as static files to GitHub Pages. There is no
runtime image server, Worker, image-service credential, or development-only
gallery branch. `/cotswolds/` is a separate Vite HTML entry.

The tracked manifest is `src/content/photos/cotswolds.json`. Originals and
normalized masters stay out of Git and `dist/`. Generated delivery images live
in ignored `public/photos/` and are copied into `dist/photos/` by Vite.

## Run locally

1. Import/export as described in `docs/photo-import.md`, or run `bun run
   photos:fetch` to download the pinned release bundle after it is published.
2. Start the site:

   ```bash
   bun run dev
   ```

3. Open `http://localhost:5173/cotswolds/`.

`dev` and `build` first run `photos:prepare`. With local masters this generates
the delivery bundle; otherwise it requires an installed, checksum-verified
bundle. Missing assets fail the build instead of publishing an empty gallery.
Unchanged bundles are verified and reused without re-encoding.

`photos:export` also creates a metadata-free WebP blur source for each image,
at most 32 pixels on its longest edge. These tiny data URLs live in the tracked
manifest and ship with the gallery code, so the ambient glow needs no additional
requests or release-bundle changes. Gallery and darkroom share a 32px blurred
layer extended 12px beyond each edge at 12% opacity. The blur source uses screen
blending against the charcoal base, without a saturation boost. It follows the
photo's existing transform without softening or blending the photograph itself.

Darkroom navigation reuses that photo's blur source for a masked 1px edge
reflection. Previous and Next sample the lower-left and lower-right portions,
respectively; the reflection fades down their side edges. Screen blending applies
only to the border ring, never the button fill or label. Two reflection layers
blend from the carousel's actual scroll position, including interrupted and
reversed swipes; there is no independent lighting timer or React render per frame.
Disabled controls retain their dimming, and forced-colors mode omits this decoration.

Darkroom horizontal wheel/trackpad input uses `embla-carousel-wheel-gestures`
8.1.0 alongside Embla 8.6.0. It observes the dialog and feeds horizontal gestures
into the existing carousel's drag and snap behavior; vertical wheel input does
not navigate. Its track-targeted drag events are accepted alongside direct photo
swipes. Carousel destruction also removes the plugin's listeners. Buttons,
keyboard navigation, reflected lighting, and reduced-motion settling share the
same carousel state.

Pointer input suppresses control focus outlines without blurring the focused
element. Keyboard input restores the existing `:focus-visible` indicators,
including on touch devices with a keyboard. Dialog focus trapping, initial
Close-button focus, and focus restoration to the opener remain intact.

The thumbnail rail is sticky within the gallery's native scroll container,
overlaid in the existing left margin without moving the photographs. Its grid
cell overlaps the photo stream; the measured header offset keeps its top at the
same viewport inset from the first frame. A ResizeObserver measures the margin and
reveals the 72px rail only when at least 112px is available. The transitions-dev
panel recipe fades, slides, and cross-blurs it out when space is lost, immediately
making it inert. The shell clips to the available gutter during resizing.
All thumbnails fit within the viewport as overlapping cards: there is no separate
rail scrolling or auto-centering. One frame-coalesced scroll measurement tracks
the visible photo range and the photo nearest the viewport center. A single muted
background rectangle represents that visible range, including partial images,
with a 14% white fill and 24% white edge. Bright individual thumbnail frames,
selection rings, and gloss are omitted. A zero-blur dark drop shadow preserves
the depth of the overlapping album stacks without a solid bottom rim.
Thumbnails around the viewport marker retain their full color, with a smooth
distance-based falloff to 10% saturation farther away. That color neighborhood
follows the marker without changing thumbnail brightness or stack movement.
The main photographs keep their full color.
Hover temporarily opens one sleeve
in place above the pile, then keyboard focus, then the active photo. Hover never
repositions the shelf or its hit regions; only scrolling and keyboard navigation
move the readable group. Hover changes only on pointer movement, not
animation-induced entry, so a stationary pointer cannot trigger another target.
A flat shelf of fully readable cards uses most of the rail height. The viewport
marker first travels toward the rail midpoint while the shelf stays still. It
then holds at the midpoint while thumbnails flow through it. Once the bottom
pile has unfolded, the shelf stops and the marker travels toward the bottom.
Placement follows the center of the visible thumbnail slice, including partial
photos and unequal image heights, rather than the integer active index.
Scroll-driven placement and the viewport marker share those coordinates with no
trailing position transition. Only
distant cards overlap into sleeve piles,
with a maximum 20-degree tilt and no sideways rotation. The selected card and
its neighbors stay level. Their size stays fixed; transforms handle placement
and tilt instead of width/height animation.
The motion-design pass separates 90ms hover feedback from the local 180ms sleeve
flattening and 300ms keyboard-focus movement, using cubic-bezier(0.2, 0, 0, 1) without
overshoot. Hover no longer changes the whole rail's transition duration. All
transitions are interruptible and disabled for reduced motion. Thumbnail clicks
use browser smooth scrolling, with an immediate jump for reduced motion.
Wheel, pointer-down (including scrollbar/rail presses), touch-start, key-down,
and window blur cancel native smooth scrolling and synchronize ScrollBooster
at the current position. The sticky rail and main photographs share native wheel
scrolling: no preventDefault, delta conversion, synthetic wheel events, or
manual scrollBy forwarding. Browser smoothing, momentum, and pinch-to-zoom remain
browser-owned.
Thumbnails reuse existing 480px WebP derivatives and are not requested until
the rail first fits. No new photo bundle is needed.

## Dragging and swiping

Gallery mouse dragging uses [ScrollBooster 3.0.2](https://github.com/ilyashubin/scrollbooster)
with its default friction, vertical direction, native scrolling, and no edge bounce.
Its update callback writes scroll position only while moving, so idle image-load
and resize updates do not cancel browser-owned thumbnail navigation.
The page uses a viewport-height native scroll container so dragging and scrolling
share the same coordinates. Touch and wheel scrolling remain browser-owned;
there is no wheel smoothing or custom velocity calculation. Wheel input, a new
pointer press, and opening darkroom stop existing mouse momentum.

Darkroom uses [Embla Carousel 8.6.0](https://www.embla-carousel.com/docs/v8/)
with its default snap physics, one photo per slide, and no looping. Swipes, arrow
keys, and Previous/Next all drive the same carousel. Nearby slides load small
previews; only the selected photo requests full resolution. Drag-release clicks
are suppressed by the libraries. Actual dragging can reverse a closing image,
while a simple click retains the interruptible open/close transition. Closing
during a swipe preserves the visible image position before flying it back.

Reduced motion removes the return/reveal transitions and carousel navigation
animation, and stops mouse inertia on release. To check gesture changes, drag
vertically and release, interrupt with a wheel or another drag, swipe both ways
in darkroom, click twice during closing, and test keyboard opening/navigation.
Check touch behavior on a physical phone as well as desktop mouse input.

## Test scope

`bun run test:photos` covers import safety, capture-time ordering, metadata removal,
delivery assets, and helper-level calculations. New assertions need an observable
requirement; do not pin thumbnail counts, spacing, angles, or coordinates solely
because they match today's styling.

The close-helper tests use controlled browser API doubles to check completion,
cancellation, and reopening. They do not mount React, execute CSS transitions, or
prove reduced-motion, static-mode, or gesture behavior. Verify those through the
real gallery using the interactions above; do not report a unit-test pass as
visual or end-to-end coverage.

Development, production, and darkroom images share this URL contract:

```text
/photos/v1/<album>/<master-sha256>/<width>.<avif|webp|jpeg>
```

Widths are 480, 768, 1200, 1600, 2400, and the natural master width, deduplicated
and never upscaled. Qualities are AVIF/66, WebP/78, JPEG/84. JPEG is the fallback.
The importer handles EXIF orientation and sRGB conversion before delivery
encoding; exported files omit identifying metadata. Encoding is bounded to two
jobs at a time. `photos:smoke` checks every delivered file's metadata and size.

## Production architecture

Use the existing GitHub Pages workflow. Optimized image bytes are distributed
as a GitHub release attachment, **not Git blobs**. `photo-assets.json` pins its
release tag, filename, and full SHA-256. CI downloads that exact attachment,
verifies its checksum before extraction, checks every file against the manifest,
builds, and serves `dist/` with Python's plain static server to run an HTTP check
before uploading the Pages artifact. CI does not need original photos or masters.

Create the local release bundle after imports or an encoding recipe change:

```bash
bun run photos:pack
bun run build
```

Packing prints the local archive path and writes `photo-assets.json`. It does
not upload, create a release, push Git, or deploy. The archive contains only
delivery images and their checksum receipt—not masters, capture timestamps,
source filenames, contact sheets, or the private import report. Packing again
may produce a new release tag; retain and publish the exact matching archive.

For an offline fresh checkout, install the archive without contacting GitHub:

```bash
bun scripts/photo-assets.ts install /absolute/path/to/cotswolds-photos.tar
bun run build
```

### Caching and limits

Content-hashed, recipe-versioned paths prevent stale image collisions. Keep the
lockfile pinned, and bump `PHOTO_RECIPE` before changing encoders or settings.
Pages controls HTTP cache headers; this project does **not** claim a configurable
one-year immutable cache policy there. An external CDN/object store can later
host the same generated files, without requiring on-demand image transforms.

[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
are 1 GB published size and a soft 100 GB/month bandwidth limit. This pipeline
rejects photo bundles over 750 MB to reserve space for the rest of the site.
All responsive sizes/formats count toward storage, but browsers download only
their selected candidates, with full-size images deferred until darkroom opens.
If measured traffic or future albums approach those budgets, move image delivery
off Pages. A separate dynamic image service is not a prerequisite for this album.

### Production verification

```bash
bun run test:photos
bun run build
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist
# In a second terminal:
bun run photos:smoke -- http://127.0.0.1:4174
```

The HTTP check verifies every responsive image's status, MIME type, checksum,
dimensions, metadata removal, and a real missing-image 404. Also inspect the
gallery and open/close a darkroom image at `http://127.0.0.1:4174/cotswolds/`.
Vite preview no longer attaches image middleware, so it cannot hide a missing
production service. It is still not a substitute for the plain-server check.

Verified locally on 2026-10-01: 48 photographs, 822 delivery images, 327.3 MB
of image bytes and 329.5 MB for the complete site. All 18 pipeline/import tests
and all 822 HTTP checks passed. A separate clean source copy, installed with a
frozen lockfile and no masters, failed before asset installation and built after
installing the pinned archive. Browser checks covered the production homepage
link, 2560px AVIF loading, navigation, image-click close, and focus restoration.

### Replacement audit

| Old path | Replacement / deletion |
| --- | --- |
| Query-string image request contract | One static filename contract in `photoUrl.ts` for every environment |
| 287-line runtime image server, dev and preview hooks | Deleted; no runtime encoder, request parser, transform queue, or filesystem handler |
| Environment-gated gallery and unavailable state | Deleted; build-time asset validation fails closed |
| Planned Worker/R2 handoff | Removed from this release; one existing Pages deployment boundary |

New offline tooling is separate from shipped runtime code: the 181-line asset
preparer/packager replaces the removed server, with 65 lines of delivery tests
and 39 lines of HTTP verification. No parallel legacy delivery path is retained.

## Image transition checks

Opening must move the visible photograph from its exact on-page bounds to its
fitted viewer bounds using one transform. A generic panel fade/scale is not a
substitute. The cached preview stays opaque under the decoded full-resolution
image, which fades in without changing the shared frame.

When changing the viewer, verify these in the browser:

1. Pause opening at its first frame: image bounds must equal the clicked image,
   including when the page is scrolled and the image is partly offscreen.
2. Inspect an intermediate frame: the image stays opaque and continuous.
3. Pause closing at its last frame: bounds must equal the destination thumbnail;
   also close during opening and check focus restoration without scrolling.
4. Delay and fail the full-resolution request: keep the preview visible. After
   decoding, both layers must share identical bounds throughout the reveal.
5. Repeat with portrait/landscape images, a phone viewport, and reduced motion.

Check the shared image frame in both the cream gallery and the darkroom using
bright sky and dark foliage. Matching CSS colors alone is not a visual check:
the light inner edge needs its faint outer shadow ring to remain visible on
cream. Keep the drop shadow subtle and the image/frame corners at the same 3px
radius.
Keep the frame on the shared wrapper, not on the preview/full-resolution layers,
so loading a sharper image cannot double or fade the border.

Click the opened image (both while loading and once sharp) and confirm it uses
the same close transition and focus restoration as Close/Escape. Previous and
Next, including clicks on their SVG icons, must navigate without closing.

Run this check on the **minified production build** too. Repeated image clicks
must immediately reverse the target without remounting the image. The dialog
closes only when the current CSS transition finishes, not after an estimated
timeout; reversal cancels that completion. With reduced motion it closes without
waiting. `scripts/photo-transition.test.ts` covers completion and cancellation.

Gallery typography uses bundled Karla Latin WOFF2 files at weights 400 and 500,
with its OFL license at `/licenses/karla.txt`; no runtime font CDN request is required.

## Release sequence — requires explicit upload/publish authorization

1. Review the public manifest and images; run `photos:pack` and the checks above.
2. After authorization, create a GitHub release with the tag in `photo-assets.json`
   and attach the exact printed `cotswolds-photos.tar`. Releases are visible to
   people with repository read access; for a public repo this publishes the photos.
3. Commit the matching code, lockfile, public manifest, and `photo-assets.json`.
   Do not add `public/photos/`, `.photo-build/`, or original photos to Git.
4. After authorization, push to `main`; the existing workflow verifies and deploys.
5. Run `photos:smoke` against `https://jogly.dev`, then verify darkroom in a browser.

The first remote release upload and actual GitHub Actions/Pages run remain
unverified until those actions are authorized. Local preparation is not publishing.
