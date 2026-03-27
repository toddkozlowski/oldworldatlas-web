/**
 * Map management for Old World Atlas
 */

class MapManager {
    constructor(targetElementId = 'map') {
        this.map = null;
        this.targetElementId = targetElementId;
        this.gridVectorLayer = null;  // Grid overlay layer
        this.gridSource = null;
        this.settlementVectorLayer = null;
        this.allSettlementLabelsSource = null;  // Combined labels source for cross-type declutter priority
        this.settlementSource = null;
        this.settlementMarkersOnlyLayer = null;  // Marker-only layer (no declutter)
        this.settlementMarkersOnlySource = null;
        this.dwarfSettlementVectorLayer = null;  // Dwarf settlement layer
        this.dwarfSettlementSource = null;
        this.dwarfSettlementMarkersOnlyLayer = null;  // Dwarf marker-only layer
        this.dwarfSettlementMarkersOnlySource = null;
        this.woodElfSettlementVectorLayer = null;  // Wood Elf settlement layer
        this.woodElfSettlementSource = null;
        this.woodElfSettlementMarkersOnlyLayer = null;  // Wood Elf marker-only layer
        this.woodElfSettlementMarkersOnlySource = null;
        this.poiVectorLayer = null;
        this.poiSource = null;
        this.provinceVectorLayer = null;
        this.provinceSource = null;
        this.waterVectorLayer = null;
        this.waterSource = null;
    }

    /**
     * Check if device is in mobile portrait mode
     * @private
     * @returns {boolean}
     */
    isMobilePortrait() {
        return window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
    }

    /**
     * Initialize the map
     * @returns {ol.Map}
     */
    initialize() {
        // Custom coordinate format function
        const coordinateFormat = (coordinate) => {
            if (!coordinate || !this.map) {
                return '';
            }
            const lon = coordinate[0].toFixed(3);
            const lat = coordinate[1].toFixed(3);
            const zoom = (this.map.getView().getResolution() * 100).toFixed(3);
            return `X=${lon}, Y=${lat}, Z=${zoom}`;
        };

        const mousePositionControl = new ol.control.MousePosition({
            className: 'custom-mouse-position',
            target: document.getElementById('mouse-position'),
            undefinedHTML: '&nbsp;',
            coordinateFormat: coordinateFormat
        });

        this.gridSource = new ol.source.Vector();  // Grid overlay
        this.allSettlementLabelsSource = new ol.source.Vector();  // Combined labels for all settlement types
        this.settlementSource = new ol.source.Vector();
        this.settlementMarkersOnlySource = new ol.source.Vector();  // Markers only (no labels)
        this.dwarfSettlementSource = new ol.source.Vector();  // Dwarf settlements
        this.dwarfSettlementMarkersOnlySource = new ol.source.Vector();  // Dwarf markers only
        this.woodElfSettlementSource = new ol.source.Vector();  // Wood Elf settlements
        this.woodElfSettlementMarkersOnlySource = new ol.source.Vector();  // Wood Elf markers only
        this.poiSource = new ol.source.Vector();
        this.provinceSource = new ol.source.Vector();
        this.waterSource = new ol.source.Vector();

        this.map = new ol.Map({
            controls: ol.control.defaults.defaults().extend([mousePositionControl]),
            target: this.targetElementId,
            layers: [
                new ol.layer.Group({
                    title: 'Overlay',
                    layers: [
                        this.createTileLayer(),
                    ]
                }),
                this.createGridLayer(),                        // Grid overlay (above basemap, below everything else)
                this.createProvinceLayer(),
                this.createWaterLayer(),
                this.createSettlementMarkersOnlyLayer(),  // Markers only, always visible
                this.createSettlementLayer(),              // Labels + markers, can be decluttered
                this.createDwarfSettlementMarkersOnlyLayer(),  // Dwarf markers only
                this.createDwarfSettlementLayer(),              // Dwarf labels + markers
                this.createWoodElfSettlementMarkersOnlyLayer(),  // Wood Elf markers only
                this.createWoodElfSettlementLayer(),             // Wood Elf labels + markers
                this.createPOILayer()
            ],
            view: new ol.View({
                center: this.isMobilePortrait() ? [-0.2965, 50.7] : [2.7, 50.7], // Centered on Altdorf on Mobile
                resolution: this.isMobilePortrait() ? 0.0075 : 0.018, // Resolution for desktop: 0.075015, for mobile portrait: 0.020
                maxResolution: 0.0375075,
                minResolution: 0.00029302734375,
                extent: [-37.796, 13.198, 37.208, 88.202],  // Full map extent + 50% buffer in all directions
                enableRotation: false,  // Disable rotation for better mobile performance
                constrainRotation: false
            })
        });

        // Store references to layers for visibility control
        this.gridVectorLayer = this.map.getLayers().item(1);
        this.provinceVectorLayer = this.map.getLayers().item(2);
        this.waterVectorLayer = this.map.getLayers().item(3);
        this.settlementMarkersOnlyLayer = this.map.getLayers().item(4);
        this.settlementVectorLayer = this.map.getLayers().item(5);
        this.dwarfSettlementMarkersOnlyLayer = this.map.getLayers().item(6);
        this.dwarfSettlementVectorLayer = this.map.getLayers().item(7);
        this.woodElfSettlementMarkersOnlyLayer = this.map.getLayers().item(8);
        this.woodElfSettlementVectorLayer = this.map.getLayers().item(9);
        this.poiVectorLayer = this.map.getLayers().item(10);
        
        // POI layer starts hidden (unchecked)
        this.poiVectorLayer.setVisible(false);


        return this.map;
    }

