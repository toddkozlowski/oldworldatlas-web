/**
 * Settlement data management for Old World Atlas
 */

// Source tag mapping
const SOURCE_TAG_MAP = {
    '2eSH': 'WFRP2e Sigmar\'s Heirs',
    '4eAotE1': 'WFRP4e Archives of the Empire Vol. 1',
    '4eAotE2': 'WFRP4e Archives of the Empire Vol. 2',
    '4eAotE3': 'WFRP4e Archives of the Empire Vol. 3',
    '4eEiS': 'WFRP4e Enemy in Shadows',
    '4ePBtTC': 'WFRP4e Power Behind the Throne Companion',
    '4eSCoSaS': 'WFRP4e Salzenmund: City of Salt and Silver',
    '4eCRB': 'WFRP4e Core Rulebook',
    '4eDotRC': 'WFRP4e Death on the Reik Companion',
    'NCC': 'WFB Nemesis Crown Campaign',
    'AmbChron': 'The Ambassor Chronicles (Black Library)',
    'G&T': 'Gotrek & Felix (Black Library)',
    'G&FT': 'Gotrek & Felix (Black Library)',
    'TOW': 'Warhammer: The Old World',
    '1eMSDtR': 'WFRP1e Marienburg: Sold Down the River',
    '4eLoSaS': 'WFRP4e Lords of Stone and Steel',
    '4eTHRC': 'WFRP4e The Horned Rat Companion',
    '4eMCotWW': 'WFRP4e Middenheim: City of the White Wolf',
    '1eDSaS': 'WFRP1e Dwarfs: Stone and Steel',
    'TWW3': 'Total War: Warhammer 3',
    '2eKAAotDC': 'WFRP2e Karaz Azgal: Adventures of the Dragon Crag',
    'AndyLaw': 'Andy Law (LawHammer)',
    'MA': 'MadAlfred',
    'MadAlfred': 'MadAlfred',
    '4eStarter': 'WFRP4e Starter Set',
    '4eUA1': 'WFRP4e Ubersreik Adventures 1',
    '4eUA2': 'WFRP4e Ubersreik Adventures 2',
    '2eKotG': 'WFRP2e Knights of the Grail',
    'BretProj': 'Brettonia Project (Fan)',
    '1eCRB': 'WFRP1e Core Rulebook',
    'MoWC': 'Man o\' War: Corsair (WFB)',
    '1eDDS': 'WFRP1e Death\'s Dark Shadow',
    'TVS': 'The Voyage South (Black Library)',
    'WDM': 'White Dwarf Magazine',
    'BrainCraig': 'Brain Craig (Black Library)',
    'WHMonthly': 'Warhammer Monthly (Black Library)',
    'WFB6e': 'Warhammer Fantasy Battles 6th Edition',
    'WFB7e': 'Warhammer Fantasy Battles 7th Edition',
    'WFB8e': 'Warhammer Fantasy Battles 8th Edition',
    'Archaon': 'Archaon: Everchosen (Black Library)',
    'RedDuke': 'Red Duke (Black Library)',
    'KniErrant': 'The Knight Errant (Black Library)',
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
            'albion'
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
            this.rawFeatures = datasets.flatMap((data, index) => {
                const regionGroup = this.getRegionFromPath(paths[index]);
                return data.features.map(feature => {
                    const nextProps = {
                        ...feature.properties,
                        region_group: regionGroup || this.getRegionFromProvince(feature.properties?.province)
                    };
                    return {
                        ...feature,
                        properties: nextProps
                    };
                });
            });
            
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
        if (this.publishedCanonOnly) {
            const source = this.getSourceFromTags(props.tags);
            // Hide settlements without a source tag, or with 'AndyLaw' or 'MadAlfred' as the only source (since they are mostly fan creations and not official canon)
            if (!source || source === 'AndyLaw' || source === 'MadAlfred') {
                    return false;
                    

            //if (!source || source === 'AndyLaw') {
            //    return false;
            }
        }

        const sizeCategory = Number(props.size_category);
        if (!this.enabledSizeCategories.has(sizeCategory)) {
            return false;
        }

        const regionGroup = props.region_group || this.getRegionFromProvince(props.province);
        if (!regionGroup || !this.enabledRegions.has(regionGroup)) {
            return false;
        }

        return true;
    }

    /**
     * Get normalized region key from settlement file path.
     * @private
     * @param {string} path - Data file path
     * @returns {string|null}
     */
    getRegionFromPath(path) {
        if (!path) {
            return null;
        }

        const normalized = path.toLowerCase();
        if (normalized.includes('settlements_empire')) return 'empire';
        if (normalized.includes('settlements_bretonnia')) return 'bretonnia';
        if (normalized.includes('settlements_kislev')) return 'kislev';
        if (normalized.includes('settlements_norsca')) return 'norsca';
        if (normalized.includes('settlements_tilea')) return 'tilea';
        if (normalized.includes('settlements_estalia')) return 'estalia';
        if (normalized.includes('settlements_border_princes')) return 'border-princes';
        if (normalized.includes('settlements_westerland')) return 'albion';
        if (normalized.includes('settlements_albion')) return 'albion';
        return null;
    }

    /**
     * Infer normalized region key from province text.
     * @private
     * @param {string} province - Province name
     * @returns {string|null}
     */
    getRegionFromProvince(province) {
        if (!province || typeof province !== 'string') {
            return null;
        }

        const normalized = province.toLowerCase();
        if (normalized.includes('empire')) return 'empire';
        if (normalized.includes('breton')) return 'bretonnia';
        if (normalized.includes('kislev')) return 'kislev';
        if (normalized.includes('norsca')) return 'norsca';
        if (normalized.includes('tilea')) return 'tilea';
        if (normalized.includes('estalia')) return 'estalia';
        if (normalized.includes('border')) return 'border-princes';
        if (normalized.includes('albion')) return 'albion';
        return null;
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
        return SOURCE_TAG_MAP[sourceShorthand] || sourceShorthand;
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
            province: feature.properties.province || 'Unknown',
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
            const sourceTag = this.getSourceFromTags(feature.properties.tags);
            const wiki = feature.properties.wiki || {};
            return new ol.Feature({
                geometry: new ol.geom.Point(coords),
                name: feature.properties.name,
                sizeCategory: feature.properties.size_category,
                population: feature.properties.population,
                province: feature.properties.province,
                regionGroup: feature.properties.region_group,
                sourceTag: sourceTag,
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
