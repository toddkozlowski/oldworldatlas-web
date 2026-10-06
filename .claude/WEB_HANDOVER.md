# Handover: map data v2 → oldworldatlas-web

For the agent maintaining `oldworldatlas-web`. The map-data pipeline in `oldworldatlas-tools` was rebuilt (`scripts/map_workflow_v2.py`). It now produces **schema v2** GeoJSON and a **new tile grid**. The website still reads v1 and needs the changes below before the v2 data or tiles are pushed live.

- Full field reference: `oldworldatlas-tools/output/v2/GEOJSON_SCHEMA.md`.
- Sample v2 files to develop against: `oldworldatlas-tools/output/v2/*.geojson` and `manifest.json`.
- `oldworldatlas-web/data/` still holds the v1 files until the owner runs the pipeline's `deploy` step.

## 1. How data and tiles now arrive

- **GeoJSON:** the `deploy` step copies every `output/v2/*.geojson` plus `manifest.json` into `oldworldatlas-web/data/`.
  - Files already in `data/` are first moved into `data/backup/<YYYY-MM-DDTHH-MM-SS>/`, one folder per deploy.
  - Only the newest 3 such folders are kept.
  - **Every v1 file is moved out of `data/`, including ones with no v2 counterpart** (`province_labels.geojson`, `geographic_feature_labels.geojson`).
- **`manifest.json`** lists every file with its feature count, plus `schema_version: 2` and the generation time. It can be used to discover the files instead of hard-coding the list.
- **Tiles:** the `tiles` step can replace `oldworldatlas-repository/map_tiles/` locally.
  - The site loads tiles from `raw.githubusercontent.com/toddkozlowski/oldworldatlas-repository/main/...` (`js/map-manager.js` `createTileLayer`). New tiles only go live after that repository is committed and pushed to GitHub.
  - Bump `MAP_TILE_VERSION` in `js/utils.js` when they go live, so browsers don't keep showing cached old tiles.
- **Coordinates are unchanged:** `[lon, lat]` in the same units as v1, rounded to 6 decimals.
- **New `id` on every feature:** the SVG element id, also set as the GeoJSON Feature `id`. It stays the same between runs, so it is safe to use as a key.

## 2. File changes

| v1 file (`data/`) | v2 file | Notes |
|---|---|---|
| `settlements_<key>.geojson` | same names | Adds `settlements_nehekhara.geojson` (new dataset). |
| `points_of_interest.geojson` | same name | Different type names and new fields (see section 4). |
| `province_labels.geojson` | `region_labels.geojson` | Tribes are no longer in this file. |
| (tribes were in `province_labels`) | `tribes.geojson` | Greenskin, Northmen and **Araby** (new) tribes. |
| `geographic_feature_labels.geojson` | `geographic_features.geojson` | Type names changed. |
| none | `manifest.json` | See above. |

`js/app.js` (lines ~20–94) hard-codes the v1 names. Add `settlements_nehekhara`, rename the label files, and load `tribes.geojson`.

## 3. Settlements: required changes

The property names below are v2. Every settlement feature has: `id, name, category:"settlement", dataset, in_gazetteer, type, region, province, estate, population, population_estimated, size_category, trade, source, tags[], notes[], history{province_2512, province_2276, ruler_2515, ruler_2512, ruler_2276}, wiki{title,url,description,image}, svg_layer`.

1. **The source filter will hide everything; this must be fixed first.**
   - `settlement-data.js` (`getSourceFromTags`, ~line 157 and 238) keeps a settlement only if its `tags` contain `source:<abbr>`. **v2 tags never contain `source:` entries.** The source is now the `source` field, holding the full title from the sheet.
   - Rewrite the filter to use `properties.source`:
     - hide when `source` is null;
     - hide when the source is unofficial. The two current values are `Andy Law (unofficial)` and `Alfred "MadAlfred" Nuñez Jr. (unofficial)`, so matching the text `(unofficial)` covers both and any future ones.
   - Popups that show `sourceTag` should show `source` instead (`ui-controls.js` ~761, 813, 982).
2. **`province` vs `region`.**
   - v1 put the nation in `province` when there was no province (e.g. `"Kislev"`).
   - In v2, `region` is always the nation/realm (`Empire`, `Bretonnia`, `Karaz Ankor`, `Skavendom`, …), and `province` is `null` unless there really is one.
   - v1 had no `region_group` property: the code fell back to `getRegionFromProvince(province)` (`settlement-data.js` ~98, 173, 377), which breaks on `null`. Use `properties.region`.