    /**
     * Create tile layer for base map
     * @private
     * @returns {ol.layer.Tile|ol.layer.Group}
     */
    createTileLayer() {
        // ========== TILE CONFIGURATION TOGGLE ==========
        // Set to true to use new quadrant-based tiles (old-world-tiles-v2)
        // Set to false to use legacy single-directory tiles (old-world-tiles)
        const USE_QUADRANT_TILES = false;
        // ================================================
        
        const TILE_VERSION = '11'; // Increment this when you update the base map tiles
        
        // Scale adjustment factor for fine-tuning map/vector alignment
        // Values > 1.0 make map smaller (increase resolution), < 1.0 make map larger
        // Adjust this value to align map features with vector labels
        // const SCALE_ADJUSTMENT = 0.9997; // Current adjustment: +0.03%
        const SCALE_ADJUSTMENT = 0.96335; // For test_tiles
        
        // Base resolutions (before scaling adjustment)
        const baseResolutions = [0.15003, 0.075015, 0.0375075, 0.01875375, 0.009376875, 0.0046884375, 0.00234421875, 0.001172109375, 0.0005860546875, 0.00029302734375];
        
        // Apply scale adjustment to all resolutions
        const adjustedResolutions = baseResolutions.map(r => r * SCALE_ADJUSTMENT);
        
        // Full map extent
        // const fullExtent = [-19.045, 31.949, 18.457, 69.451]; // [minX, minY, maxX, maxY]
        const fullExtent = [-19, 32, 18, 69];
        const centerX = (fullExtent[0] + fullExtent[2]) / 2; // -0.294
        const centerY = (fullExtent[1] + fullExtent[3]) / 2; // 50.7
        
        if (USE_QUADRANT_TILES) {
            // Create four separate tile layers, one for each quadrant
            // Each quadrant is 1/4 of the full map extent
            // Divide resolutions by 4 to account for each quadrant being 1/4 the area
            const quadrantResolutions = adjustedResolutions.map(r => r / 1.56221);
            
            const quadrants = [
                {
                    name: 'SW',
                    extent: [fullExtent[0], fullExtent[1], centerX, centerY],
                    origin: [fullExtent[0], fullExtent[1]]
                },
                {
                    name: 'SE',
                    extent: [centerX, fullExtent[1], fullExtent[2], centerY],
                    origin: [centerX - 0.0015, fullExtent[1] + 0.0006] // Slight offset to prevent tile seam issues
                },
                {
                    name: 'NW',
                    extent: [fullExtent[0], centerY, centerX, fullExtent[3]],
                    origin: [fullExtent[0], centerY]
                },
                {
                    name: 'NE',
                    extent: [centerX, centerY, fullExtent[2], fullExtent[3]],
                    origin: [centerX, centerY]
                }
            ];
            
            const quadrantLayers = quadrants.map(quad => {
                return new ol.layer.Tile({
                    title: `Map Tiles ${quad.name}`,
                    source: new ol.source.TileImage({
                        attributions: '',
                        tileGrid: new ol.tilegrid.TileGrid({
                            extent: quad.extent,
                            origin: quad.origin,
                            resolutions: quadrantResolutions,
                            tileSize: [256, 256]
                        }),
                        tileUrlFunction: function(tileCoord) {
                            const z = tileCoord[0];
                            const x = tileCoord[1];
                            const y = -1 - tileCoord[2];
                            return `https://raw.githubusercontent.com/toddkozlowski/oldworldatlas-repository/main/test-tiles/${quad.name}/${z}/${x}/${y}.png?v=${TILE_VERSION}`;
                        }
                    })
                });
            });
            
            // Return a layer group containing all four quadrant layers
            return new ol.layer.Group({
                title: 'Map Tiles',
                layers: quadrantLayers
            });
            
        } else {
            // Legacy single-layer implementation
            const getLegacyTileUrl = function(tileCoord) {
                return ('https://raw.githubusercontent.com/toddkozlowski/oldworldatlas-repository/main/test_tiles/{z}/{x}/{y}.png?v=' + TILE_VERSION)
                    .replace('{z}', String(tileCoord[0]))
                    .replace('{x}', String(tileCoord[1]))
                    .replace('{y}', String(-1 - tileCoord[2]));
            };
            
            return new ol.layer.Tile({
                title: 'Map Tiles',
                source: new ol.source.TileImage({
                    attributions: '',
                    tileGrid: new ol.tilegrid.TileGrid({
                        //For the Empire-only map tiles:
                        //extent: [-4.7926911472531506, 40.3006238607187441, 13.7306637823468485, 58.8239787903187477],
                        //origin: [-4.7926911472531506, 40.3006238607187441],
                        //resolutions: [0.0740934197183999999, 0.0370467098591999999, 0.0185233549296, 0.00926167746479999998, 0.00463083873239999999, 0.0023154193662, 0.0011577096831, 0.000578854841549999999],
                        //For the full Old World map tiles:
                        extent: fullExtent,
                        origin: [fullExtent[0], fullExtent[1]],
                        resolutions: adjustedResolutions,
                        tileSize: [256, 256]
                    }),
                    tileUrlFunction: getLegacyTileUrl
                })
            });
        }
    }

