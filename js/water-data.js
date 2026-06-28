/**
 * Water label data management for Old World Atlas
 */

class WaterData {
    constructor() {
        this.waterLabels = [];
        this.olFeatures = [];
    }

    /**
     * Load water labels from GeoJSON file
     * @param {string} url - URL to water labels GeoJSON
     * @returns {Promise<Array>} Array of water features
     */
    async loadWaterLabels(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            this.waterLabels = data.features.map(feature => ({
                name: feature.properties.name,
                waterbodyType: feature.properties.type,
                coordinates: feature.geometry.coordinates
            }));

            // Create OpenLayers features
            this.olFeatures = this.waterLabels.map(water => {
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(water.coordinates),
                    name: water.name,
                    waterbodyType: water.waterbodyType
                });
                return feature;
            });

            return this.waterLabels;
        } catch (error) {
            console.error('Error loading water labels:', error);
            throw error;
        }
    }

    /**
     * Get OpenLayers features
     * @returns {Array<ol.Feature>}
     */
    getOLFeatures() {
        return this.olFeatures;
    }

    /**
     * Get all water labels
     * @returns {Array}
     */
    getWaterLabels() {
        return this.waterLabels;
    }
}

// Create global instance
const waterData = new WaterData();
