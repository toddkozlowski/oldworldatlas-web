/**
 * search.js - Search functionality with autocomplete and feature highlighting
 */

class SearchManager {
    constructor() {
        this.searchInput = null;
        this.dropdown = null;
        this.clearButton = null;
        this.allFeatures = [];
        this.selectedFeature = null;
    }

    /**
     * Initialize search functionality
     */
    initialize() {
        this.searchInput = document.getElementById('search-input');
        this.dropdown = document.getElementById('autocomplete-dropdown');
        this.clearButton = document.getElementById('clear-selection');

        if (!this.searchInput || !this.dropdown || !this.clearButton) {
            console.error('Search elements not found');
            return;
        }

        // Build searchable feature index
        this.buildFeatureIndex();

        // Set up event listeners
        this.searchInput.addEventListener('input', () => this.handleSearchInput());
        this.searchInput.addEventListener('focus', () => this.handleSearchInput());
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // If dropdown has results, select the first one
                const firstItem = this.dropdown.querySelector('.autocomplete-item');
                if (firstItem && this.dropdown.style.display === 'block') {
                    firstItem.click();
                }
            }
        });
        this.clearButton.addEventListener('click', () => this.clearSelection());

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });

        console.log('Search initialized with', this.allFeatures.length, 'features');
    }

    /**
     * Build searchable index of all settlement and POI features
     */
    buildFeatureIndex() {
        this.allFeatures = [];

        // Get settlement features
        const settlementSource = mapManager.getSettlementSource();
        
        if (settlementSource) {
            const settlements = settlementSource.getFeatures();
            settlements.forEach(feature => {
                const name = feature.get('name');
                const sizeCategory = feature.get('sizeCategory');
                const province = feature.get('province');
                const coord = feature.getGeometry().getCoordinates();
                if (name) {
                    const categoryLabel = getSizeCategoryLabel(sizeCategory);
                    const details = province ? `${categoryLabel} (${province})` : categoryLabel;
                    this.allFeatures.push({
                        feature: feature,
                        name: name,
                        normalizedName: this.normalizeString(name),
                        type: 'Settlement',
                        details: details,
                        coordinate: coord
                    });
                }
            });
        }

        // Get dwarf settlement features
        const dwarfSettlementSource = mapManager.getDwarfSettlementSource();
        
        if (dwarfSettlementSource) {
            const dwarfSettlements = dwarfSettlementSource.getFeatures();
            dwarfSettlements.forEach(feature => {
                const name = feature.get('name');
                const dwarfHoldType = feature.get('dwarfHoldType');
                const coord = feature.getGeometry().getCoordinates();
                if (name) {
                    this.allFeatures.push({
                        feature: feature,
                        name: name,
                        normalizedName: this.normalizeString(name),
                        type: 'Dwarf Settlement',
                        details: dwarfHoldType || 'Khazid (Town)',
                        coordinate: coord
                    });
                }
            });
        }

        // Get wood elf settlement features
        const woodElfSettlementSource = mapManager.getWoodElfSettlementSource();

        if (woodElfSettlementSource) {
            const woodElfSettlements = woodElfSettlementSource.getFeatures();
            woodElfSettlements.forEach(feature => {
                const name = feature.get('name');
                const settlementType = feature.get('settlementType');
                const coord = feature.getGeometry().getCoordinates();
                if (name) {
                    this.allFeatures.push({
                        feature: feature,
                        name: name,
                        normalizedName: this.normalizeString(name),
                        type: 'Wood Elf Settlement',
                        details: settlementType || 'Settlement',
                        coordinate: coord
                    });
                }
            });
        }

        // Get POI features
        const poiSource = mapManager.getPOISource();
        
        if (poiSource) {
            const pois = poiSource.getFeatures();
            pois.forEach(feature => {
                const name = feature.get('name');
                const type = feature.get('type');
                const coord = feature.getGeometry().getCoordinates();
                if (name) {
                    this.allFeatures.push({
                        feature: feature,
                        name: name,
                        normalizedName: this.normalizeString(name),
                        type: 'POI',
                        details: type || 'Point of Interest',
                        coordinate: coord
                    });
                }
            });
        }

        console.log('Search indexed', this.allFeatures.length, 'features');
    }

    /**
     * Normalize string for searching - converts German characters (ü->u, ö->o, ä->a)
     * @param {string} str - String to normalize
     * @returns {string} Normalized string
     */
    normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase()
            .replace(/ü/g, 'u')
            .replace(/ö/g, 'o')
            .replace(/ä/g, 'a')
            .replace(/ß/g, 'ss')
            .trim();
    }

    /**
     * Handle search input changes
     */
    handleSearchInput() {
        const query = this.searchInput.value.trim();
        
        if (query.length === 0) {
            this.hideDropdown();
            return;
        }

        const normalizedQuery = this.normalizeString(query);
        
        // Filter features that match the query
        const matches = this.allFeatures.filter(item => 
            item.normalizedName.includes(normalizedQuery)
        );

        // Sort by exact match first, then alphabetically
        matches.sort((a, b) => {
            const aStarts = a.normalizedName.startsWith(normalizedQuery);
            const bStarts = b.normalizedName.startsWith(normalizedQuery);
            
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            
            return a.name.localeCompare(b.name);
        });

        this.showDropdown(matches.slice(0, 20)); // Limit to 20 results
    }

    /**
     * Show autocomplete dropdown with results
     * @param {Array} matches - Array of matching feature items
     */
    showDropdown(matches) {
        this.dropdown.innerHTML = '';

        if (matches.length === 0) {
            this.dropdown.innerHTML = '<div class="autocomplete-item" style="color:#999;">No results found</div>';
            this.dropdown.style.display = 'block';
            return;
        }

        matches.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            // For settlements, just show the details (category + province)
            // For POIs, show type prefix
            const detailsText = item.type === 'Settlement' ? item.details : `${item.type} - ${item.details}`;
            div.innerHTML = `
                <div class="autocomplete-name">${this.highlightMatch(item.name, this.searchInput.value)}</div>
                <div class="autocomplete-details">${detailsText}</div>
            `;
            div.addEventListener('click', () => this.selectFeature(item));
            this.dropdown.appendChild(div);
        });

        this.dropdown.style.display = 'block';
    }

    /**
     * Hide autocomplete dropdown
     */
    hideDropdown() {
        this.dropdown.style.display = 'none';
    }

    /**
     * Highlight matching text in search results
     * @param {string} text - Original text
     * @param {string} query - Search query
     * @returns {string} HTML with highlighted text
     */
    highlightMatch(text, query) {
        if (!query) return text;
        
        const normalizedText = this.normalizeString(text);
        const normalizedQuery = this.normalizeString(query);
        const index = normalizedText.indexOf(normalizedQuery);
        
        if (index === -1) return text;
        
        const before = text.substring(0, index);
        const match = text.substring(index, index + query.length);
        const after = text.substring(index + query.length);
        
        return `${before}<strong>${match}</strong>${after}`;
    }

    /**
     * Select a feature from search results
     * @param {Object} item - Feature item from search results
     */
    selectFeature(item) {
        this.hideDropdown();
        
        // Clear previous selection
        this.clearSelection();
        
        // Set new selection
        this.selectedFeature = item.feature;
        
        // Force style refresh by modifying feature property
        item.feature.set('highlighted', true);
        
        // Refresh the layers to apply highlighted style
        const settlementLayer = mapManager.getSettlementLayer();
        const settlementMarkersLayer = mapManager.getSettlementMarkersOnlyLayer();
        const dwarfSettlementLayer = mapManager.getDwarfSettlementLayer();
        const dwarfSettlementMarkersLayer = mapManager.getDwarfSettlementMarkersOnlyLayer();
        const woodElfSettlementLayer = mapManager.getWoodElfSettlementLayer();
        const woodElfSettlementMarkersLayer = mapManager.getWoodElfSettlementMarkersOnlyLayer();
        const poiLayer = mapManager.getPOILayer();
        
        if (settlementLayer) settlementLayer.changed();
        if (settlementMarkersLayer) settlementMarkersLayer.changed();
        if (dwarfSettlementLayer) dwarfSettlementLayer.changed();
        if (dwarfSettlementMarkersLayer) dwarfSettlementMarkersLayer.changed();
        if (woodElfSettlementLayer) woodElfSettlementLayer.changed();
        if (woodElfSettlementMarkersLayer) woodElfSettlementMarkersLayer.changed();
        if (poiLayer) poiLayer.changed();
        
        // Show feature through UI controls (zoom, center, popup)
        if (window.uiControls) {
            window.uiControls.showFeatureFromSearch(item.feature, item.coordinate);
        }
        
        // Show clear button
        this.clearButton.style.display = 'block';
        
        // Update search input with selected name
        this.searchInput.value = item.name;
    }

    /**
     * Clear current selection and reset highlighting
     */
    clearSelection() {
        if (this.selectedFeature) {
            this.selectedFeature.set('highlighted', false);
            
            // Refresh layers
            const settlementLayer = mapManager.getSettlementLayer();
            const settlementMarkersLayer = mapManager.getSettlementMarkersOnlyLayer();
            const poiLayer = mapManager.getPOILayer();
            
            if (settlementLayer) settlementLayer.changed();
            if (settlementMarkersLayer) settlementMarkersLayer.changed();
            if (poiLayer) poiLayer.changed();
            
            this.selectedFeature = null;
        }
        
        // Hide clear button
        this.clearButton.style.display = 'none';
        
        // Clear search input
        this.searchInput.value = '';
        this.hideDropdown();
    }

    /**
     * Check if a feature is currently selected/highlighted
     * @param {ol.Feature} feature - Feature to check
     * @returns {boolean} True if feature is selected
     */
    isFeatureHighlighted(feature) {
        return feature.get('highlighted') === true;
    }
}

// Create global search manager instance
const searchManager = new SearchManager();
window.searchManager = searchManager;
