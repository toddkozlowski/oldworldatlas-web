/**
 * City-scale map overlays for Old World Atlas.
 *
 * Displays a city's high-resolution basemap image at its correct spot on the
 * continent map, plus its individual location markers where available, once
 * the user is zoomed in close enough to be looking at that part of the map.
 * Also relaxes
 * the view's normal minResolution (max zoom-in) while the overlay is
 * visible, since the city image has real detail beyond what the continent
 * tile pyramid provides.
 */

// Show a city overlay once the view resolution reaches this value or finer.
// Expressed in the same raw-resolution units used throughout styles-config.json.
const CITY_OVERLAY_VISIBLE_RESOLUTION = 0.05;

// Per-city configuration. `geojson`/`pageUrl` are optional — only cities with
// a per-location source SVG (see oldworldatlas-tools/cities/process_city_svg.py)
// have individual location markers and a standalone page; others are just the
// basemap image placed at `extent`.
//
// For bogenhafen, `extent`/`nativeResolution` are derived from each location's
// local SVG-export coordinates and its paired geo_lon/geo_lat (both present
// per-point in the source geojson): fitting an affine transform between the
// two (R^2 = 1, i.e. an exact fit, since that's how geo_lon/geo_lat were
// generated in the first place) and extrapolating it to the basemap image's
// full canvas gives the image's real-world footprint.
//
// For ubersreik (no source SVG, just a flat image), `extent` is instead built
// directly from the settlement's atlas coordinate (data/settlements_empire.geojson)
// as the center, plus a real-world width of 1.44 miles (the taller dimension
// derived from that width and the image's own pixel aspect ratio, 3308x2540,
// rather than trusting the given 1.10mi height as well — using both independently
// risks the same horizontal-stretch bug bogenhafen had), converted to degrees
// via the same flat MILES_PER_DEGREE=69.172 the world atlas itself uses (see
// process_city_svg.py) — no cos(latitude) correction.
const CITY_OVERLAYS_CONFIG = [
    {
        id: 'bogenhafen',
        name: 'Bögenhafen',
        image: 'cities/bogenhafen/bogenhafen.png',
        geojson: 'cities/bogenhafen/locations.geojson',
        pageUrl: 'cities/bogenhafen/',
        extent: [-1.4375972912682973, 50.2979516354095, -1.429356962811701, 50.305606408750506],
        // Finer of the image's two axis resolutions (degrees per source pixel),
        // used as the zoom-in floor so the overlay is never magnified past
        // its native detail.
        nativeResolution: 0.0000011959838108267298,
    },
    {
        id: 'ubersreik',
        name: 'Übersreik',
        image: 'cities/ubersreik/ubersreik.webp',
        extent: [-0.3372440490651792, 49.24673860220528, -0.316426377174819, 49.26272315075471],
        nativeResolution: 0.000006293129350169365,
    },
];

const CITY_MARKER_ICON = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26c0-8.837-7.163-16-16-16z"
        fill="#b5432c" stroke="#3a1f10" stroke-width="1.5"/>
  <circle cx="16" cy="16" r="6.5" fill="#f0e6d2" stroke="#3a1f10" stroke-width="1"/>
</svg>
`.trim());

const CITY_MARKER_STYLE = new ol.style.Style({
    image: new ol.style.Icon({
        src: CITY_MARKER_ICON,
        anchor: [0.5, 1],
        scale: 0.5,
    }),
});

class CityOverlayManager {
    constructor() {
        this.cities = []; // { config, rasterLayer, markerLayer }
        this.anyVisible = false;
    }

    /**
     * Build raster + marker layers for each configured city, load their
     * marker geojson, and add everything to the map (initially hidden). The
     * (large) basemap image itself is only actually fetched by OL once its
     * layer becomes visible and in view.
     * @param {ol.Map} map
     * @param {array} configs
     */
    async load(map, configs = CITY_OVERLAYS_CONFIG) {
        for (const config of configs) {
            const markerSource = new ol.source.Vector();

            const rasterLayer = new ol.layer.Image({
                source: new ol.source.ImageStatic({
                    url: config.image,
                    imageExtent: config.extent,
                }),
                extent: config.extent,
                visible: false,
            });

            const markerLayer = new ol.layer.Vector({
                source: markerSource,
                extent: config.extent,
                visible: false,
                style: CITY_MARKER_STYLE,
            });

            map.addLayer(rasterLayer);
            map.addLayer(markerLayer);
            this.cities.push({ config, rasterLayer, markerLayer });

            if (!config.geojson) {
                continue; // No per-location source data for this city - basemap image only.
            }

            try {
                const response = await fetch(config.geojson);
                const geojson = await response.json();
                const features = geojson.features
                    .filter((f) => isValidCoordinate([f.properties.geo_lon, f.properties.geo_lat]))
                    .map((f) => new ol.Feature({
                        geometry: new ol.geom.Point([f.properties.geo_lon, f.properties.geo_lat]),
                        name: f.properties.name,
                        featureType: 'city-location',
                        cityName: config.name,
                        cityPageUrl: config.pageUrl,
                    }));
                markerSource.addFeatures(features);
            } catch (error) {
                console.error(`Failed to load city locations for ${config.id}:`, error);
            }
        }
    }

    /**
     * Re-evaluate overlay visibility and the view's zoom-in floor for the
     * current view state. Call after pan/zoom interactions settle.
     * @param {ol.Map} map
     */
    update(map) {
        const view = map.getView();
        const resolution = view.getResolution();
        const viewportExtent = view.calculateExtent(map.getSize());

        let finestNativeResolution = null;

        for (const city of this.cities) {
            const visible = resolution <= CITY_OVERLAY_VISIBLE_RESOLUTION &&
                ol.extent.intersects(viewportExtent, city.config.extent);
            city.rasterLayer.setVisible(visible);
            city.markerLayer.setVisible(visible);
            if (visible && (finestNativeResolution === null || city.config.nativeResolution < finestNativeResolution)) {
                finestNativeResolution = city.config.nativeResolution;
            }
        }

        this.anyVisible = finestNativeResolution !== null;
        mapManager.setMinResolutionOverride(finestNativeResolution);
    }
}

const cityOverlayManager = new CityOverlayManager();
