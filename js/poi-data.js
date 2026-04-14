/**
 * Points of Interest data management for Old World Atlas
 */

class POIDataManager {
    constructor() {
        this.rawFeatures = [];
        this.filteredFeatures = [];
        this.poiMap = new Map(); // For quick lookup by name
        this.enabledTypes = new Set();
    }

    /**
     * Load POIs from GeoJSON file
     * @param {string} dataPath - Path to GeoJSON file
     * @returns {Promise}
     */
    async loadPOIs(dataPath) {
        try {
            const response = await fetch(dataPath);
            const data = await response.json();
            this.rawFeatures = data.features;
            this.enabledTypes = new Set(this.getAvailableTypes());
            this.filterAndIndexPOIs();
            return this.filteredFeatures;
        } catch (error) {
            console.error('Error loading POIs:', error);
            throw error;
        }
    }

    /**
     * Filter POIs and rebuild lookup index.
     * @private
     */
    filterAndIndexPOIs() {
        this.filteredFeatures = this.rawFeatures.filter(feature => this.meetsFilterCriteria(feature));
        this.indexPOIs();
    }

    /**
     * Check whether a POI meets current filter criteria.
     * @private
     * @param {object} feature - GeoJSON feature
     * @returns {boolean}
     */
    meetsFilterCriteria(feature) {
        const coords = feature.geometry?.coordinates;
        if (!isValidCoordinate(coords)) {
            return false;
        }

        const [lon, lat] = coords;
        if (!isWithinBounds(lon, lat)) {
            return false;
        }

        const type = feature.properties?.type || 'Unknown';
        return this.enabledTypes.has(type);
    }

    /**
     * Build index of POIs
     * @private
     */
    indexPOIs() {
        this.poiMap.clear();
        this.filteredFeatures.forEach(feature => {
            const name = feature.properties.name;
            if (name) {
                this.poiMap.set(name, feature);
            }
        });
    }

    /**
     * Convert raw feature to POI object
     * @param {object} feature - GeoJSON feature
     * @returns {object}
     */
    featureToPOI(feature) {
        const coords = feature.geometry.coordinates;
        return {
            name: feature.properties.name,
            type: feature.properties.type || 'Unknown',
            coordinates: coords
        };
    }

    /**
     * Get all POIs as objects
     * @returns {array}
     */
    getAllPOIs() {
        return this.filteredFeatures.map(f => this.featureToPOI(f));
    }

    /**
     * Get sorted unique POI types from raw data.
     * @returns {string[]}
     */
    getAvailableTypes() {
        return Array.from(
            new Set(this.rawFeatures.map(feature => feature.properties?.type).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));
    }

    /**
     * Set enabled POI types.
     * @param {string[]} types
     */
    setEnabledTypes(types) {
        this.enabledTypes = new Set((types || []).filter(Boolean));
        this.filterAndIndexPOIs();
    }

    /**
     * Get POI by name
     * @param {string} name - POI name
     * @returns {object|null}
     */
    getPOI(name) {
        const feature = this.poiMap.get(name);
        return feature ? this.featureToPOI(feature) : null;
    }

    /**
     * Get POIs by type
     * @param {string} type - POI type
     * @returns {array}
     */
    getByType(type) {
        return this.getAllPOIs().filter(poi => poi.type === type);
    }

    /**
     * Get raw GeoJSON features for OpenLayers
     * @returns {array}
     */
    getOLFeatures() {
        return this.filteredFeatures.map(feature => {
            const coords = feature.geometry.coordinates;
            return new ol.Feature({
                geometry: new ol.geom.Point(coords),
                name: feature.properties.name,
                type: feature.properties.type,
                featureType: 'poi' // Identify as POI for styling
            });
        });
    }
}

// Create global instance
const poiData = new POIDataManager();
