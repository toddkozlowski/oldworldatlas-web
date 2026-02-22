/**
 * Wood Elf settlement data management for Old World Atlas
 */

class WoodElfSettlementDataManager {
    constructor() {
        this.rawFeatures = [];
        this.filteredFeatures = [];
        this.settlementMap = new Map(); // For quick lookup by name
    }

    /**
     * Load wood elf settlements from GeoJSON file
     * @param {string} dataPath - Path to GeoJSON file
     * @returns {Promise}
     */
    async loadWoodElfSettlements(dataPath) {
        try {
            const response = await fetch(dataPath);
            const data = await response.json();

            this.rawFeatures = data.features;
            this.filterAndIndexSettlements();
            return this.filteredFeatures;
        } catch (error) {
            console.error('Error loading wood elf settlements:', error);
            throw error;
        }
    }

    /**
     * Filter settlements based on criteria and build index
     * @private
     */
    filterAndIndexSettlements() {
        this.filteredFeatures = this.rawFeatures.filter(feature => {
            return this.meetsFilterCriteria(feature);
        });

        // Build lookup map
        this.settlementMap.clear();
        this.filteredFeatures.forEach(feature => {
            const name = feature.properties.name;
            if (name) {
                this.settlementMap.set(name, feature);
            }
        });
    }

    /**
     * Check if feature meets filter criteria
     * @private
     * @param {object} feature - GeoJSON feature
     * @returns {boolean}
     */
    meetsFilterCriteria(feature) {
        const coords = feature.geometry.coordinates;

        // Valid coordinates
        if (!isValidCoordinate(coords)) {
            return false;
        }

        // Within bounds
        const [lon, lat] = coords;
        if (!isWithinBounds(lon, lat)) {
            return false;
        }

        return true;
    }

    /**
     * Extract source tag from tags array
     * @private
     * @param {array} tags - Array of tags
     * @returns {string|null} - Source shorthand or null
     */
    getSourceFromTags(tags) {
        if (!tags || !Array.isArray(tags)) {
            return null;
        }
        for (const tag of tags) {
            if (tag.startsWith('source:')) {
                return tag.substring(7); // Remove 'source:' prefix
            }
        }
        return null;
    }

    /**
     * Convert raw feature to settlement object
     * @param {object} feature - GeoJSON feature
     * @returns {object}
     */
    featureToSettlement(feature) {
        const coords = feature.geometry.coordinates;
        return {
            name: feature.properties.name,
            settlementType: feature.properties.settlement_type || '',
            coordinates: coords,
            notes: feature.properties.notes || []
        };
    }

    /**
     * Get all filtered settlements as objects
     * @returns {array}
     */
    getAllSettlements() {
        return this.filteredFeatures.map(f => this.featureToSettlement(f));
    }

    /**
     * Get settlement by name
     * @param {string} name - Settlement name
     * @returns {object|null}
     */
    getSettlement(name) {
        const feature = this.settlementMap.get(name);
        return feature ? this.featureToSettlement(feature) : null;
    }

    /**
     * Get raw GeoJSON features for OpenLayers
     * @returns {array}
     */
    getOLFeatures() {
        return this.filteredFeatures.map(feature => {
            const coords = feature.geometry.coordinates;
            const sourceTag = this.getSourceFromTags(feature.properties.tags);
            const wiki = feature.properties.wiki || {};

            return new ol.Feature({
                geometry: new ol.geom.Point(coords),
                name: feature.properties.name,
                elfType: 'default',
                settlementType: feature.properties.settlement_type || '',
                sourceTag: sourceTag,
                wikiTitle: wiki.title,
                wikiUrl: wiki.url,
                wikiDescription: wiki.description,
                wikiImage: wiki.image,
                featureType: 'woodelf'
            });
        });
    }
}

// Create global instance
const woodElfSettlementData = new WoodElfSettlementDataManager();
