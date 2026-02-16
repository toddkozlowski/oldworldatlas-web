/**
 * Utility functions for the Old World Atlas
 */

// Image bounds for the full Old World map (from map-manager.js tile extent)
const IMAGE_BOUNDS = [-19.045, 31.949, 18.457, 69.451];

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
