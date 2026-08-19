/**
 * Generic city map viewer.
 *
 * Renders a high-resolution city basemap image with location markers loaded
 * from a geojson file. Marker coordinates in the geojson are in the same
 * local unit space as the source SVG the basemap was exported from
 * (config.svgWidth x config.svgHeight), already y-up (increasing toward
 * north, confirmed against each point's geo_lat) to match OpenLayers'
 * pixel projection (origin bottom-left, y increasing upward) — so only
 * the uniform scale to pixel units is needed, no vertical flip.
 */
function initCityMap(config) {
    const extent = [0, 0, config.imageWidth, config.imageHeight];

    const projection = new ol.proj.Projection({
        code: 'city-pixels',
        units: 'pixels',
        extent: extent,
    });

    const scaleX = config.imageWidth / config.svgWidth;
    const scaleY = config.imageHeight / config.svgHeight;

    function toMapCoord([svgX, svgY]) {
        return [svgX * scaleX, svgY * scaleY];
    }

    const basemapLayer = new ol.layer.Image({
        source: new ol.source.ImageStatic({
            url: config.image,
            projection: projection,
            imageExtent: extent,
        }),
    });

    const markerStyle = new ol.style.Style({
        image: new ol.style.Icon({
            src: MARKER_ICON_DATA_URI,
            anchor: [0.5, 1],
            scale: 1,
        }),
    });

    const markerSource = new ol.source.Vector();

    const map = new ol.Map({
        target: 'map',
        layers: [basemapLayer],
        view: new ol.View({
            projection: projection,
            center: ol.extent.getCenter(extent),
            zoom: 2,
            minZoom: 1,
            maxZoom: 8,
            extent: extent,
        }),
    });

    const markerLayer = new ol.layer.Vector({
        source: markerSource,
        style: markerStyle,
    });
    map.addLayer(markerLayer);

    fetch(config.geojson)
        .then((res) => res.json())
        .then((geojson) => {
            const features = geojson.features.map((f) => {
                const coord = toMapCoord(f.geometry.coordinates);
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(coord),
                    name: f.properties.name,
                });
                return feature;
            });
            markerSource.addFeatures(features);
        })
        .catch((err) => {
            console.error('Failed to load city locations:', err);
        });

    const popupEl = document.createElement('div');
    popupEl.className = 'city-popup';
    popupEl.style.display = 'none';
    document.body.appendChild(popupEl);

    const popupOverlay = new ol.Overlay({
        element: popupEl,
        positioning: 'bottom-center',
        stopEvent: false,
    });
    map.addOverlay(popupOverlay);

    map.on('click', (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
        if (feature) {
            popupEl.textContent = feature.get('name');
            popupEl.style.display = 'block';
            popupOverlay.setPosition(evt.coordinate);
        } else {
            popupEl.style.display = 'none';
        }
    });

    map.on('pointermove', (evt) => {
        const hit = map.hasFeatureAtPixel(evt.pixel);
        map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    return map;
}

// Generic map pin, rendered as an inline SVG data URI so no extra image
// asset is needed. Amber/parchment fill to match the atlas' aesthetic.
const MARKER_ICON_DATA_URI =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26c0-8.837-7.163-16-16-16z"
        fill="#b5432c" stroke="#3a1f10" stroke-width="1.5"/>
  <circle cx="16" cy="16" r="6.5" fill="#f0e6d2" stroke="#3a1f10" stroke-width="1"/>
</svg>
`.trim());
