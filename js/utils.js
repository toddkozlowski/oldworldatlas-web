/**
 * Utility functions for the Old World Atlas
 */

// Shared base map configuration for the current tile set.
const IMAGE_BOUNDS = [-25, 32, 25, 69.5];
const MAP_TILE_DIRECTORY = 'map_tiles';
const MAP_TILE_VERSION = '12';
const MAP_VIEW_BUFFER_FACTOR = 0.5;
const MAP_TILE_SCALE_ADJUSTMENT = 0.97655;
const MAP_TILE_BASE_PIXELS = 250;
const MAP_TILE_ZOOM_LEVELS = 10;

function getImageExtent() {
    return [...IMAGE_BOUNDS];
}

function getImageCenter() {
    return [
        (IMAGE_BOUNDS[0] + IMAGE_BOUNDS[2]) / 2,
        (IMAGE_BOUNDS[1] + IMAGE_BOUNDS[3]) / 2
    ];
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

function getTileResolutions(levelCount = MAP_TILE_ZOOM_LEVELS) {
    const width = IMAGE_BOUNDS[2] - IMAGE_BOUNDS[0];
    const height = IMAGE_BOUNDS[3] - IMAGE_BOUNDS[1];
    const baseSpan = Math.max(width, height);
    const baseResolution = (baseSpan / MAP_TILE_BASE_PIXELS) * MAP_TILE_SCALE_ADJUSTMENT;

    return Array.from({ length: levelCount }, (_, index) => baseResolution / (2 ** index));
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
