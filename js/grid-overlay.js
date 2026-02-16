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
        this.gridSize = 100; // Default grid size
        this.gridUnit = 'miles'; // 'miles' or 'kilometers'
        
        // Map extent from the base map tiles
        this.mapExtent = [-19.045, 31.949, 18.457, 69.451]; // [minX, minY, maxX, maxY]
        
        // Conversion factors: map units to distance
        // From measurement-tool.js: length * 100 * 83.5 = miles
        // Adjusted by factor of 100 to correct grid scale: map_units * 83.5 = miles
        this.MAP_UNITS_TO_MILES = 83.5;
        // km = miles * 1.60934
        this.MAP_UNITS_TO_KM = 83.5 * 1.60934; // 134.37989
        this.MILES_TO_KM = 1.60934;
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
     * @param {number} gridSize - Grid size in the specified unit
     * @param {string} gridUnit - 'miles' or 'kilometers'
     */
    updateGrid(gridType, gridSize, gridUnit) {
        this.gridType = gridType;
        this.gridSize = gridSize;
        this.gridUnit = gridUnit;
        
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
     * Convert miles or kilometers to map units
     * @private
     * @param {number} distance - Distance in miles or kilometers
     * @param {string} unit - 'miles' or 'kilometers'
     * @returns {number} Distance in map units
     */
    distanceToMapUnits(distance, unit) {
        if (unit === 'miles') {
            return distance / this.MAP_UNITS_TO_MILES;
        } else {
            return distance / this.MAP_UNITS_TO_KM;
        }
    }

    /**
     * Generate square grid
     * @private
     */
    generateSquareGrid() {
        const cellSize = this.distanceToMapUnits(this.gridSize, this.gridUnit);
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
