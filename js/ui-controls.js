/**
 * UI controls management for Old World Atlas
 */

class UIControls {
    constructor() {
        this.popupElement = null;
        this.popupOverlay = null;
        this.settlementCheckbox = null;
        this.poiCheckbox = null;
        this.settlementSubCheckboxes = [];
        this.poiSubCheckboxes = [];
        this.regionCheckbox = null;
        this.waterCheckbox = null;
        this.publishedCanonOnlyCheckbox = null;
        this.selectedFeature = null;  // Track currently selected/highlighted feature

        this.settlementSizeConfig = [
            { id: 'settlement-size-villages', value: 1, label: 'Villages' },
            { id: 'settlement-size-small-towns', value: 2, label: 'Small Towns' },
            { id: 'settlement-size-towns', value: 3, label: 'Towns' },
            { id: 'settlement-size-large-towns', value: 4, label: 'Large Towns' },
            { id: 'settlement-size-cities', value: 5, label: 'Cities' },
            { id: 'settlement-size-metropolises', value: 6, label: 'Metropolises' }
        ];

        this.settlementRegionConfig = [
            { id: 'settlement-region-empire', value: 'empire', label: 'The Empire', kind: 'human' },
            { id: 'settlement-region-bretonnia', value: 'bretonnia', label: 'Bretonnia', kind: 'human' },
            { id: 'settlement-region-kislev', value: 'kislev', label: 'Kislev', kind: 'human' },
            { id: 'settlement-region-norsca', value: 'norsca', label: 'Norsca', kind: 'human' },
            { id: 'settlement-region-tilea', value: 'tilea', label: 'Tilea', kind: 'human' },
            { id: 'settlement-region-estalia', value: 'estalia', label: 'Estalia', kind: 'human' },
            { id: 'settlement-region-border-princes', value: 'border-princes', label: 'Border Princes', kind: 'human' },
            { id: 'settlement-region-albion', value: 'albion', label: 'Albion', kind: 'human' },
            { id: 'settlement-region-karaz-ankor', value: 'karaz-ankor', label: 'The Karaz-Ankor', kind: 'dwarf' },
            { id: 'settlement-region-wood-elf-realms', value: 'wood-elf-realms', label: 'Wood Elf Realms', kind: 'woodelf' }
        ];
    }

    /**
     * Initialize UI controls
     * @param {ol.Map} map - OpenLayers map instance
     */
    initialize(map) {
        this.initializeExpandableFilters();
        this.initializeSettlementSubFilters();
        this.initializePOISubFilters();
        this.initializeSettlementToggle();
        this.initializePOIToggle();
        this.initializeRegionToggle();
        this.initializeWaterToggle();
        this.initializePublishedCanonOnlyToggle();
        this.initializeGridControls();
        this.initializePopup(map);
        this.initializeMeasurementButton();
    }

    /**
     * Initialize settlement toggle checkbox
     * @private
     */
    initializeSettlementToggle() {
        this.settlementCheckbox = document.getElementById('settlement-checkbox');
        if (this.settlementCheckbox) {
            this.settlementCheckbox.addEventListener('change', () => {
                const parentEnabled = this.settlementCheckbox.checked;
                this.settlementSubCheckboxes.forEach(checkbox => {
                    checkbox.checked = parentEnabled;
                });
                this.applySettlementFilters();
            });
            this.applySettlementFilters();
        }
    }

    /**
     * Initialize POI toggle checkbox
     * @private
     */
    initializePOIToggle() {
        this.poiCheckbox = document.getElementById('poi-checkbox');
        if (this.poiCheckbox) {
            this.poiCheckbox.addEventListener('change', () => {
                const parentEnabled = this.poiCheckbox.checked;
                this.poiSubCheckboxes.forEach(checkbox => {
                    checkbox.checked = parentEnabled;
                });
                this.applyPOIFilters();
            });
            this.applyPOIFilters();
        }
    }

