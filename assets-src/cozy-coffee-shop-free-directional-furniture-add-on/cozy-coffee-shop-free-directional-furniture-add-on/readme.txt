Cozy Coffee Shop — Free Directional Furniture Add-On
Version 1.1 | Companion/demo for Cozy Coffee Shop — Top-Down Pixel Art Café 90+ Asset Pack

CONTENTS
32 individual furniture sprites, 4 transparent directional sheets,
4 full-resolution family previews, 1 overview, JSON metadata and QA records.
Wooden chair: 8 directions (NW newly generated for v1.1).
Terracotta armchair: 8 directions.
Cream loveseat: 8 directions.
Booth bench: 8 directions.

QUICK START
Use PNGs in sprites/ for individual objects. Each is tightly trimmed with
2 transparent pixels on every side. Do not import previews/ as game sprites.
For fixed-grid import, sheets/ contains one 1536 x 768 RGBA sheet per family.
Slice each into 384 x 384 cells, four columns and two rows, with no spacing:
first row N, NE, E, SE; second row S, SW, W, NW.
All eight cells are populated in every furniture sheet.
All cells use a bottom-center alignment: pivot (192, 380) measured from the
cell's upper-left corner. Individual pivot proposals are in the manifest.
These are visual placement anchors, not measured collision footprints.

DIRECTIONS
Names describe where a seated person faces, in screen coordinates:
N = up/away, NE = up-right, E = right, SE = down-right,
S = down/toward viewer, SW = down-left, W = left, NW = up-left.
Back panels and exposed seats were checked visually; some original sheet
labels were incorrect and have been remapped. See QA_NOTES.txt.

PIXEL HANDLING / SCALE
The original 31 production sprites are unchanged from v1.0.
The missing NW chair was generated with built-in imagegen at user request,
cleaned, and reduced with nearest-neighbor to match the existing chair height.
No smoothing, palette reduction or changes to the other sprites were applied.
Alpha is binary (0/255); invisible RGB is zero. Internal visible RGB is kept.
Use nearest/point filtering, disable lossy texture compression and mipmaps
for pixel-perfect 2D display. Scale using nearest-neighbor if required.
The source sheets are large rendered pixel-art images, not verified native
32 x 32 tiles. Canvas standardization does not establish world size.
Match scene scale to your project. Main-pack tile size, palette and placement
compatibility were not verified against these four attachments.
The overview uses half-size nearest-neighbor previews only.

FOLDERS
sprites/  — individual production RGBA PNGs, grouped by furniture family
sheets/   — clean fixed-grid production RGBA PNGs, without labels/backgrounds
previews/ — presentation PNGs with labels and checkerboard backgrounds
metadata/ — source mapping, sprite bounds, sheet frames, pivots and QA CSV

Original sheets and rejected variants are not included.
See QA_NOTES.txt for exclusions and retained source limitations.
No license terms were supplied; this packaging does not establish a license.
