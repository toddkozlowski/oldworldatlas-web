/**
 * Grid overlay for Old World Atlas
 * Provides square grid overlays with configurable size
 */

class GridOverlay {
    constructor() {
        this.map = null;
        this.gridLayer = null;
        this.gridSource = null;
        this.gridType = 'off'; // 'off' or 'square'
        this.gridSizeKm = 100; // Default grid size in kilometers
        
        // Map extent from the base map tiles
        this.mapExtent = [-19.045, 31.949, 18.457, 69.451]; // [minX, minY, maxX, maxY]
        
        // Conversion factor: map units to kilometers
        // From measurement-tool.js: length * 100 * 83.5 = miles
        // So: map_units * 8350 = miles
        // And: miles * 1.60934 = kilometers
        // Therefore: map_units * 8350 * 1.60934 ≈ map_units * 13437.989 = kilometers
        // Adjusted by factor of 100 to correct grid scale
        this.MAP_UNITS_TO_KM = 134.37989;
    }

    /**
     * Initialize the grid overlay
     * @param {ol.Map} map - OpenLayers map instance
     * @param {ol.layer.Vector} gridLayer - The grid vector layer
     * @param {ol.source.Vector} gridSource - The grid vector source
     */
    initialize(map, gridLayer, gridSource) {
        this.map = map;
        this.gridLayer = gridLayer;
        this.gridSource = gridSource;
        
        // Grid starts hidden
        this.gridLayer.setVisible(false);
    }

    /**
     * Update the grid based on current settings
     * @param {string} gridType - 'off' or 'square'
     * @param {number} gridSizeKm - Grid size in kilometers
     */
    updateGrid(gridType, gridSizeKm) {
        this.gridType = gridType;
        this.gridSizeKm = gridSizeKm;
        
        // Clear existing grid
        this.gridSource.clear();
        
        if (gridType === 'off') {
            this.gridLayer.setVisible(false);
            return;
        }
        
        // Generate new grid
        if (gridType === 'square') {
            this.generateSquareGrid();
        }
        
        this.gridLayer.setVisible(true);
    }

    /**
     * Convert kilometers to map units
     * @private
     * @param {number} km - Distance in kilometers
     * @returns {number} Distance in map units
     */
    kmToMapUnits(km) {
        return km / this.MAP_UNITS_TO_KM;
    }

    /**
     * Generate square grid
     * @private
     */
    generateSquareGrid() {
        const cellSize = this.kmToMapUnits(this.gridSizeKm);
        const [minX, minY, maxX, maxY] = this.mapExtent;
        
        const features = [];
        
        // Calculate grid boundaries aligned to cell size
        const startX = Math.floor(minX / cellSize) * cellSize;
        const startY = Math.floor(minY / cellSize) * cellSize;
        const endX = Math.ceil(maxX / cellSize) * cellSize;
        const endY = Math.ceil(maxY / cellSize) * cellSize;
        
        // Create vertical lines
        for (let x = startX; x <= endX; x += cellSize) {
            const line = new ol.geom.LineString([
                [x, minY],
                [x, maxY]
            ]);
            const feature = new ol.Feature({
                geometry: line
            });
            features.push(feature);
        }
        
        // Create horizontal lines
        for (let y = startY; y <= endY; y += cellSize) {
            const line = new ol.geom.LineString([
                [minX, y],
                [maxX, y]
            ]);
            const feature = new ol.Feature({
                geometry: line
            });
            features.push(feature);
        }
        
        this.gridSource.addFeatures(features);
    }

    /**
     * Create style for grid lines
     * @returns {ol.style.Style}
     */
    static createGridStyle() {
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'rgba(0, 0, 0, 0.3)',
                width: 1,
                lineDash: [5, 5]
            }),
            fill: null // No fill for grid cells
        });
    }
}

// Create global instance
const gridOverlay = new GridOverlay();
