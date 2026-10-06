/**
 * Dwarf settlement (Karaz Ankor) data management for Old World Atlas
 */

class DwarfSettlementDataManager {
    constructor() {
        this.rawFeatures = [];
        this.filteredFeatures = [];
        this.settlementMap = new Map(); // For quick lookup by name
        this.publishedCanonOnly = false;
    }

    /**
     * Load dwarf settlements from GeoJSON file
     * @param {string} dataPath - Path to GeoJSON file
     * @returns {Promise}
     */
    async loadDwarfSettlements(dataPath) {
        try {
            const response = await fetch(dataPath);
            const data = await response.json();
            
            this.rawFeatures = data.features;
            this.filterAndIndexSettlements();
            return this.filteredFeatures;
        } catch (error) {
            console.error('Error loading dwarf settlements:', error);
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
        const props = feature.properties;
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

        // Check Published Canon Only filter
        if (this.publishedCanonOnly && !isCanonSource(props.source)) {
            return false;
        }

        return true;
    }

    /**
     * Get hold type from the type property
     * @param {object} properties - Feature properties
     * @returns {string} Full hold type description
     */
    getHoldType(properties) {
        const holdType = properties.type;
        if (!holdType || holdType.trim() === '') {
            return 'Khazid (Town)';
        }
        return holdType;
    }

    /**
     * Extract short type code from the hold type (e.g., "Grung" from "Grung (Mining Settlement)")
     * @param {string} holdType - Full hold type description
     * @returns {string} Short type code for styling
     */
    getTypeCode(holdType) {
        if (holdType.startsWith('Grung')) return 'Grung';
        if (holdType.startsWith('Kazad')) return 'Kazad';
        if (holdType.startsWith('Khazid')) return 'Khazid';
        if (holdType.startsWith('Karak')) return 'Karak';
        return 'Khazid'; // Default
    }

    /**
     * Set Published Canon Only filter state
     * @param {boolean} enabled
     */
    setPublishedCanonOnly(enabled) {
        if (this.publishedCanonOnly !== enabled) {
            this.publishedCanonOnly = enabled;
            this.filterAndIndexSettlements();
        }
    }

    /**
     * Get Published Canon Only filter state
     * @returns {boolean}
     */
    getPublishedCanonOnly() {
        return this.publishedCanonOnly;
    }

    /**
     * Convert raw feature to settlement object
     * @param {object} feature - GeoJSON feature
     * @returns {object}
     */
    featureToSettlement(feature) {
        const coords = feature.geometry.coordinates;
        const holdType = this.getHoldType(feature.properties);
        const typeCode = this.getTypeCode(holdType);
        return {
            name: feature.properties.name,
            holdType: holdType,
            typeCode: typeCode,
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
            const holdType = this.getHoldType(feature.properties);
            const typeCode = this.getTypeCode(holdType);
            const wiki = feature.properties.wiki || {};
            const isFallen = (feature.properties.notes || []).includes('fallen');

            return new ol.Feature({
                geometry: new ol.geom.Point(coords),
                name: feature.properties.name,
                dwarfType: typeCode,
                dwarfHoldType: holdType,
                isFallen: isFallen,
                source: feature.properties.source,
                wikiTitle: wiki.title,
                wikiUrl: wiki.url,
                wikiDescription: wiki.description,
                wikiImage: wiki.image,
                featureType: 'dwarf'  // Marker to identify as dwarf settlement
            });
        });
    }
}

// Create global instance
const dwarfSettlementData = new DwarfSettlementDataManager();
