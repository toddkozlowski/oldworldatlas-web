/**
 * Dynamic scale control for Old World Atlas
 * Shows both miles and kilometers with dynamic sizing based on zoom level
 */

class ScaleControl {
    constructor() {
        this.map = null;
        this.scaleElement = null;
        this.milesBar = null;
        this.kmBar = null;
        this.milesLabel = null;
        this.kmLabel = null;
        
        // Scale values to cycle through (in km)
        this.scaleValues = [1, 2, 5, 10, 20, 50, 100, 200];
        
        // Miles to map units conversion factor (from measurement-tool.js)
        // map units * 83.5 = miles
        this.MILES_FACTOR = 83.5;
        
        // Miles to kilometers conversion
        this.MILES_TO_KM = 1.60934;
    }

    /**
     * Initialize the scale control
     * @param {ol.Map} map - OpenLayers map instance
     */
    initialize(map) {
        this.map = map;
        this.createScaleElement();
        
        // Update scale on view changes. Routed through mapManager (rather than
        // binding to this.map.getView() directly) so it keeps firing after a
        // city overlay swaps in a view with a relaxed minResolution.
        mapManager.onResolutionChange(() => {
            this.updateScale();
        });
        
        // Update scale when units change
        window.addEventListener('unitsChanged', () => {
            this.updateScale();
        });
        
        // Initial update
        this.updateScale();
    }

    /**
     * Create the scale DOM element
     * @private
     */
    createScaleElement() {
        // Create container
        this.scaleElement = document.createElement('div');
        this.scaleElement.id = 'scale-control';
        this.scaleElement.className = 'scale-control';
        
        // Single bar that will show either miles or km
        const barContainer = document.createElement('div');
        barContainer.className = 'scale-bar-container';
        
        this.milesBar = document.createElement('div');
        this.milesBar.className = 'scale-bar';
        
        this.milesLabel = document.createElement('div');
        this.milesLabel.className = 'scale-label';
        
        barContainer.appendChild(this.milesBar);
        barContainer.appendChild(this.milesLabel);
        
        // Add to main element
        this.scaleElement.appendChild(barContainer);
        
        // Add to page
        document.body.appendChild(this.scaleElement);
    }

    /**
     * Update the scale based on current zoom level
     * @private
     */
    updateScale() {
        const view = this.map.getView();
        const resolution = view.getResolution();
        
        // Get current units
        const units = window.getCurrentUnits ? window.getCurrentUnits() : 'miles';
        
        // Calculate how many map units correspond to 150px on screen (50% wider than before)
        const mapUnitsPerPixel = resolution;
        const testPixels = 150;
        const mapUnitsForTestPx = mapUnitsPerPixel * testPixels;
        
        // Convert map units to miles
        const milesForTestPx = mapUnitsForTestPx * this.MILES_FACTOR;
        
        let displayValue, displayUnit;
        
        if (units === 'kilometers') {
            // Convert miles to kilometers
            const kmForTestPx = milesForTestPx * this.MILES_TO_KM;
            
            // Find appropriate scale value for kilometers
            displayValue = this.scaleValues[0];
            for (let i = 0; i < this.scaleValues.length; i++) {
                if (this.scaleValues[i] <= kmForTestPx) {
                    displayValue = this.scaleValues[i];
                } else {
                    break;
                }
            }
            displayUnit = 'km';
        } else {
            // Find appropriate scale value for miles
            displayValue = this.scaleValues[0];
            for (let i = 0; i < this.scaleValues.length; i++) {
                if (this.scaleValues[i] <= milesForTestPx) {
                    displayValue = this.scaleValues[i];
                } else {
                    break;
                }
            }
            displayUnit = 'mi';
        }
        
        // Calculate actual width in pixels for this value
        const valueInMiles = units === 'kilometers' ? displayValue / this.MILES_TO_KM : displayValue;
        const displayWidth = (valueInMiles / milesForTestPx) * testPixels;
        
        // Determine number of segments
        const segments = this.getSegmentCount(displayValue);
        
        // Update bar
        this.updateBar(this.milesBar, displayValue, displayWidth, segments, displayUnit);
        this.milesLabel.textContent = this.formatLabel(displayValue, displayUnit);
    }

    /**
     * Determine number of segments based on value
     * @private
     */
    getSegmentCount(value) {
        // Only show segments if we can divide into whole numbers
        if (value === 1) return 1;
        if (value === 2) return 2;
        if (value === 5) return 5;
        if (value === 10) return 5; // 5 segments of 2 each
        if (value === 20) return 5; // 5 segments of 4 each
        if (value === 50) return 5; // 5 segments of 10 each
        if (value === 100) return 5; // 5 segments of 20 each
        if (value === 200) return 5; // 5 segments of 40 each
        
        // For miles (decimals), try to show segments only if reasonably whole
        const rounded = Math.round(value);
        if (Math.abs(value - rounded) < 0.01) {
            if (rounded === 1) return 1;
            if (rounded === 2) return 2;
            if (rounded === 3) return 3;
            if (rounded === 4) return 4;
            if (rounded === 5) return 5;
        }
        
        return 1; // Default to 1 segment (no divisions)
    }

    /**
     * Update a scale bar with segments
     * @private
     */
    updateBar(barElement, value, width, segments, unit) {
        barElement.style.width = width + 'px';
        barElement.innerHTML = '';
        
        if (segments === 1) {
            // Single segment - simple line
            const segment = document.createElement('div');
            segment.className = 'scale-segment';
            segment.style.width = '100%';
            segment.style.background = '#000';
            barElement.appendChild(segment);
        } else {
            // Multiple segments - alternating colors
            const segmentWidth = 100 / segments;
            for (let i = 0; i < segments; i++) {
                const segment = document.createElement('div');
                segment.className = 'scale-segment';
                segment.style.width = segmentWidth + '%';
                segment.style.background = i % 2 === 0 ? '#000' : '#fff';
                segment.style.border = i % 2 === 0 ? '1px solid #000' : '1px solid #000';
                segment.style.boxSizing = 'border-box';
                barElement.appendChild(segment);
            }
        }
        
        // Add tick marks
        const tickContainer = document.createElement('div');
        tickContainer.className = 'scale-ticks';
        
        for (let i = 0; i <= segments; i++) {
            const tick = document.createElement('div');
            tick.className = 'scale-tick';
            tick.style.left = (i * 100 / segments) + '%';
            tickContainer.appendChild(tick);
        }
        
        barElement.appendChild(tickContainer);
    }

    /**
     * Format label text
     * @private
     */
    formatLabel(value, unit) {
        // Round to reasonable precision
        if (value < 1) {
            return value.toFixed(2) + ' ' + unit;
        } else if (value < 10) {
            return value.toFixed(1) + ' ' + unit;
        } else {
            return Math.round(value) + ' ' + unit;
        }
    }
}