3. **Type field unified as `type`.**
   - Dwarf `hold_type` → `type` (`dwarf-settlement-data.js` ~129; `dwarfHoldType` in search and popups). Values are unchanged (`Karak (Great Hold)`, `Grung (Mining Settlement)`, …). Empty types are now filled from the name, defaulting to `Khazid (Town)`.
   - Wood Elf `settlement_type` → `type` (`wood-elf-settlement-data.js` ~100, 138). Valid values: `Hall, Glade, Temple, POI, Ruins` (`Ruins` is new).
   - Skavendom `settlement_type` → `type` (`app.js` ~91). Values: `City, Nest, Warren`.
   - Nehekhara (new) `type`: `Tomb City | Pyramid`.
4. **Skaven clans removed.** `major_clans` and `minor_clans` no longer exist; the sheet dropped those columns. Remove them from `app.js` (~93) and the popup in `ui-controls.js` (~722).
5. **`trade` is its own field.** It is no longer in `tags` as `trade:<x>`.
6. **Estimated populations.** `population_estimated: true` marks generated populations (about 86% of settlements). These now range from about 55 to 800, median 150, and stay the same between runs. Optionally show them as approximate.
7. **SVG-only settlements are included**, with `in_gazetteer: false` and `source: null`. The source filter in item 1 will hide them unless that behaviour is wanted.
8. **Available but unused new fields:** `estate`, `history`, `svg_layer`.

## 4. Points of interest

Fields: `id, name, category:"poi", dataset, in_gazetteer, type, svg_type, region, province, source, notes[], names{de,fr,pl}, wiki{…}`.

- **`type` uses the canonical singular names:** `Ancient Monoliths, Chaos Shrine, Chaos Fortress, Coaching Inn, Fortification, Mine, Religious Site, Ruins, Waterfall, Mountain Peak, Other Geographic Landmark, Other, High Elf Colony, Greenskin Landmark, Gnome Burrow, City District`.
- **Rename the stale `poi` keys in `styles-config.json`:** `Peaks` → `Mountain Peak`, `Forts and Castles` → `Fortification`, `Chaos Shrines` → `Chaos Shrine`. Add `Chaos Fortress` and any other types that need their own style.
- **Removed:** `description` and `tags` are gone. Use `notes` and `source`.
- **New:**
  - `region`: the regional sheet the POI came from (`Empire`, `Bretonnia`, `Kislev`, `Norsca`, `Westerland`, `Tilea`, `Estalia`, `Chaos Wastes`);
  - `province`;
  - `names`: DE/FR/PL translations.
  - All three are `null` for POIs that exist only on the map.

## 5. Region labels (`region_labels.geojson`)

Fields: `id, name, label, category:"region", in_gazetteer, type, local_category, formal_title, part_of, population, svg_layer, wiki{…}`.

- **`province_type` → `type`.** Values: `Nation | Major Division | Minor Division`.
  - `province-data.js` (~26) reads `province_type`.
  - It also reads `properties.info`, but v1 already sent `wiki` and v2 still does. Read `properties.wiki` (`url`, `description`, `title`, `image`); this also fixes the wiki links on province labels, which are currently missing.
- **Style by `svg_layer` or `local_category`.**
  - `svg_layer` is one of `Nation-States | Grand-Provinces | Provinces | Sub-Provinces`.
  - `local_category` is the sheet value (`Province`, `Grand-Province`, `Nation-State`, `City-State`, `Bretonnian Duchy`, `High Realm`, …), or the value derived from the layer when there is no sheet row.
  - The `styles-config.json` `provinces` keys (`Nation-State`, `Grand-Province`, `Province`) correspond to `svg_layer` minus the plural.
- **New `Sub-Provinces` layer:** currently the four Wards of Laurelorn. Their `type` is `Minor Division` and their `local_category` is `High Realm`, so only `svg_layer` sets them apart. They need a style (e.g. smaller than `Province`).
- **`name` vs `label`:** `name` is the sheet name (e.g. `Ward Of The Sun`), and `label` is the text as drawn on the map, often upper case.

## 6. Tribes (`tribes.geojson`, new file)

Fields: `id, name, category:"tribe", dataset, in_gazetteer, type, group, size, source`.

- `group` is `Greenskins`, `Northmen` or **`Araby`** (new). `size` is `Major` or `Minor`.
- `type` is e.g. `Orcs`, `Night Goblins`, `Savage Orcs`, `Kurgan`, `Hung`, `Norscan`.
- Replace the v1 string matching on `province_type` values such as `'Major Greenskin Tribe'`:
  - `province-data.js` ~33–34;
  - `styling.js` ~974;
  - `search.js` ~141, 149;
  - layer titles in `map-manager.js` ~496, 506.
