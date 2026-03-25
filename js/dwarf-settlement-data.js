/**
 * Dwarf settlement (Karaz Ankor) data management for Old World Atlas
 */

// Source tag mapping
const DWARF_SOURCE_TAG_MAP = {
    '4eLoSaS': 'WFRP4e Lords of Stone and Steel',
    'TWW': 'Total War: Warhammer',
    'TWW1': 'Total War: Warhammer 1',
    'TWW2': 'Total War: Warhammer 2',
    'TWW3': 'Total War: Warhammer 3',
    '1eDSaS': 'WFRP1e Dwarfs: Stone and Steel',
    '2eKAAotDC': 'WFRP2e Karaz Azgal: Adventures of the Dragon Crag',
    '4eTHRC': 'WFRP4e The Horned Rat Companion',
    '4eMCotWW': 'WFRP4e Middenheim: City of the White Wolf',
    '4eStarter': 'WFRP4e Starter Set',
    '4eStartSet': 'WFRP4e Starter Set',
    'Vermintide': 'Warhammer: Vermintide',
    'Vermintide2': 'Warhammer: Vermintide 2',
    'TOW': 'Warhammer: The Old World',
};

// Published canon sources for dwarf settlements.
// Any settlement whose source tag is not in this set is treated as non-canon
// when the "Published Canon Only" filter is active.
// Canon = published tabletop RPG supplements and official miniatures games.
// Non-canon = video game entries (TWW*, Vermintide*) and unsourced entries.
const DWARF_CANON_SOURCES = new Set([
    '4eLoSaS',    // WFRP4e Lords of Stone and Steel
    '1eDSaS',     // WFRP1e Dwarfs: Stone and Steel
    '2eKAAotDC',  // WFRP2e Karaz Azgal: Adventures of the Dragon Crag
    '4eTHRC',     // WFRP4e The Horned Rat Companion
    '4eMCotWW',   // WFRP4e Middenheim: City of the White Wolf
    '4eStarter',  // WFRP4e Starter Set
    '4eStartSet', // WFRP4e Starter Set (alternate tag)
    'TOW',        // Warhammer: The Old World
    'TWW',        // Total War: Warhammer (general tag for all TWW games)
    'TWW1',       // Total War: Warhammer 1
    'TWW2',       // Total War: Warhammer 2
    'TWW3',       // Total War: Warhammer 3
    'Vermintide',   // Warhammer: Vermintide
    'Vermintide2',  // Warhammer: Vermintide 2
]);

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
        if (this.publishedCanonOnly) {
            const source = this.getSourceFromTags(props.tags);
            if (!source || !DWARF_CANON_SOURCES.has(source)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get settlement type from hold_type property
     * @param {object} properties - Feature properties
     * @returns {string} Full hold type description
     */
    getHoldType(properties) {
        const holdType = properties.hold_type;
        if (!holdType || holdType.trim() === '') {
            return 'Khazid (Town)';
        }
        return holdType;
    }

    /**
     * Extract short type code from hold_type (e.g., "Grung" from "Grung (Mining Settlement)")
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
     * Get full source name from shorthand
     * @param {string} sourceShorthand - Source shorthand
     * @returns {string} - Full source name or original if not found
     */
    getFullSourceName(sourceShorthand) {
        return DWARF_SOURCE_TAG_MAP[sourceShorthand] || sourceShorthand;
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
            const sourceTag = this.getSourceFromTags(feature.properties.tags);
            const wiki = feature.properties.wiki || {};
            
            return new ol.Feature({
                geometry: new ol.geom.Point(coords),
                name: feature.properties.name,
                dwarfType: typeCode,
                dwarfHoldType: holdType,
                sourceTag: sourceTag,
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
