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
     * Build searchable index of all features
     */
    buildFeatureIndex() {
        this.allFeatures = [];

        // Helper: push a feature entry with a pre-built label string
        const push = (feature, name, label, coord) => {
            if (!name) return;
            this.allFeatures.push({
                feature,
                name,
                normalizedName: this.normalizeString(name),
                label,
                coordinate: coord
            });
        };

        // Settlements
        const settlementSource = mapManager.getSettlementSource();
        if (settlementSource) {
            settlementSource.getFeatures().forEach(f => {
                const name = f.get('name');
                const sizeCategory = f.get('sizeCategory');
                const place = f.get('province') || f.get('region');
                const categoryLabel = f.get('settlementType') || getSizeCategoryLabel(sizeCategory);
                push(f, name, place ? `${categoryLabel} (${place})` : categoryLabel, f.getGeometry().getCoordinates());
            });
        }

        // Dwarf settlements
        const dwarfSettlementSource = mapManager.getDwarfSettlementSource();
        if (dwarfSettlementSource) {
            dwarfSettlementSource.getFeatures().forEach(f => {
                const name = f.get('name');
                push(f, name, `Dwarf Settlement — ${f.get('dwarfHoldType') || 'Khazid (Town)'}`, f.getGeometry().getCoordinates());
            });
        }

        // Wood Elf settlements
        const woodElfSettlementSource = mapManager.getWoodElfSettlementSource();
        if (woodElfSettlementSource) {
            woodElfSettlementSource.getFeatures().forEach(f => {
                const name = f.get('name');
                push(f, name, `Wood Elf Settlement — ${f.get('settlementType') || 'Settlement'}`, f.getGeometry().getCoordinates());
            });
        }

        // POIs
        const poiSource = mapManager.getPOISource();
        if (poiSource) {
            poiSource.getFeatures().forEach(f => {
                const name = f.get('name');
                push(f, name, `POI — ${f.get('type') || 'Point of Interest'}`, f.getGeometry().getCoordinates());
            });
        }

        // Province / region labels
        const provinceLayer = mapManager.getProvinceLayer();
        if (provinceLayer) {
            provinceLayer.getSource().getFeatures().forEach(f => {
                push(f, f.get('name'), f.get('localCategory') || 'Region', f.getGeometry().getCoordinates());
            });
        }

        // Geographic feature labels (seas, lakes, hills, forests, etc.).
        // Large features are labelled more than once on the map, so index each name/type once.
        const waterLayer = mapManager.getWaterLayer();
        if (waterLayer) {
            const seen = new Set();
            waterLayer.getSource().getFeatures().forEach(f => {
                const name = f.get('name');
                const label = f.get('waterbodyType') || '';
                const key = `${name}|${label}`;
                if (seen.has(key)) return;
                seen.add(key);
                push(f, name, label, f.getGeometry().getCoordinates());
            });
        }

        // Tribe labels
        [
            mapManager.getGreenskinTribeLayer(),
            mapManager.getNorthmenTribeLayer(),
            mapManager.getArabyTribeLayer()
        ].forEach(layer => {
            if (!layer) return;
            layer.getSource().getFeatures().forEach(f => {
                push(f, f.get('name'), getTribeLabel(f), f.getGeometry().getCoordinates());
            });
        });

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
            div.innerHTML = `
                <div class="autocomplete-name">${this.highlightMatch(item.name, this.searchInput.value)}</div>
                <div class="autocomplete-details">${item.label}</div>
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
        const poiMarkersLayer = mapManager.getPOIMarkersOnlyLayer();

        if (settlementLayer) settlementLayer.changed();
        if (settlementMarkersLayer) settlementMarkersLayer.changed();
        if (dwarfSettlementLayer) dwarfSettlementLayer.changed();
        if (dwarfSettlementMarkersLayer) dwarfSettlementMarkersLayer.changed();
        if (woodElfSettlementLayer) woodElfSettlementLayer.changed();
        if (woodElfSettlementMarkersLayer) woodElfSettlementMarkersLayer.changed();
        if (poiLayer) poiLayer.changed();
        if (poiMarkersLayer) poiMarkersLayer.changed();
        
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
            const poiMarkersLayer = mapManager.getPOIMarkersOnlyLayer();

            if (settlementLayer) settlementLayer.changed();
            if (settlementMarkersLayer) settlementMarkersLayer.changed();
            if (poiLayer) poiLayer.changed();
            if (poiMarkersLayer) poiMarkersLayer.changed();

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