- Derive the feature type from `group` and `size`, and add a layer, style and search label for Araby tribes. The Araby sheet is still empty, so all Araby tribe features currently have `in_gazetteer: false`.

## 7. Geographic features (`geographic_features.geojson`)

Fields: `id, name, category:"geographic_feature", in_gazetteer, type, svg_type, source, tags[], names{de,fr,pl}, wiki{…}`.

- **`type` values changed.** Rename the `water` keys in `styles-config.json`:
  - `Forest Labels` → `Forest`
  - `Hills` → `Major Hills`
  - `Mountain Ranges` → `Mountain Range`
  - `Mountain Passes` → `Mountain Pass`
  - `Lowlands` → `Lowland`
  - `Minor Lowlands` → `Minor Lowland`
  - Unchanged: `Lake, Small Marsh, Large Marsh, Small Sea, Medium Sea, Large Sea, Major Sea, Ocean, Minor Hills`.
- The `.replace(/ Labels$/, '')` workarounds in `search.js` ~132 and `ui-controls.js` ~893 are no longer needed.
- `water-data.js` (~26) maps `properties.type` to `waterbodyType`. That still works once the style keys are renamed.
- **Repeated labels:** a feature labelled more than once on the map (big forests, mountain ranges, oceans, major seas, hills, lowlands) produces **one feature per label position, all with the same name**. Search should de-duplicate by name, or by name and type.
- River labels are still not included.

## 8. Tiles: new grid (applies once the owner renders and pushes v2 tiles)

The current site grid (`js/utils.js`) is `IMAGE_BOUNDS = [-25, 25, 25, 75]`, with resolutions `= 50/250 × 0.97655 / 2^z` over 10 levels. The v2 tile set uses:

- **Grid extent and origin:** `[-65, 0, 25, 90]` (lon/lat), origin at the bottom-left corner `[-65, 0]`. Tiles are 256 px, numbered TMS-style (y = 0 at the south).
- **Resolution:** at zoom `z`, `90 / (256 × 2^z)` degrees per pixel. **The position in the resolutions list must equal the tile folder number `z`**, because the URL uses `tileCoord[0]` as `z`.
  - z0 is not rendered; the first level is z1. Keep the view's maximum resolution at or below the z1 value, 0.17578125.
  - The `MAP_TILE_SCALE_ADJUSTMENT` correction factor doesn't apply to this grid.
- **Zoom coverage:**
  - z1–6 cover the whole extent;
  - z7–8 exist **only** inside the detail box `[-25.625, 29.53125, 15.15625, 70.3125]` (lon -25 to 15, lat 30 to 70, rounded out to tile edges).
- **Two tile layers are needed.** OpenLayers won't fall back to lower-zoom tiles where z7–8 tiles are missing:
  - a **base** layer whose resolutions stop at z6, which OpenLayers then enlarges when zoomed further in;
  - a **detail** layer with resolutions z0–z8, `extent` set to the detail box and `maxResolution` = the z6 resolution (0.0054931641), drawn on top.
  - The pipeline prints a ready-made OpenLayers snippet for this when the `tiles` step runs: `python scripts/map_workflow_v2.py --steps tiles --dry-run`.
  - The tile URL pattern stays `<base>/map_tiles/{z}/{x}/{-1 - y}.png`.
- **Rat mode:** `ratmode_tiles` were rendered on the old grid. Once `map_tiles` switches grids, `setRatMode` (`map-manager.js`) would draw rat-mode tiles misaligned. Either give rat mode its own TileGrid using the old parameters, or re-render it on the new grid.
- **Other grid-dependent code:** view settings derived from `IMAGE_BOUNDS` (centre, buffered pan limits, min/max resolution, `MAP_TILE_ZOOM_LEVELS`) need updating for the larger extent. So do `isValidCoordinate` checks against those bounds and the grid overlay (`js/grid-overlay.js`).

## 9. Suggested order and checks

1. Point the loaders at a copy of `oldworldatlas-tools/output/v2/` first, rather than replacing the live `data/` folder.
2. Fix the source filter (section 3, item 1) first. Then work through the file names, field names and style keys (sections 2–7), checking that each layer renders, search returns results, and popups show source and wiki.
3. Confirm the feature counts against `manifest.json` (currently about 8,260 settlements, 1,210 POIs, 129 region labels, 196 tribes and 573 geographic features).
4. Make the tile changes (section 8) together with the first push of v2 tiles, including the `MAP_TILE_VERSION` bump and the rat-mode decision.
5. Then the owner runs `deploy` (data) and pushes the tile repository.