    /**
     * Initialize expandable filter sections.
     * @private
     */
    initializeExpandableFilters() {
        const toggles = [
            { buttonId: 'settlement-expand-toggle', panelId: 'settlement-subfilters-panel' },
            { buttonId: 'poi-expand-toggle', panelId: 'poi-subfilters-panel' }
        ];

        toggles.forEach(({ buttonId, panelId }) => {
            const button = document.getElementById(buttonId);
            const panel = document.getElementById(panelId);

            if (!button || !panel) {
                return;
            }

            button.addEventListener('click', () => {
                const expanded = button.getAttribute('aria-expanded') === 'true';
                button.setAttribute('aria-expanded', String(!expanded));
                panel.classList.toggle('expanded', !expanded);
            });
        });
    }

    /**
     * Initialize settlement sub-filter checkboxes.
     * @private
     */
    initializeSettlementSubFilters() {
        const allIds = [
            ...this.settlementSizeConfig.map(item => item.id),
            ...this.settlementRegionConfig.map(item => item.id)
        ];

        this.settlementSubCheckboxes = allIds
            .map(id => document.getElementById(id))
            .filter(Boolean);

        this.settlementSubCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applySettlementFilters());
        });
    }

    /**
     * Initialize POI sub-filters from loaded POI type categories.
     * @private
     */
    initializePOISubFilters() {
        const container = document.getElementById('poi-subfilters-container');
        if (!container || typeof poiData === 'undefined') {
            return;
        }

        const types = poiData.getAvailableTypes();
        container.innerHTML = '';
        this.poiSubCheckboxes = [];

        types.forEach(type => {
            const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const inputId = `poi-type-${slug}`;

            const row = document.createElement('div');
            row.className = 'toggle-item sub-toggle-item';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = inputId;
            input.checked = true;
            input.dataset.poiType = type;

            const label = document.createElement('label');
            label.htmlFor = inputId;
            label.textContent = type;

            row.appendChild(input);
            row.appendChild(label);
            container.appendChild(row);

            input.addEventListener('change', () => this.applyPOIFilters());
            this.poiSubCheckboxes.push(input);
        });
    }

    /**
     * Apply settlement filters with AND logic across selected size and region categories.
     * @private
     */
    applySettlementFilters() {
        if (!this.settlementCheckbox) {
            return;
        }

        const parentEnabled = this.settlementCheckbox.checked;
        this.setSettlementSubfilterEnabled(parentEnabled);

        const selectedSizes = this.settlementSizeConfig
            .map(item => ({ ...item, checkbox: document.getElementById(item.id) }))
            .filter(item => item.checkbox && item.checkbox.checked)
            .map(item => item.value);

        const selectedHumanRegions = this.settlementRegionConfig
            .map(item => ({ ...item, checkbox: document.getElementById(item.id) }))
            .filter(item => item.kind === 'human' && item.checkbox && item.checkbox.checked)
            .map(item => item.value);

        const karazEnabled = !!document.getElementById('settlement-region-karaz-ankor')?.checked;
        const woodElfEnabled = !!document.getElementById('settlement-region-wood-elf-realms')?.checked;

        settlementData.setEnabledSizeCategories(parentEnabled ? selectedSizes : []);
        settlementData.setEnabledRegions(parentEnabled ? selectedHumanRegions : []);

        const humanFeatures = parentEnabled ? settlementData.getOLFeatures() : [];
        const humanSource = mapManager.getSettlementSource();
        const humanMarkerLayer = mapManager.getSettlementMarkersOnlyLayer();

        if (humanSource) {
            humanSource.clear();
            humanSource.addFeatures(humanFeatures);
        }
        if (humanMarkerLayer) {
            const source = humanMarkerLayer.getSource();
            source.clear();
            source.addFeatures(humanFeatures);
        }

        const dwarfFeatures = parentEnabled && karazEnabled ? dwarfSettlementData.getOLFeatures() : [];
        const dwarfSource = mapManager.getDwarfSettlementSource();
        const dwarfMarkerLayer = mapManager.getDwarfSettlementMarkersOnlyLayer();
        if (dwarfSource) {
            dwarfSource.clear();
            dwarfSource.addFeatures(dwarfFeatures);
        }
        if (dwarfMarkerLayer) {
            const source = dwarfMarkerLayer.getSource();
            source.clear();
            source.addFeatures(dwarfFeatures);
        }

        const woodElfFeatures = parentEnabled && woodElfEnabled ? woodElfSettlementData.getOLFeatures() : [];
        const woodElfSource = mapManager.getWoodElfSettlementSource();
        const woodElfMarkerLayer = mapManager.getWoodElfSettlementMarkersOnlyLayer();
        if (woodElfSource) {
            woodElfSource.clear();
            woodElfSource.addFeatures(woodElfFeatures);
        }
        if (woodElfMarkerLayer) {
            const source = woodElfMarkerLayer.getSource();
            source.clear();
            source.addFeatures(woodElfFeatures);
        }

        const humanLayer = mapManager.getSettlementLayer();
        const dwarfLayer = mapManager.getDwarfSettlementLayer();
        const woodElfLayer = mapManager.getWoodElfSettlementLayer();
        if (humanLayer) humanLayer.setVisible(true);
        if (humanMarkerLayer) humanMarkerLayer.setVisible(parentEnabled);
        if (dwarfLayer) dwarfLayer.setVisible(false);
        if (dwarfMarkerLayer) dwarfMarkerLayer.setVisible(parentEnabled);
        if (woodElfLayer) woodElfLayer.setVisible(false);
        if (woodElfMarkerLayer) woodElfMarkerLayer.setVisible(parentEnabled);

        mapManager.refreshCombinedSettlementLabels();
        if (window.searchManager && typeof window.searchManager.buildFeatureIndex === 'function') {
            window.searchManager.buildFeatureIndex();
        }
    }

    /**
     * Apply POI type filters.
     * @private
     */
    applyPOIFilters() {
        if (!this.poiCheckbox) {
            return;
        }

        const parentEnabled = this.poiCheckbox.checked;
        this.setPOISubfilterEnabled(parentEnabled);

        const selectedTypes = parentEnabled
            ? this.poiSubCheckboxes.filter(input => input.checked).map(input => input.dataset.poiType)
            : [];

        poiData.setEnabledTypes(selectedTypes);

        const poiFeatures = parentEnabled ? poiData.getOLFeatures() : [];
        const poiSource = mapManager.getPOISource();
        if (poiSource) {
            poiSource.clear();
            poiSource.addFeatures(poiFeatures);
        }

        const poiLayer = mapManager.getPOILayer();
        if (poiLayer) {
            poiLayer.setVisible(parentEnabled);
        }

        const combinedLabelLayer = mapManager.getSettlementLayer();
        if (combinedLabelLayer) {
            combinedLabelLayer.setVisible(true);
        }

        mapManager.refreshCombinedSettlementLabels();
        if (window.searchManager && typeof window.searchManager.buildFeatureIndex === 'function') {
            window.searchManager.buildFeatureIndex();
        }
    }

    /**
     * Enable/disable settlement subfilters based on parent toggle.
     * @private
     * @param {boolean} enabled
     */
    setSettlementSubfilterEnabled(enabled) {
        this.settlementSubCheckboxes.forEach(checkbox => {
            checkbox.disabled = !enabled;
        });
    }

    /**
     * Enable/disable POI subfilters based on parent toggle.
     * @private
     * @param {boolean} enabled
     */
    setPOISubfilterEnabled(enabled) {
        this.poiSubCheckboxes.forEach(checkbox => {
            checkbox.disabled = !enabled;
        });
    }

    /**
     * Initialize region toggle checkbox
     * @private
     */
    initializeRegionToggle() {
        this.regionCheckbox = document.getElementById('region-checkbox');
        if (this.regionCheckbox) {
            this.regionCheckbox.addEventListener('change', (e) => {
                const layer = mapManager.getProvinceLayer();
                if (layer) {
                    layer.setVisible(e.target.checked);
                }
            });
        }
    }

    /**
     * Initialize water toggle checkbox
     * @private
     */
    initializeWaterToggle() {
        this.waterCheckbox = document.getElementById('water-checkbox');
        if (this.waterCheckbox) {
            this.waterCheckbox.addEventListener('change', (e) => {
                const layer = mapManager.getWaterLayer();
                if (layer) {
                    layer.setVisible(e.target.checked);
                }
            });
        }
    }

    /**
     * Initialize measurement button
     * @private
     */
    initializeMeasurementButton() {
        const button = document.getElementById('measure-button');
        const mobileButton = document.getElementById('mobile-measure-button');
        const clearButton = document.getElementById('clear-measure-button');
        const mobileClearButton = document.getElementById('mobile-clear-measure-button');
        
        if (button) {
            button.addEventListener('click', () => {
                if (typeof measurementTool !== 'undefined') {
                    measurementTool.toggle();
                }
            });
        }
        
        if (mobileButton) {
            mobileButton.addEventListener('click', () => {
                if (typeof measurementTool !== 'undefined') {
                    measurementTool.toggle();
                }
            });
        }
        
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                if (typeof measurementTool !== 'undefined') {
                    measurementTool.clearMeasurements();
                }
            });
        }
        
        if (mobileClearButton) {
            mobileClearButton.addEventListener('click', () => {
                if (typeof measurementTool !== 'undefined') {
                    measurementTool.clearMeasurements();
                }
            });
        }
    }

    /**
     * Initialize Published Canon Only toggle checkbox
     * @private
     */
    initializePublishedCanonOnlyToggle() {
        const desktopCheckbox = document.getElementById('published-canon-only-checkbox');
        const mobileCheckbox = document.getElementById('mobile-published-canon-only-checkbox');
        
        const handleToggle = (e) => {
            const enabled = e.target.checked;
            settlementData.setPublishedCanonOnly(enabled);
            dwarfSettlementData.setPublishedCanonOnly(enabled);
            
            // Update both checkboxes to stay in sync
            if (desktopCheckbox) desktopCheckbox.checked = enabled;
            if (mobileCheckbox) mobileCheckbox.checked = enabled;
            
            this.applySettlementFilters();
        };
        
        if (desktopCheckbox) {
            desktopCheckbox.addEventListener('change', handleToggle);
        }
        if (mobileCheckbox) {
            mobileCheckbox.addEventListener('change', handleToggle);
        }
    }

    /**
     * Initialize grid overlay controls
     * @private
     */
    initializeGridControls() {
        // Get all grid control elements
        const gridOffBtn = document.getElementById('grid-off');
        const gridSquareBtn = document.getElementById('grid-square');
        const gridSizeInput = document.getElementById('grid-size');
        const gridUnitLabel = document.getElementById('grid-unit-label');
        
        const mobileGridOffBtn = document.getElementById('mobile-grid-off');
        const mobileGridSquareBtn = document.getElementById('mobile-grid-square');
        const mobileGridSizeInput = document.getElementById('mobile-grid-size');
        const mobileGridUnitLabel = document.getElementById('mobile-grid-unit-label');
        
        // Load saved preferences or use defaults (default to miles)
        let currentGridType = localStorage.getItem('grid_type') || 'off';
        // Reset to 'off' if saved type was 'hex' (no longer supported)
        if (currentGridType === 'hex') {
            currentGridType = 'off';
        }
        let currentGridSize = parseInt(localStorage.getItem('grid_size')) || 100;
        
        // Clamp grid size to valid range
        if (currentGridSize < 5) currentGridSize = 5;
        if (currentGridSize > 1000) currentGridSize = 1000;
        
        // Get current units
        const getCurrentUnit = () => {
            return window.getCurrentUnits ? window.getCurrentUnits() : 'miles';
        };
        
        // Update unit labels
        const updateUnitLabels = () => {
            const units = getCurrentUnit();
            const label = units === 'kilometers' ? 'km' : 'mi';
            if (gridUnitLabel) gridUnitLabel.textContent = label;
            if (mobileGridUnitLabel) mobileGridUnitLabel.textContent = label;
        };
        
        // Update UI to reflect current state
        const updateGridUI = () => {
            // Desktop buttons
            if (gridOffBtn) gridOffBtn.classList.toggle('active', currentGridType === 'off');
            if (gridSquareBtn) gridSquareBtn.classList.toggle('active', currentGridType === 'square');
            if (gridSizeInput) gridSizeInput.value = currentGridSize;
            
            // Mobile buttons
            if (mobileGridOffBtn) mobileGridOffBtn.classList.toggle('active', currentGridType === 'off');
            if (mobileGridSquareBtn) mobileGridSquareBtn.classList.toggle('active', currentGridType === 'square');
            if (mobileGridSizeInput) mobileGridSizeInput.value = currentGridSize;
            
            // Update unit labels
            updateUnitLabels();
        };
        
        // Update grid overlay
        const updateGrid = () => {
            localStorage.setItem('grid_type', currentGridType);
            localStorage.setItem('grid_size', currentGridSize.toString());
            updateGridUI();
            
            // Update the grid overlay with current unit
            if (typeof gridOverlay !== 'undefined') {
                const units = getCurrentUnit();
                gridOverlay.updateGrid(currentGridType, currentGridSize, units);
            }
        };
        
        // Set grid type
        const setGridType = (type) => {
            currentGridType = type;
            updateGrid();
        };
        
        // Set grid size
        const setGridSize = (size) => {
            // Clamp to valid range
            if (size < 5) size = 5;
            if (size > 1000) size = 1000;
            currentGridSize = size;
            updateGrid();
        };
        
        // Desktop button event listeners
        if (gridOffBtn) {
            gridOffBtn.addEventListener('click', () => setGridType('off'));
        }
        if (gridSquareBtn) {
            gridSquareBtn.addEventListener('click', () => setGridType('square'));
        }
        if (gridSizeInput) {
            gridSizeInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                    setGridSize(value);
                }
            });
            // Also update on input for real-time feedback
            gridSizeInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 5 && value <= 1000) {
                    setGridSize(value);
                }
            });
        }
        
        // Mobile button event listeners
        if (mobileGridOffBtn) {
            mobileGridOffBtn.addEventListener('click', () => setGridType('off'));
        }
        if (mobileGridSquareBtn) {
            mobileGridSquareBtn.addEventListener('click', () => setGridType('square'));
        }
        if (mobileGridSizeInput) {
            mobileGridSizeInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                    setGridSize(value);
                }
            });
            // Also update on input for real-time feedback
            mobileGridSizeInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 5 && value <= 1000) {
                    setGridSize(value);
                }
            });
        }
        
        // Listen for unit changes and update grid
        window.addEventListener('unitsChanged', () => {
            updateUnitLabels();
            // Update the grid with new units (size stays the same, just different interpretation)
            updateGrid();
        });
        
        // Initialize UI
        updateGridUI();
        
        // Expose method to get current grid settings
        window.getCurrentGridType = () => currentGridType;
        window.getCurrentGridSize = () => currentGridSize;
    }

    /**
     * Initialize popup overlay
     * @private
     * @param {ol.Map} map - OpenLayers map instance
     */
    initializePopup(map) {
        this.popupElement = document.createElement('div');
        this.popupElement.id = 'popup';
        this.popupElement.className = 'ol-popup';
        this.popupElement.style.cssText = 'position: absolute; background-color: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 0 10px rgba(0,0,0,0.2); display: none; z-index: 100;';
        document.body.appendChild(this.popupElement);

        this.popupOverlay = new ol.Overlay({
            element: this.popupElement,
            autoPan: true,
            autoPanAnimation: {
                duration: 250
            }
        });
        map.addOverlay(this.popupOverlay);

        // Handle clicks on features
        map.on('click', (evt) => this.handleMapClick(evt));
    }

    /**
     * Handle map click events
     * @private
     * @param {ol.MapBrowserEvent} evt
     */
    handleMapClick(evt) {
        // Don't show popups if measurement tool is active
        if (typeof measurementTool !== 'undefined' && measurementTool.isToolActive()) {
            return;
        }
        
        let feature = null;
        mapManager.getMap().forEachFeatureAtPixel(evt.pixel, (f) => {
            feature = f;
            return true; // Stop iteration
        });

        if (feature && feature.get('name')) {
            // Clear any previous selection when clicking a feature
            if (window.searchManager) {
                window.searchManager.clearSelection();
            }
            this.showSettlementPopup(feature, evt.coordinate);
        } else {
            this.hidePopup();
        }
    }

    /**
     * Show feature from search (zoom, center, popup, and highlight)
     * @param {ol.Feature} feature - Feature to show
     * @param {array} coordinate - Map coordinate [lon, lat]
     */
    showFeatureFromSearch(feature, coordinate) {
        // Debug logging
        console.log('showFeatureFromSearch called', { feature, coordinate });
        console.log('mapManager exists:', typeof mapManager !== 'undefined');
        
        // Zoom and center to feature using mapManager
        if (typeof mapManager !== 'undefined' && mapManager.zoomToFeature) {
            console.log('Calling mapManager.zoomToFeature');
            mapManager.zoomToFeature(feature, 0.0015);
        } else {
            console.error('mapManager or zoomToFeature not available');
        }
        
        // Show popup
        this.showSettlementPopup(feature, coordinate);
    }
    
    /**
     * Show settlement information popup
     * @param {ol.Feature} feature - Settlement feature
     * @param {array} coordinate - Map coordinate [lon, lat]
     */
    showSettlementPopup(feature, coordinate) {
        const name = feature.get('name');
        const featureType = feature.get('featureType');
        
        // Handle dwarf settlement features
        if (featureType === 'dwarf') {
            const dwarfHoldType = feature.get('dwarfHoldType');
            const sourceTag = feature.get('sourceTag');
            const wikiTitle = feature.get('wikiTitle');
            const wikiUrl = feature.get('wikiUrl');
            const wikiDescription = feature.get('wikiDescription');
            
            // Check if settlement has wiki data
            const hasWiki = wikiTitle && wikiTitle.trim() !== '';
            
            // Build header with title and subtitle
            let html = `<div class="settlement-popup">
                <div class="settlement-popup-header">
                    <h2 class="settlement-popup-title">${this.escapeHtml(name)}</h2>
                    <p class="settlement-popup-subtitle">${this.escapeHtml(dwarfHoldType)}</p>
                </div>`;
            
            // Add wiki section if available
            if (hasWiki) {
                html += `<div class="settlement-popup-wiki">`;
                
                // Add wiki title
                html += `<div class="settlement-popup-wiki-title">${this.escapeHtml(wikiTitle)}</div>`;
                
                // Add wiki description if available
                if (wikiDescription && wikiDescription.trim() !== '') {
                    html += `<div class="settlement-popup-wiki-description">${this.escapeHtml(wikiDescription)}</div>`;
                }
                
                // Add wiki link if available
                if (wikiUrl && wikiUrl.trim() !== '') {
                    html += `<a href="${this.escapeHtml(wikiUrl)}" target="_blank" class="settlement-popup-wiki-link">Read on Wiki</a>`;
                }
                
                html += `</div>`;
            }
            
            // Add source field at bottom as footnote if present
            if (sourceTag) {
                const fullSourceName = dwarfSettlementData.getFullSourceName(sourceTag);
                html += `<div class="settlement-popup-source">Source: ${this.escapeHtml(fullSourceName)}</div>`;
            }
            
            html += '</div>';
            
            this.popupElement.innerHTML = html;
            this.popupOverlay.setPosition(coordinate);
            this.popupElement.style.display = 'block';
            return;
        }

        // Handle wood elf settlement features
        if (featureType === 'woodelf') {
            const settlementType = feature.get('settlementType');
            const sourceTag = feature.get('sourceTag');
            const wikiTitle = feature.get('wikiTitle');
            const wikiUrl = feature.get('wikiUrl');
            const wikiDescription = feature.get('wikiDescription');

            const hasWiki = wikiTitle && wikiTitle.trim() !== '';

            let html = `<div class="settlement-popup">
                <div class="settlement-popup-header">
                    <h2 class="settlement-popup-title">${this.escapeHtml(name)}</h2>
                    <p class="settlement-popup-subtitle">${this.escapeHtml(settlementType || 'Wood Elf Settlement')}</p>
                </div>`;

            if (hasWiki) {
                html += `<div class="settlement-popup-wiki">`;
                html += `<div class="settlement-popup-wiki-title">${this.escapeHtml(wikiTitle)}</div>`;
                if (wikiDescription && wikiDescription.trim() !== '') {
                    html += `<div class="settlement-popup-wiki-description">${this.escapeHtml(wikiDescription)}</div>`;
                }
                if (wikiUrl && wikiUrl.trim() !== '') {
                    html += `<a href="${this.escapeHtml(wikiUrl)}" target="_blank" class="settlement-popup-wiki-link">Read on Wiki</a>`;
                }
                html += `</div>`;
            }

            if (sourceTag) {
                const fullSourceName = settlementData.getFullSourceName(sourceTag);
                html += `<div class="settlement-popup-source">Source: ${this.escapeHtml(fullSourceName)}</div>`;
            }

            html += '</div>';

            this.popupElement.innerHTML = html;
            this.popupOverlay.setPosition(coordinate);
            this.popupElement.style.display = 'block';
            return;
        }

        // Handle POI features
        if (featureType === 'poi') {
            const poiType = feature.get('type');
            let html = `<div class="settlement-popup">
                <div class="settlement-popup-header">
                    <h2 class="settlement-popup-title">${this.escapeHtml(name)}</h2>
                </div>
                <div class="settlement-popup-field">
                    <span class="settlement-popup-label">Type:</span>
                    <span class="settlement-popup-value">${this.escapeHtml(poiType)}</span>
                </div>
            </div>`;
            
            this.popupElement.innerHTML = html;
            this.popupOverlay.setPosition(coordinate);
            this.popupElement.style.display = 'block';
            return;
        }
        
        // Handle province features
        if (featureType === 'province') {
            const provinceType = feature.get('provinceType');
            const formalTitle = feature.get('formalTitle');
            const population = feature.get('population');
            const wikiUrl = feature.get('wikiUrl');
            const wikiDescription = feature.get('wikiDescription');
            
            // Use formal title as the main title, fall back to name if formal title is empty
            const displayTitle = (formalTitle && formalTitle !== null && formalTitle.trim() !== '') 
                ? formalTitle 
                : name;
            
            // Build header with title and subtitle
            const subtitle = provinceType || 'Region';
            let html = `<div class="settlement-popup">
                <div class="settlement-popup-header">
                    <h2 class="settlement-popup-title">${this.escapeHtml(displayTitle)}</h2>
                    <p class="settlement-popup-subtitle">${this.escapeHtml(subtitle)}</p>
                </div>`;
            
            // Add population if present
            if (population && population > 0) {
                html += `<div class="settlement-popup-field">
                    <span class="settlement-popup-label">Population:</span>
                    <span class="settlement-popup-value">${population.toLocaleString()}</span>
                </div>`;
            }
            
            // Add wiki section if available
            const hasWikiDescription = wikiDescription && wikiDescription !== null && wikiDescription.trim() !== '';
            const hasWikiUrl = wikiUrl && wikiUrl !== null && wikiUrl.trim() !== '';
            
            if (hasWikiDescription || hasWikiUrl) {
                html += `<div class="settlement-popup-wiki">`;
                
                // Add wiki description if available
                if (hasWikiDescription) {
                    html += `<div class="settlement-popup-wiki-description">${this.escapeHtml(wikiDescription)}</div>`;
                }
                
                // Add wiki link if available
                if (hasWikiUrl) {
                    html += `<a href="${this.escapeHtml(wikiUrl)}" target="_blank" class="settlement-popup-wiki-link">Read on Wiki</a>`;
                }
                
                html += `</div>`;
            }
            
            html += '</div>';
            
            this.popupElement.innerHTML = html;
            this.popupOverlay.setPosition(coordinate);
            this.popupElement.style.display = 'block';
            return;
        }
        
        // Handle settlement features
        const sizeCategory = feature.get('sizeCategory');
        const population = feature.get('population');
        const province = feature.get('province');
        const sourceTag = feature.get('sourceTag');
        const wikiTitle = feature.get('wikiTitle');
        const wikiUrl = feature.get('wikiUrl');
        const wikiDescription = feature.get('wikiDescription');
        const wikiImage = feature.get('wikiImage');
        const sizeLabel = getSizeCategoryLabel(sizeCategory);

        // Check if settlement has wiki data
        const hasWiki = wikiTitle && wikiTitle.trim() !== '';

        // Build header with title and subtitle
        const subtitle = province ? `${sizeLabel} in ${province}` : sizeLabel;
        let html = `<div class="settlement-popup">
            <div class="settlement-popup-header">
                <h2 class="settlement-popup-title">${this.escapeHtml(name)}</h2>
                <p class="settlement-popup-subtitle">${this.escapeHtml(subtitle)}</p>
            </div>`;

        // Add population field if present
        if (population && population > 0) {
            html += `<div class="settlement-popup-field">
                <span class="settlement-popup-label">Population:</span>
                <span class="settlement-popup-value">${population.toLocaleString()}</span>
            </div>`;
        }

        // Add wiki section if available
        if (hasWiki) {
            html += `<div class="settlement-popup-wiki">`;
            
            // Add wiki title
            html += `<div class="settlement-popup-wiki-title">${this.escapeHtml(wikiTitle)}</div>`;
            
            // Add wiki description if available
            if (wikiDescription && wikiDescription.trim() !== '') {
                html += `<div class="settlement-popup-wiki-description">${this.escapeHtml(wikiDescription)}</div>`;
            }
            
            // Add wiki link if available
            if (wikiUrl && wikiUrl.trim() !== '') {
                html += `<a href="${this.escapeHtml(wikiUrl)}" target="_blank" class="settlement-popup-wiki-link">Read on Wiki</a>`;
            }
            
            html += `</div>`;
        }

        // Add source field at bottom as footnote if present
        if (sourceTag) {
            const fullSourceName = settlementData.getFullSourceName(sourceTag);
            html += `<div class="settlement-popup-source">Source: ${this.escapeHtml(fullSourceName)}</div>`;
        }

        html += '</div>';

        this.popupElement.innerHTML = html;
        this.popupOverlay.setPosition(coordinate);
        this.popupElement.style.display = 'block';
    }

    /**
     * Hide popup
     */
    hidePopup() {
        this.popupElement.style.display = 'none';
    }

    /**
     * Escape HTML to prevent XSS
     * @private
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Toggle settlement layer visibility
     * @param {boolean} visible
     */
    setSettlementVisibility(visible) {
        const layer = mapManager.getSettlementLayer();
        if (layer) {
            layer.setVisible(visible);
        }
        if (this.settlementCheckbox) {
            this.settlementCheckbox.checked = visible;
        }
    }

    /**
     * Get settlement visibility state
     * @returns {boolean}
     */
    isSettlementVisible() {
        const layer = mapManager.getSettlementLayer();
        return layer ? layer.getVisible() : true;
    }
}

// Create global instance
const uiControls = new UIControls();
window.uiControls = uiControls;
