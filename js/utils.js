/**
 * Utility functions for the Old World Atlas
 */

// Shared base map configuration for the current tile set.
// Tiles are 256 px, numbered TMS-style from the bottom-left origin. The resolution at
// zoom z is (tile span / 256) / 2^z, and a resolutions list's index must equal the tile
// folder z, because the tile URL uses tileCoord[0] as z.
const IMAGE_BOUNDS = [-65, 0, 25, 90];
const MAP_TILE_DIRECTORY = 'map_tiles';
const MAP_TILE_VERSION = '13';
const MAP_TILE_SIZE = 256;
const MAP_TILE_BASE_MAX_ZOOM = 6;    // z1-6 cover the whole extent
const MAP_TILE_DETAIL_MAX_ZOOM = 8;  // z7-8 only exist inside MAP_TILE_DETAIL_EXTENT
const MAP_TILE_DETAIL_EXTENT = [-25.625, 29.53125, 15.15625, 70.3125];
const MAP_VIEW_MIN_ZOOM = 2;         // furthest zoom-out (z1 is the coarsest rendered level)
const MAP_VIEW_MAX_ZOOM = 10;        // deepest zoom; past z8 the z8 tiles are enlarged
const MAP_VIEW_DEFAULT_CENTER = [0, 50];
const MAP_VIEW_BUFFER_FACTOR = 0.25;

// Rat-mode tiles were rendered on the previous tile grid and only cover its area.
const RAT_MODE_TILE_DIRECTORY = 'ratmode_tiles';
const RAT_MODE_TILE_BOUNDS = [-25, 25, 25, 75];
const RAT_MODE_TILE_MAX_ZOOM = 6;

function getImageExtent() {
    return [...IMAGE_BOUNDS];
}

function getBufferedImageBounds(bufferFactor = MAP_VIEW_BUFFER_FACTOR) {
    const width = IMAGE_BOUNDS[2] - IMAGE_BOUNDS[0];
    const height = IMAGE_BOUNDS[3] - IMAGE_BOUNDS[1];
    const horizontalBuffer = width * bufferFactor;
    const verticalBuffer = height * bufferFactor;

    return [
        IMAGE_BOUNDS[0] - horizontalBuffer,
        IMAGE_BOUNDS[1] - verticalBuffer,
        IMAGE_BOUNDS[2] + horizontalBuffer,
        IMAGE_BOUNDS[3] + verticalBuffer
    ];
}

/**
 * Map units per pixel at tile zoom level z
 * @param {number} z - Tile zoom level
 * @returns {number}
 */
function getTileResolution(z) {
    const span = Math.max(IMAGE_BOUNDS[2] - IMAGE_BOUNDS[0], IMAGE_BOUNDS[3] - IMAGE_BOUNDS[1]);
    return span / (MAP_TILE_SIZE * 2 ** z);
}

/**
 * Tile grid resolutions for z0..maxZoom (index == z)
 * @param {number} maxZoom - Deepest tile zoom level
 * @returns {number[]}
 */
function getTileResolutions(maxZoom = MAP_TILE_DETAIL_MAX_ZOOM) {
    return Array.from({ length: maxZoom + 1 }, (_, z) => getTileResolution(z));
}

/**
 * Tile grid resolutions for the rat-mode tiles, which use the previous grid
 * (50 map units at 250 px, with its 0.97655 scale correction)
 * @returns {number[]}
 */
function getRatModeTileResolutions() {
    const baseResolution = ((RAT_MODE_TILE_BOUNDS[2] - RAT_MODE_TILE_BOUNDS[0]) / 250) * 0.97655;
    return Array.from({ length: RAT_MODE_TILE_MAX_ZOOM + 1 }, (_, z) => baseResolution / (2 ** z));
}

/**
 * Check if a coordinate is within the image bounds
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @returns {boolean}
 */
function isWithinBounds(lon, lat) {
    return lon >= IMAGE_BOUNDS[0] && lon <= IMAGE_BOUNDS[2] &&
           lat >= IMAGE_BOUNDS[1] && lat <= IMAGE_BOUNDS[3];
}

/**
 * Validate coordinate pair
 * @param {array} coords - [lon, lat]
 * @returns {boolean}
 */
function isValidCoordinate(coords) {
    return coords && coords.length === 2 && 
           typeof coords[0] === 'number' && 
           typeof coords[1] === 'number' &&
           !isNaN(coords[0]) && 
           !isNaN(coords[1]);
}

/**
 * Validate a GeoJSON point feature's coordinates and check it lies within the map image
 * @param {object} feature - GeoJSON feature
 * @returns {boolean}
 */
function isFeatureOnMap(feature) {
    const coords = feature?.geometry?.coordinates;
    return isValidCoordinate(coords) && isWithinBounds(coords[0], coords[1]);
}

/**
 * Whether a feature's `source` counts as published canon: any non-empty source
 * that doesn't mention "unofficial" (e.g. "Andy Law (unofficial)")
 * @param {string|null} source - Source title from the GeoJSON `source` property
 * @returns {boolean}
 */
function isCanonSource(source) {
    return typeof source === 'string' && source.trim() !== '' && !/unofficial/i.test(source);
}

/**
 * Search settlements by name (case-insensitive)
 * @param {array} settlements - Array of settlement objects
 * @param {string} query - Search query
 * @returns {array}
 */
function searchSettlements(settlements, query) {
    if (!query || query.trim() === '') {
        return settlements;
    }
    const lowerQuery = query.toLowerCase();
    return settlements.filter(settlement => 
        settlement.name && settlement.name.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Get settlement by name
 * @param {array} settlements - Array of settlement objects
 * @param {string} name - Settlement name
 * @returns {object|null}
 */
function getSettlementByName(settlements, name) {
    return settlements.find(s => s.name === name) || null;
}

/**
 * Sort settlements by size category (descending)
 * @param {array} settlements - Array of settlement objects
 * @returns {array}
 */
function sortBySize(settlements) {
    return [...settlements].sort((a, b) => b.sizeCategory - a.sizeCategory);
}

/**
 * Group settlements by province
 * @param {array} settlements - Array of settlement objects
 * @returns {object}
 */
function groupByProvince(settlements) {
    return settlements.reduce((acc, settlement) => {
        const province = settlement.province || 'Unknown';
        if (!acc[province]) {
            acc[province] = [];
        }
        acc[province].push(settlement);
        return acc;
    }, {});
}

/**
 * Get size category label
 * @param {number} sizeCategory
 * @returns {string}
 */
function getSizeCategoryLabel(sizeCategory) {
    const labels = {
        1: 'Village',
        2: 'Small Town',
        3: 'Town',
        4: 'Large Town',
        5: 'City',
        6: 'Major City'
    };
    return labels[sizeCategory] || 'Unknown';
}
