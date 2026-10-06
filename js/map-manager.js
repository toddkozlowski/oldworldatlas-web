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
        this.poiMarkersOnlyLayer = null;  // POI marker-only layer (no declutter)
        this.poiMarkersOnlySource = null;
        this.provinceVectorLayer = null;
        this.provinceSource = null;
        this.waterVectorLayer = null;
        this.waterSource = null;
        this.skavendomVectorLayer = null;
        this.skavendomSource = null;
        this.greenskinTribeVectorLayer = null;
        this.greenskinTribeSource = null;
        this.northmenTribeVectorLayer = null;
        this.northmenTribeSource = null;
        this.arabyTribeVectorLayer = null;
        this.arabyTribeSource = null;

        // Base (non-city-overlay) resolution limits and view options, needed to
        // rebuild the view when a city overlay temporarily relaxes minResolution.
        this.baseMinResolution = null;
        this.baseMaxResolution = null;
        this.bufferedExtent = null;
        this.currentMinResolution = null;
        this.resolutionChangeListeners = [];
        this.boundResolutionChangeHandler = () => {
            this.resolutionChangeListeners.forEach((listener) => listener());
        };
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
        const defaultCenter = MAP_VIEW_DEFAULT_CENTER;
        const bufferedExtent = getBufferedImageBounds();

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

        this.baseMinResolution = getTileResolution(MAP_VIEW_MAX_ZOOM);
        this.baseMaxResolution = getTileResolution(MAP_VIEW_MIN_ZOOM);
        this.bufferedExtent = bufferedExtent;
        this.currentMinResolution = this.baseMinResolution;

        this.gridSource = new ol.source.Vector();  // Grid overlay
        this.allSettlementLabelsSource = new ol.source.Vector();  // Combined labels for all settlement types
        this.settlementSource = new ol.source.Vector();
        this.settlementMarkersOnlySource = new ol.source.Vector();  // Markers only (no labels)
        this.dwarfSettlementSource = new ol.source.Vector();  // Dwarf settlements
        this.dwarfSettlementMarkersOnlySource = new ol.source.Vector();  // Dwarf markers only
        this.woodElfSettlementSource = new ol.source.Vector();  // Wood Elf settlements
        this.woodElfSettlementMarkersOnlySource = new ol.source.Vector();  // Wood Elf markers only
        this.poiSource = new ol.source.Vector();
        this.poiMarkersOnlySource = new ol.source.Vector();  // Markers only (no labels)
        this.provinceSource = new ol.source.Vector();
        this.waterSource = new ol.source.Vector();
        this.greenskinTribeSource = new ol.source.Vector();
        this.northmenTribeSource = new ol.source.Vector();
        this.arabyTribeSource = new ol.source.Vector();

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
                this.createPOIMarkersOnlyLayer(),  // POI markers only, always visible
                this.createPOILayer(),
                this.createSkavendomLayer(),   // rat-mode-only invisible click targets
                this.createGreenskinTribeLayer(),
                this.createNorthmenTribeLayer(),
                this.createArabyTribeLayer()
            ],
            view: this.buildView({
                center: this.isMobilePortrait() ? defaultCenter : [2.7, defaultCenter[1]],
                resolution: this.isMobilePortrait() ? 0.0075 : 0.018, // Resolution for desktop: 0.075015, for mobile portrait: 0.020
                minResolution: this.baseMinResolution,
            })
        });

        this.bindResolutionListener();

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
        this.poiMarkersOnlyLayer = this.map.getLayers().item(10);
        this.poiVectorLayer = this.map.getLayers().item(11);
        this.skavendomVectorLayer = this.map.getLayers().item(12);
        this.greenskinTribeVectorLayer = this.map.getLayers().item(13);
        this.northmenTribeVectorLayer = this.map.getLayers().item(14);
        this.arabyTribeVectorLayer = this.map.getLayers().item(15);

        const desktopPOICheckbox = document.getElementById('poi-checkbox');
        const mobilePOICheckbox = document.getElementById('mobile-poi-checkbox');
        const isPOIVisibleByDefault = desktopPOICheckbox?.checked ?? mobilePOICheckbox?.checked ?? false;

        this.poiVectorLayer.setVisible(isPOIVisibleByDefault);
        this.poiMarkersOnlyLayer.setVisible(isPOIVisibleByDefault);


        return this.map;
    }

    /**
     * Build a view with the standard base map/rotation/extent options, plus
     * whatever caller-supplied options (center, resolution, minResolution).
     * Pulled out so the view can be rebuilt with a different minResolution
     * (see setMinResolutionOverride) without duplicating its fixed options.
     * @private
     * @param {object} options - center, resolution, minResolution
     * @returns {ol.View}
     */
    buildView(options) {
        return new ol.View({
            center: options.center,
            resolution: options.resolution,
            maxResolution: this.baseMaxResolution,
            minResolution: options.minResolution,
            extent: this.bufferedExtent,
            enableRotation: false,  // Disable rotation for better mobile performance
            constrainRotation: false
        });
    }

    /**
     * (Re)attach the internal 'change:resolution' dispatcher to whichever
     * view is currently active. Must be called again after any setView(),
     * since OL view listeners don't carry over to a replacement view.
     * @private
     */
    bindResolutionListener() {
        // The previous view (if any) is discarded by setView() and holds no
        // other references, so its listener simply stops firing; no need to
        // explicitly unbind it.
        this.map.getView().on('change:resolution', this.boundResolutionChangeHandler);
    }

    /**
     * Subscribe to view resolution changes. Survives view swaps triggered by
     * setMinResolutionOverride (unlike listening on getView() directly).
     * @param {function} callback
     */
    onResolutionChange(callback) {
        this.resolutionChangeListeners.push(callback);
    }

    /**
     * Relax or restore the view's minResolution (how far in the user is
     * allowed to zoom). Used to let city overlays be viewed at their native
     * detail, which is finer than the continent tile pyramid's normal floor.
     * OL's View has no live setter for minResolution, so this rebuilds the
     * view in place, preserving current center/resolution/rotation.
     * @param {number|null} minResolution - null (or omitted) resets to the base map's normal minResolution
     */
    setMinResolutionOverride(minResolution) {
        const targetMinResolution = minResolution ?? this.baseMinResolution;
        if (targetMinResolution === this.currentMinResolution) {
            return;
        }
        this.currentMinResolution = targetMinResolution;

        const oldView = this.map.getView();
        const newView = this.buildView({
            center: oldView.getCenter(),
            // Keep current resolution, but pull it back within the new floor
            // when restoring the normal (coarser) limit after zooming deep.
            resolution: Math.max(oldView.getResolution(), targetMinResolution),
            minResolution: targetMinResolution,
        });

        this.map.setView(newView);
        this.bindResolutionListener();
    }

    /**
     * Create the base map tile layers:
     * - base: z0-6 over the whole extent; OpenLayers enlarges z6 when zoomed further in
     * - detail: z7-8, which only exist inside the detail box, drawn on top once zoomed past z6
     * - rat mode: its own tiles on the previous grid, shown instead of the other two
     * @private
     * @returns {ol.layer.Group}
     */
    createTileLayer() {
        const tileUrlFor = (directory) => (tileCoord) =>
            `https://raw.githubusercontent.com/toddkozlowski/oldworldatlas-repository/main/${directory}` +
            `/${tileCoord[0]}/${tileCoord[1]}/${-1 - tileCoord[2]}.png?v=${MAP_TILE_VERSION}`;

        const createSource = (directory, extent, resolutions) => new ol.source.TileImage({
            attributions: '',
            crossOrigin: 'anonymous',
            tileGrid: new ol.tilegrid.TileGrid({
                extent: extent,
                origin: [extent[0], extent[1]],
                resolutions: resolutions,
                tileSize: [MAP_TILE_SIZE, MAP_TILE_SIZE]
            }),
            tileUrlFunction: tileUrlFor(directory)
        });

        this.baseTileLayer = new ol.layer.Tile({
            source: createSource(MAP_TILE_DIRECTORY, IMAGE_BOUNDS, getTileResolutions(MAP_TILE_BASE_MAX_ZOOM))
        });

        this.detailTileLayer = new ol.layer.Tile({
            extent: MAP_TILE_DETAIL_EXTENT,
            maxResolution: getTileResolution(MAP_TILE_BASE_MAX_ZOOM),  // only drawn when zoomed in past z6
            source: createSource(MAP_TILE_DIRECTORY, IMAGE_BOUNDS, getTileResolutions(MAP_TILE_DETAIL_MAX_ZOOM))
        });

        this.ratModeTileLayer = new ol.layer.Tile({
            visible: false,
            source: createSource(RAT_MODE_TILE_DIRECTORY, RAT_MODE_TILE_BOUNDS, getRatModeTileResolutions())
        });

        this.tileLayer = new ol.layer.Group({
            title: 'Map Tiles',
            layers: [this.baseTileLayer, this.detailTileLayer, this.ratModeTileLayer]
        });

        return this.tileLayer;
    }

    getTileLayer() {
        return this.tileLayer;
    }

    setRatMode(ratMode) {
        this.baseTileLayer.setVisible(!ratMode);
        this.detailTileLayer.setVisible(!ratMode);
        this.ratModeTileLayer.setVisible(ratMode);
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
        const getPriority = (feature) => {
            if (typeof getSettlementDeclutterPriority === 'function') {
                return getSettlementDeclutterPriority(feature);
            }

            const featureType = feature.get('featureType');
            if (featureType === 'dwarf') {
                return feature.get('dwarfType') === 'Karak' ? 3 : 2;
            }
            if (featureType === 'woodelf') {
                return 3;
            }
            if (featureType === 'poi') {
                return 2.5;
            }

            const sizeCategory = parseInt(feature.get('sizeCategory'), 10);
            if (sizeCategory >= 6) return 6;
            if (sizeCategory === 5) return 5;
            if (sizeCategory === 4) return 4;
            if (sizeCategory === 3) return 3;
            if (sizeCategory === 2) return 2;
            return 1;
        };

        const getPopulationTieBreaker = (feature) => {
            const featureType = feature.get('featureType');
            if (featureType === 'dwarf' || featureType === 'woodelf' || featureType === 'poi') {
                return 0;
            }
            return Number(feature.get('population')) || 0;
        };

        return new ol.layer.Vector({
            title: 'Settlements (Size 3+)',
            source: this.allSettlementLabelsSource,
            declutter: 'settlement-labels', // Shared declutter group for all settlement labels
            renderOrder: (a, b) => {
                const priorityDelta = getPriority(b) - getPriority(a);
                if (priorityDelta !== 0) {
                    return priorityDelta;
                }

                const popDelta = getPopulationTieBreaker(b) - getPopulationTieBreaker(a);
                if (popDelta !== 0) {
                    return popDelta;
                }

                const nameA = String(a.get('name') || '');
                const nameB = String(b.get('name') || '');
                return nameA.localeCompare(nameB);
            },
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
            declutter: false,
            updateWhileAnimating: false,  // Performance: don't update during animation
            updateWhileInteracting: false, // Performance: don't update while panning/zooming
            renderBuffer: 100,             // Render features slightly outside viewport
            style: () => null
        });
    }

    /**
     * Create POI markers-only vector layer (no labels, no declutter) - keeps
     * a POI's icon/dot visible even when its label gets decluttered away by
     * the combined settlement/POI label layer.
     * @private
     * @returns {ol.layer.Vector}
     */
    createPOIMarkersOnlyLayer() {
        return new ol.layer.Vector({
            title: 'POI Markers',
            source: this.poiMarkersOnlySource,
            updateWhileAnimating: false,
            updateWhileInteracting: false,
            renderBuffer: 100,
            style: (feature) => createPOIMarkerOnlyStyle(feature, this.map.getView().getResolution())
        });
    }

    createSkavendomLayer() {
        this.skavendomSource = new ol.source.Vector();
        return new ol.layer.Vector({
            title: 'Skavendom',
            source: this.skavendomSource,
            visible: false,
            style: new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 20,
                    fill: new ol.style.Fill({ color: 'rgba(0, 0, 0, 0.01)' })
                })
            })
        });
    }

    getSkavendomSource() { return this.skavendomSource; }
    getSkavendomLayer()  { return this.skavendomVectorLayer; }
    setSkavendomVisible(visible) {
        if (this.skavendomVectorLayer) this.skavendomVectorLayer.setVisible(visible);
    }

    createGreenskinTribeLayer() {
        return new ol.layer.Vector({
            title: 'Greenskin Tribes',
            source: this.greenskinTribeSource,
            updateWhileAnimating: false,
            updateWhileInteracting: false,
            style: (feature) => createTribeStyle(feature, this.map.getView().getResolution())
        });
    }

    createNorthmenTribeLayer() {
        return new ol.layer.Vector({
            title: 'Northmen Tribes',
            source: this.northmenTribeSource,
            updateWhileAnimating: false,
            updateWhileInteracting: false,
            style: (feature) => createTribeStyle(feature, this.map.getView().getResolution())
        });
    }

    createArabyTribeLayer() {
        return new ol.layer.Vector({
            title: 'Araby Tribes',
            source: this.arabyTribeSource,
            updateWhileAnimating: false,
            updateWhileInteracting: false,
            style: (feature) => createTribeStyle(feature, this.map.getView().getResolution())
        });
    }

    /**
     * Replace the features in all tribe layers with the current tribeData features
     * @param {TribeData} tribes - Tribe data manager
     */
    setTribeFeatures(tribes) {
        this.greenskinTribeSource.clear();
        this.greenskinTribeSource.addFeatures(tribes.getGreenskinTribeFeatures());
        this.northmenTribeSource.clear();
        this.northmenTribeSource.addFeatures(tribes.getNorthmenTribeFeatures());
        this.arabyTribeSource.clear();
        this.arabyTribeSource.addFeatures(tribes.getArabyTribeFeatures());
    }

    getGreenskinTribeLayer() { return this.greenskinTribeVectorLayer; }
    getNorthmenTribeLayer()  { return this.northmenTribeVectorLayer; }
    getArabyTribeLayer()     { return this.arabyTribeVectorLayer; }

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

        const allFeatures = [
            ...this.settlementSource.getFeatures(),
            ...this.dwarfSettlementSource.getFeatures(),
            ...this.woodElfSettlementSource.getFeatures(),
            ...this.poiSource.getFeatures()
        ];

        const getPriority = (feature) => {
            if (typeof getSettlementDeclutterPriority === 'function') {
                return getSettlementDeclutterPriority(feature);
            }

            // Fallback priority logic matching styling.js if that function is unavailable.
            const featureType = feature.get('featureType');
            if (featureType === 'dwarf') {
                const dwarfType = feature.get('dwarfType');
                return dwarfType === 'Karak' ? 3 : 2;
            }
            if (featureType === 'woodelf') {
                return 3;
            }
            if (featureType === 'poi') {
                return 2.5;
            }

            const sizeCategory = parseInt(feature.get('sizeCategory'), 10);
            if (sizeCategory >= 6) return 6;
            if (sizeCategory === 5) return 5;
            if (sizeCategory === 4) return 4;
            if (sizeCategory === 3) return 3;
            if (sizeCategory === 2) return 2;
            return 1;
        };

        // Add in descending priority so higher-priority labels are processed first.
        allFeatures.sort((a, b) => getPriority(b) - getPriority(a));
        this.allSettlementLabelsSource.addFeatures(allFeatures);
    }

    /**
     * Add features to POI layer
     * @param {array} features - Array of ol.Feature objects
     */
    addPOIFeatures(features) {
        this.poiSource.addFeatures(features);
        // Also add to marker-only layer for always-visible markers
        this.poiMarkersOnlySource.addFeatures(features);
        this.refreshCombinedSettlementLabels();
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
        this.onResolutionChange(() => this.refreshAllStyles());
    }

    /**
     * Force every feature layer to re-evaluate its style function. Needed
     * whenever something a style function reads changes without OL knowing
     * about it - map resolution (handled automatically via
     * onResolutionChange) as well as external toggles like the visual
     * options panel (simple icons, large icons, font, text outline).
     */
    refreshAllStyles() {
        this.allSettlementLabelsSource.changed();
        this.settlementSource.changed();
        this.settlementMarkersOnlySource.changed();
        this.dwarfSettlementSource.changed();
        this.dwarfSettlementMarkersOnlySource.changed();
        this.woodElfSettlementSource.changed();
        this.woodElfSettlementMarkersOnlySource.changed();
        this.poiSource.changed();
        this.poiMarkersOnlySource.changed();
        this.provinceSource.changed();
        this.waterSource.changed();
        this.greenskinTribeSource.changed();
        this.northmenTribeSource.changed();
        this.arabyTribeSource.changed();
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
     * Get POI markers-only layer (always visible, no decluttering)
     * @returns {ol.layer.Vector}
     */
    getPOIMarkersOnlyLayer() {
        return this.poiMarkersOnlyLayer;
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
