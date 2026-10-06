/**
 * Region label and tribe label data management for Old World Atlas
 */

// svg_layer -> styles-config.json `provinces` key
const PROVINCE_STYLE_KEYS = {
    'Nation-States': 'Nation-State',
    'Grand-Provinces': 'Grand-Province',
    'Provinces': 'Province',
    'Sub-Provinces': 'Sub-Province'
};

class ProvinceData {
    constructor() {
        this.provinces = [];
        this.olFeatures = [];
    }

    /**
     * Load region labels from GeoJSON file
     * @param {string} url - URL to region labels GeoJSON
     * @returns {Promise<Array>} Array of region label features
     */
    async loadProvinces(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            this.provinces = data.features.filter(isFeatureOnMap).map(feature => ({
                name: feature.properties.name,
                label: feature.properties.label,
                provinceType: feature.properties.type,
                localCategory: feature.properties.local_category,
                svgLayer: feature.properties.svg_layer,
                formalTitle: feature.properties.formal_title,
                population: feature.properties.population,
                wiki: feature.properties.wiki || {},
                coordinates: feature.geometry.coordinates
            }));

            // Create OpenLayers features
            this.olFeatures = this.provinces.map(province => new ol.Feature({
                geometry: new ol.geom.Point(province.coordinates),
                name: province.name,
                label: province.label,
                provinceType: province.provinceType,
                provinceStyleKey: PROVINCE_STYLE_KEYS[province.svgLayer],
                localCategory: province.localCategory,
                formalTitle: province.formalTitle,
                population: province.population,
                wikiTitle: province.wiki.title,
                wikiImage: province.wiki.image,
                wikiUrl: province.wiki.url,
                wikiDescription: province.wiki.description,
                featureType: 'province'
            }));

            return this.provinces;
        } catch (error) {
            console.error('Error loading provinces:', error);
            throw error;
        }
    }

    /**
     * Get OpenLayers features for region labels
     * @returns {Array<ol.Feature>}
     */
    getOLFeatures() {
        return this.olFeatures;
    }

    /**
     * Get all provinces
     * @returns {Array}
     */
    getProvinces() {
        return this.provinces;
    }
}

// Tribe `group` -> feature type and styles-config.json `tribes` key word
const TRIBE_GROUPS = {
    'Greenskins': { featureType: 'greenskin-tribe', styleWord: 'Greenskin' },
    'Northmen': { featureType: 'northmen-tribe', styleWord: 'Northmen' },
    'Araby': { featureType: 'araby-tribe', styleWord: 'Araby' }
};

/**
 * Display label for a tribe, e.g. "Major Greenskin Tribe" (also its styles-config.json `tribes` key)
 * @param {ol.Feature} feature - Tribe feature
 * @returns {string}
 */
function getTribeLabel(feature) {
    const group = TRIBE_GROUPS[feature.get('tribeGroup')];
    return `${feature.get('tribeSize')} ${group ? group.styleWord : ''} Tribe`;
}

class TribeData {
    constructor() {
        this.rawFeatures = [];
        this.olFeatures = [];
        this.publishedCanonOnly = false;
    }

    /**
     * Load tribe labels from GeoJSON file
     * @param {string} url - URL to tribes GeoJSON
     * @returns {Promise<Array>} Array of tribe features
     */
    async loadTribes(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            this.rawFeatures = data.features.filter(feature =>
                isFeatureOnMap(feature) && TRIBE_GROUPS[feature.properties.group]
            );
            this.buildOLFeatures();
            return this.rawFeatures;
        } catch (error) {
            console.error('Error loading tribes:', error);
            throw error;
        }
    }

    /**
     * Rebuild OpenLayers features from raw features using the current filters
     * @private
     */
    buildOLFeatures() {
        this.olFeatures = this.rawFeatures
            .filter(feature => !this.publishedCanonOnly || isCanonSource(feature.properties.source))
            .map(feature => {
                const props = feature.properties;
                const group = TRIBE_GROUPS[props.group];
                const wiki = props.wiki || {};
                return new ol.Feature({
                    geometry: new ol.geom.Point(feature.geometry.coordinates),
                    name: props.name,
                    tribeGroup: props.group,
                    tribeSize: props.size,
                    tribeType: props.type,
                    source: props.source,
                    wikiTitle: wiki.title,
                    wikiUrl: wiki.url,
                    wikiDescription: wiki.description,
                    wikiImage: wiki.image,
                    featureType: group.featureType
                });
            });
    }

    /**
     * Set Published Canon Only filter state
     * @param {boolean} enabled
     */
    setPublishedCanonOnly(enabled) {
        if (this.publishedCanonOnly !== enabled) {
            this.publishedCanonOnly = enabled;
            this.buildOLFeatures();
        }
    }

    getGreenskinTribeFeatures() {
        return this.olFeatures.filter(f => f.get('featureType') === 'greenskin-tribe');
    }

    getNorthmenTribeFeatures() {
        return this.olFeatures.filter(f => f.get('featureType') === 'northmen-tribe');
    }

    getArabyTribeFeatures() {
        return this.olFeatures.filter(f => f.get('featureType') === 'araby-tribe');
    }
}

// Create global instances
const provinceData = new ProvinceData();
const tribeData = new TribeData();
