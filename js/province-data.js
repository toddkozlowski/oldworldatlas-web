/**
 * Province label data management for Old World Atlas
 */

class ProvinceData {
    constructor() {
        this.provinces = [];
        this.olFeatures = [];
    }

    /**
     * Load province labels from GeoJSON file
     * @param {string} url - URL to province labels GeoJSON
     * @returns {Promise<Array>} Array of province features
     */
    async loadProvinces(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            this.provinces = data.features.map(feature => ({
                name: feature.properties.name,
                provinceType: feature.properties.province_type,
                formalTitle: feature.properties.formal_title,
                population: feature.properties.population,
                info: feature.properties.info || {},
                coordinates: feature.geometry.coordinates
            }));

            const greenskinTypes = new Set(['Major Greenskin Tribe', 'Minor Greenskin Tribe']);
            const northmenTypes  = new Set(['Major Northmen Tribe',  'Minor Northmen Tribe']);

            // Create OpenLayers features
            this.olFeatures = this.provinces.map(province => {
                const info = province.info || {};
                let featureType = 'province';
                if (greenskinTypes.has(province.provinceType)) featureType = 'greenskin-tribe';
                else if (northmenTypes.has(province.provinceType))  featureType = 'northmen-tribe';
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(province.coordinates),
                    name: province.name,
                    provinceType: province.provinceType,
                    formalTitle: province.formalTitle,
                    population: province.population,
                    wikiUrl: info.wiki_url,
                    wikiDescription: info.description,
                    featureType
                });
                return feature;
            });

            return this.provinces;
        } catch (error) {
            console.error('Error loading provinces:', error);
            throw error;
        }
    }

    /**
     * Get OpenLayers features for regular province labels only (excludes tribes)
     * @returns {Array<ol.Feature>}
     */
    getOLFeatures() {
        return this.olFeatures.filter(f => f.get('featureType') === 'province');
    }

    getGreenskinTribeFeatures() {
        return this.olFeatures.filter(f => f.get('featureType') === 'greenskin-tribe');
    }

    getNorthmenTribeFeatures() {
        return this.olFeatures.filter(f => f.get('featureType') === 'northmen-tribe');
    }

    /**
     * Get all provinces
     * @returns {Array}
     */
    getProvinces() {
        return this.provinces;
    }
}

// Create global instance
const provinceData = new ProvinceData();