    /**
     * Create settlement markers-only vector layer (no labels, no declutter)
     * @private
     * @returns {ol.layer.Vector}
     */
    createSettlementMarkersOnlyLayer() {
        return new ol.layer.Vector({
            title: 'Settlement Markers',
            source: this.settlementMarkersOnlySource,
            updateWhileAnimating: false,
            updateWhileInteracting: false,
            renderBuffer: 100,
            style: (feature) => createSettlementMarkerOnlyStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Create settlement vector layer
     * @private
     * @returns {ol.layer.Vector}
     */
    createSettlementLayer() {
        return new ol.layer.Vector({
            title: 'Settlements (Size 3+)',
            source: this.allSettlementLabelsSource,
            declutter: 'settlement-labels', // Shared declutter group for all settlement labels
            updateWhileAnimating: false,  // Performance: don't update during animation
            updateWhileInteracting: false, // Performance: don't update while panning/zooming
            renderBuffer: 100,             // Render features slightly outside viewport
            style: (feature) => createUnifiedSettlementStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Create dwarf settlement vector layer
     * @private
     * @returns {ol.layer.Vector}
     */
    createDwarfSettlementLayer() {
        return new ol.layer.Vector({
            title: 'Dwarf Settlements',
            source: this.dwarfSettlementSource,
            declutter: 'settlement-labels', // Shared declutter group for all settlement labels
            visible: false,                // Rendering handled by combined settlement label layer
            updateWhileAnimating: false,  // Performance: don't update during animation
            updateWhileInteracting: false, // Performance: don't update while panning/zooming
            renderBuffer: 100,             // Render features slightly outside viewport
            style: (feature) => createDwarfSettlementStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Create dwarf settlement marker-only layer
     * @private
     * @returns {ol.layer.Vector}
     */
    createDwarfSettlementMarkersOnlyLayer() {
        return new ol.layer.Vector({
            title: 'Dwarf Settlement Markers',
            source: this.dwarfSettlementMarkersOnlySource,
            updateWhileAnimating: false,
            updateWhileInteracting: false,
            renderBuffer: 100,
            style: (feature) => createDwarfSettlementMarkerOnlyStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Create wood elf settlement vector layer
     * @private
     * @returns {ol.layer.Vector}
     */
    createWoodElfSettlementLayer() {
        return new ol.layer.Vector({
            title: 'Wood Elf Settlements',
            source: this.woodElfSettlementSource,
            declutter: 'settlement-labels',
            visible: false,               // Rendering handled by combined settlement label layer
            updateWhileAnimating: false,
            updateWhileInteracting: false,
            renderBuffer: 100,
            style: (feature) => createWoodElfSettlementStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Create wood elf settlement marker-only layer
     * @private
     * @returns {ol.layer.Vector}
     */
    createWoodElfSettlementMarkersOnlyLayer() {
        return new ol.layer.Vector({
            title: 'Wood Elf Settlement Markers',
            source: this.woodElfSettlementMarkersOnlySource,
            updateWhileAnimating: false,
            updateWhileInteracting: false,
            renderBuffer: 100,
            style: (feature) => createWoodElfSettlementMarkerOnlyStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Create POI vector layer
     * @private
     * @returns {ol.layer.Vector}
     */
    createPOILayer() {
        return new ol.layer.Vector({
            title: 'Points of Interest',
            source: this.poiSource,
            declutter: 'poi-labels',       // Keep POI decluttering separate from settlement labels
            updateWhileAnimating: false,  // Performance: don't update during animation
            updateWhileInteracting: false, // Performance: don't update while panning/zooming
            renderBuffer: 100,             // Render features slightly outside viewport
            style: (feature) => createPOIStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Create province labels vector layer
     * @private
     * @returns {ol.layer.Vector}
     */
    createProvinceLayer() {
        return new ol.layer.Vector({
            title: 'Province Labels',
            source: this.provinceSource,
            updateWhileAnimating: false,  // Performance: don't update during animation
            updateWhileInteracting: false, // Performance: don't update while panning/zooming
            style: (feature) => createProvinceStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Create water labels vector layer
     * @private
     * @returns {ol.layer.Vector}
     */
    createWaterLayer() {
        return new ol.layer.Vector({
            title: 'Water Labels',
            source: this.waterSource,
            updateWhileAnimating: false,  // Performance: don't update during animation
            updateWhileInteracting: false, // Performance: don't update while panning/zooming
            style: (feature) => createWaterStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Create grid overlay vector layer
     * @private
     * @returns {ol.layer.Vector}
     */
    createGridLayer() {
        return new ol.layer.Vector({
            title: 'Grid Overlay',
            source: this.gridSource,
            updateWhileAnimating: false,  // Performance: don't update during animation
            updateWhileInteracting: false, // Performance: don't update while panning/zooming
            style: GridOverlay.createGridStyle()
        });
    }

    /**
     * Add features to settlement layer
     * @param {array} features - Array of ol.Feature objects
     */
    addSettlementFeatures(features) {
        this.settlementSource.addFeatures(features);
        // Also add to marker-only layer for always-visible markers
        this.settlementMarkersOnlySource.addFeatures(features);
        this.refreshCombinedSettlementLabels();
    }

    /**
     * Add features to dwarf settlement layer
     * @param {array} features - Array of ol.Feature objects
     */
    addDwarfSettlementFeatures(features) {
        this.dwarfSettlementSource.addFeatures(features);
        // Also add to marker-only layer for always-visible markers
        this.dwarfSettlementMarkersOnlySource.addFeatures(features);
        this.refreshCombinedSettlementLabels();
    }

    /**
     * Add features to wood elf settlement layer
     * @param {array} features - Array of ol.Feature objects
     */
    addWoodElfSettlementFeatures(features) {
        this.woodElfSettlementSource.addFeatures(features);
        // Also add to marker-only layer for always-visible markers
        this.woodElfSettlementMarkersOnlySource.addFeatures(features);
        this.refreshCombinedSettlementLabels();
    }

    /**
     * Rebuild combined settlement label source from human, dwarf, and wood elf sources
     */
    refreshCombinedSettlementLabels() {
        if (!this.allSettlementLabelsSource) {
            return;
        }

        this.allSettlementLabelsSource.clear();
        this.allSettlementLabelsSource.addFeatures(this.settlementSource.getFeatures());
        this.allSettlementLabelsSource.addFeatures(this.dwarfSettlementSource.getFeatures());
        this.allSettlementLabelsSource.addFeatures(this.woodElfSettlementSource.getFeatures());
    }

    /**
     * Add features to POI layer
     * @param {array} features - Array of ol.Feature objects
     */
    addPOIFeatures(features) {
        this.poiSource.addFeatures(features);
    }

    /**
     * Add features to province layer
     * @param {array} features - Array of ol.Feature objects
     */
    addProvinceFeatures(features) {
        this.provinceSource.addFeatures(features);
    }

    /**
     * Add features to water layer
     * @param {array} features - Array of ol.Feature objects
     */
    addWaterFeatures(features) {
        this.waterSource.addFeatures(features);
    }

    /**
     * Set up event listeners for map
     */
    setupEventListeners() {
        // Update styles on zoom change
        this.map.getView().on('change:resolution', () => {
            this.allSettlementLabelsSource.changed();
            this.settlementSource.changed();
            this.settlementMarkersOnlySource.changed();
            this.dwarfSettlementSource.changed();
            this.dwarfSettlementMarkersOnlySource.changed();
            this.woodElfSettlementSource.changed();
            this.woodElfSettlementMarkersOnlySource.changed();
            this.provinceSource.changed();
            this.waterSource.changed();
        });
    }

    /**
     * Refresh settlement layer styling
     */
    refreshSettlementStyle() {
        this.settlementSource.changed();
    }

    /**
     * Zoom to feature
     * @param {ol.Feature} feature
     * @param {number} zoomLevel - Zoom resolution
     */
    zoomToFeature(feature, zoomLevel = 0.005) {
        const geometry = feature.getGeometry();
        const coordinates = geometry.getCoordinates();
        this.map.getView().animate({
            center: coordinates,
            resolution: zoomLevel,
            duration: 1000  // Increased from 500ms to 1500ms to ensure animation completes
        });
    }

    /**
     * Get map instance
     * @returns {ol.Map}
     */
    getMap() {
        return this.map;
    }

    /**
     * Get settlement source
     * @returns {ol.source.Vector}
     */
    getSettlementSource() {
        return this.settlementSource;
    }

    /**
     * Get settlement layer
     * @returns {ol.layer.Vector}
     */
    getSettlementLayer() {
        return this.settlementVectorLayer;
    }

    /**
     * Get POI source
     * @returns {ol.source.Vector}
     */
    getPOISource() {
        return this.poiSource;
    }

    /**
     * Get POI layer
     * @returns {ol.layer.Vector}
     */
    getPOILayer() {
        return this.poiVectorLayer;
    }
    
    /**
     * Get settlement markers only layer (always visible, no decluttering)
     * @returns {ol.layer.Vector}
     */
    getSettlementMarkersOnlyLayer() {
        return this.settlementMarkersOnlyLayer;
    }
    
    /**
     * Get province layer
     * @returns {ol.layer.Vector}
     */
    getProvinceLayer() {
        return this.provinceVectorLayer;
    }
    
    /**
     * Get water layer
     * @returns {ol.layer.Vector}
     */
    getWaterLayer() {
        return this.waterVectorLayer;
    }
    
    /**
     * Get dwarf settlement source
     * @returns {ol.source.Vector}
     */
    getDwarfSettlementSource() {
        return this.dwarfSettlementSource;
    }
    
    /**
     * Get dwarf settlement layer
     * @returns {ol.layer.Vector}
     */
    getDwarfSettlementLayer() {
        return this.dwarfSettlementVectorLayer;
    }
    
    /**
     * Get dwarf settlement markers only layer
     * @returns {ol.layer.Vector}
     */
    getDwarfSettlementMarkersOnlyLayer() {
        return this.dwarfSettlementMarkersOnlyLayer;
    }

    /**
     * Get wood elf settlement source
     * @returns {ol.source.Vector}
     */
    getWoodElfSettlementSource() {
        return this.woodElfSettlementSource;
    }

    /**
     * Get wood elf settlement layer
     * @returns {ol.layer.Vector}
     */
    getWoodElfSettlementLayer() {
        return this.woodElfSettlementVectorLayer;
    }

    /**
     * Get wood elf settlement markers only layer
     * @returns {ol.layer.Vector}
     */
    getWoodElfSettlementMarkersOnlyLayer() {
        return this.woodElfSettlementMarkersOnlyLayer;
    }
    
    /**
     * Get grid layer
     * @returns {ol.layer.Vector}
     */
    getGridLayer() {
        return this.gridVectorLayer;
    }
    
    /**
     * Get grid source
     * @returns {ol.source.Vector}
     */
    getGridSource() {
        return this.gridSource;
    }
}

// Create global instance
const mapManager = new MapManager();
