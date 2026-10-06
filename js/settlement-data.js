/**
 * Settlement data management for Old World Atlas
 */

// Settlement `region` values -> region filter keys (see UIControls.settlementRegionConfig).
// Westerland has no toggle of its own and shares the Albion one.
const SETTLEMENT_REGION_KEYS = {
    'Empire': 'empire',
    'Bretonnia': 'bretonnia',
    'Kislev': 'kislev',
    'Norsca': 'norsca',
    'Tilea': 'tilea',
    'Estalia': 'estalia',
    'Border Princes': 'border-princes',
    'Albion': 'albion',
    'Westerland': 'albion',
    'Araby': 'araby',
    'Dawi-Zharr': 'dawi-zharr',
    'Nehekhara': 'nehekhara'
};

class SettlementDataManager {
    constructor() {
        this.rawFeatures = [];
        this.filteredFeatures = [];
        this.settlementMap = new Map(); // For quick lookup by name
        this.publishedCanonOnly = false;
        this.enabledSizeCategories = new Set([1, 2, 3, 4, 5, 6]);
        this.enabledRegions = new Set([
            'empire',
            'bretonnia',
            'kislev',
            'norsca',
            'tilea',
            'estalia',
            'border-princes',
            'albion',
            'araby',
            'dawi-zharr',
            'nehekhara'
        ]);
    }

    /**
     * Load settlements from multiple GeoJSON files
     * @param {string|string[]} dataPaths - Path or array of paths to GeoJSON files
     * @returns {Promise}
     */
    async loadSettlements(dataPaths) {
        try {
            // Support both single path and array of paths for backwards compatibility
            const paths = Array.isArray(dataPaths) ? dataPaths : [dataPaths];
            
            // Fetch all files in parallel
            const responses = await Promise.all(
                paths.map(path => fetch(path))
            );
            
            // Parse all JSON data
            const datasets = await Promise.all(
                responses.map(response => response.json())
            );
            
            // Combine all features from all datasets and annotate each feature with a normalized region key.
            this.rawFeatures = datasets.flatMap(data => data.features.map(feature => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    region_group: SETTLEMENT_REGION_KEYS[feature.properties?.region] || null
                }
            })));
            
            this.filterAndIndexSettlements();
            return this.filteredFeatures;
        } catch (error) {
            console.error('Error loading settlements:', error);
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

        const sizeCategory = Number(props.size_category);
        if (!this.enabledSizeCategories.has(sizeCategory)) {
            return false;
        }

        if (!props.region_group || !this.enabledRegions.has(props.region_group)) {
            return false;
        }

        return true;
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
     * Set allowed settlement size categories.
     * @param {number[]} categories
     */
    setEnabledSizeCategories(categories) {
        this.enabledSizeCategories = new Set(
            (categories || []).map(value => Number(value)).filter(value => Number.isFinite(value))
        );
        this.filterAndIndexSettlements();
    }

    /**
     * Set allowed region keys.
     * @param {string[]} regions
     */
    setEnabledRegions(regions) {
        this.enabledRegions = new Set((regions || []).filter(Boolean));
        this.filterAndIndexSettlements();
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
        return {
            name: feature.properties.name,
            sizeCategory: feature.properties.size_category,
            population: feature.properties.population || 0,
            province: feature.properties.province || feature.properties.region || 'Unknown',
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
     * Search settlements by name
     * @param {string} query - Search query
     * @returns {array}
     */
    search(query) {
        const settlements = this.getAllSettlements();
        return searchSettlements(settlements, query);
    }

    /**
     * Get settlements by province
     * @param {string} province - Province name
     * @returns {array}
     */
    getByProvince(province) {
        return this.getAllSettlements().filter(s => s.province === province);
    }

    /**
     * Get settlements by size category
     * @param {number} sizeCategory - Size category
     * @returns {array}
     */
    getBySize(sizeCategory) {
        return this.getAllSettlements().filter(s => s.sizeCategory === sizeCategory);
    }

    /**
     * Get raw GeoJSON features for OpenLayers
     * @returns {array}
     */
    getOLFeatures() {
        return this.filteredFeatures.map(feature => {
            const coords = feature.geometry.coordinates;
            const wiki = feature.properties.wiki || {};
            return new ol.Feature({
                geometry: new ol.geom.Point(coords),
                name: feature.properties.name,
                settlementType: feature.properties.type,
                sizeCategory: feature.properties.size_category,
                population: feature.properties.population,
                populationEstimated: feature.properties.population_estimated === true,
                province: feature.properties.province,
                region: feature.properties.region,
                regionGroup: feature.properties.region_group,
                source: feature.properties.source,
                wikiTitle: wiki.title,
                wikiUrl: wiki.url,
                wikiDescription: wiki.description,
                wikiImage: wiki.image
            });
        });
    }
}

// Create global instance
const settlementData = new SettlementDataManager();
