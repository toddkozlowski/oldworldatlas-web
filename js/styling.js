/**
 * Settlement styling definitions for Old World Atlas
 * 
 * Configuration is loaded from styles-config.json
 * This provides granular control over all visual aspects at different zoom levels.
 */

// Global variable to store loaded styles configuration
let STYLES_CONFIG = null;

// Style cache for performance optimization
// Caching styles significantly reduces rendering overhead with thousands of features
const STYLE_CACHE = {
    settlements: new Map(),
    poi: new Map(),
    provinces: new Map(),
    water: new Map()
};

// Cache size limits to prevent memory issues
const MAX_CACHE_SIZE = 1000;

/**
 * Clear style caches (useful when configuration changes)
 */
function clearStyleCaches() {
    STYLE_CACHE.settlements.clear();
    STYLE_CACHE.poi.clear();
    STYLE_CACHE.provinces.clear();
    STYLE_CACHE.water.clear();
}

/**
 * Get or create cached style
 * @param {Map} cache - Cache map
 * @param {string} key - Cache key
 * @param {Function} createFn - Function to create style if not cached
 * @returns {ol.style.Style|null}
 */
function getCachedStyle(cache, key, createFn) {
    if (cache.has(key)) {
        return cache.get(key);
    }
    
    // Limit cache size to prevent memory issues
    if (cache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entries (simple FIFO)
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
    
    const style = createFn();
    cache.set(key, style);
    return style;
}

/**
 * Load styles configuration from JSON file
 * @returns {Promise<Object>} Loaded configuration
 */
async function loadStylesConfig() {
    if (STYLES_CONFIG) {
        return STYLES_CONFIG;
    }
    
    try {
        const response = await fetch('styles-config.json');
        STYLES_CONFIG = await response.json();
        return STYLES_CONFIG;
    } catch (error) {
        console.error('Error loading styles configuration:', error);
        // Return empty config as fallback
        return { settlements: {}, poi: {}, provinces: {}, water: {} };
    }
}

/**
 * Format a label name for map display.
 * If the name contains a parenthetical (e.g. "LABEL NAME (\"Other Name\")"),
 * the parenthetical is moved to a new line.
 * @param {string} name - Raw feature name
 * @returns {string} Display-ready label text
 */
function formatLabelText(name) {
    if (!name) return name;
    return name.replace(/\s*(\([^)]+\))/, '\n$1');
}

/**
 * Format a POI label name for map display.
 * If the name contains a parenthetical, handles it like formatLabelText.
 * If the name has 5 or more words, inserts a line break after the middle word
 * (rounded up), so a 5-word label would have 3 words on top and 2 on bottom.
 * @param {string} name - Raw feature name
 * @returns {string} Display-ready label text
 */
function formatPOILabelText(name) {
    if (!name) return name;
    
    // First, handle parentheticals
    if (/\(/.test(name)) {
        return formatLabelText(name);
    }
    
    // Split by spaces to count words
    const words = name.split(/\s+/);
    
    // If 5 or more words, break after the middle word (rounded up)
    if (words.length >= 5) {
        const breakPoint = Math.ceil(words.length / 2);
        const firstLine = words.slice(0, breakPoint).join(' ');
        const secondLine = words.slice(breakPoint).join(' ');
        return firstLine + '\n' + secondLine;
    }
    
    // For fewer than 5 words, return as-is
    return name;
}

/**
 * Format a water label name for map display.
 * If the name contains a parenthetical, delegates to formatLabelText.
 * Otherwise, if the name has 11+ non-space characters, inserts a line break
 * at the space closest to the string's midpoint to best balance the two lines.
 * @param {string} name - Raw feature name
 * @returns {string} Display-ready label text
 */
function formatWaterLabelText(name) {
    if (!name) return name;
    // If it has a parenthetical, use the standard handler (no further splitting)
    if (/\(/.test(name)) {
        return formatLabelText(name);
    }
    // Count non-space characters
    const nonSpaceCount = name.replace(/ /g, '').length;
    if (nonSpaceCount >= 11) {
        // Collect indices of all spaces
        const spaces = [];
        for (let i = 0; i < name.length; i++) {
            if (name[i] === ' ') spaces.push(i);
        }
        if (spaces.length > 0) {
            const mid = name.length / 2;
            // Pick the space whose index is closest to the midpoint
            let bestSpace = spaces[0];
            let bestDist = Math.abs(spaces[0] - mid);
            for (let i = 1; i < spaces.length; i++) {
                const dist = Math.abs(spaces[i] - mid);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestSpace = spaces[i];
                }
            }
            return name.slice(0, bestSpace) + '\n' + name.slice(bestSpace + 1);
        }
    }
    return name;
}

/**
 * Linear interpolation helper
 * @param {number} value - Current value
 * @param {number} minIn - Minimum input value
 * @param {number} maxIn - Maximum input value
 * @param {number} minOut - Minimum output value
 * @param {number} maxOut - Maximum output value
 * @returns {number} Interpolated value
 */
function lerp(value, minIn, maxIn, minOut, maxOut) {
    // Handle reversed ranges (e.g., resolution where higher value = zoomed out)
    // Ensure minIn is actually less than maxIn for calculation
    if (minIn > maxIn) {
        // Swap the ranges
        [minIn, maxIn] = [maxIn, minIn];
        [minOut, maxOut] = [maxOut, minOut];
    }
    
    // Clamp value between min and max
    value = Math.max(minIn, Math.min(maxIn, value));
    
    // Linear interpolation
    const t = (value - minIn) / (maxIn - minIn);
    return minOut + t * (maxOut - minOut);
}

/**
 * Parse font configuration and construct proper CSS font string
 * OpenLayers requires: [font-style] [font-variant] [font-weight] [font-size] [font-family]
 * @param {string} fontConfig - Font configuration string (e.g., "bold Arial, sans-serif" or "italic Arial")
 * @param {number} fontSize - Font size in pixels
 * @returns {string} Properly formatted CSS font string
 */
function constructFontString(fontConfig, fontSize) {
    // Parse the font config to extract style, weight, and family
    const parts = fontConfig.trim().split(/\s+/);
    let fontStyle = 'normal';
    let fontWeight = 'normal';
    let fontFamily = fontConfig;
    
    // Check for font-style keywords
    if (parts[0] === 'italic' || parts[0] === 'oblique') {
        fontStyle = parts[0];
        parts.shift();
    }
    
    // Check for font-weight keywords
    if (parts.length > 0 && (parts[0] === 'bold' || parts[0] === 'bolder' || parts[0] === 'lighter' || /^[1-9]00$/.test(parts[0]))) {
        fontWeight = parts[0];
        parts.shift();
    }
    
    // Remaining parts are the font family
    fontFamily = parts.join(' ');
    
    // Construct proper CSS font string
    let result = '';
    if (fontStyle !== 'normal') result += fontStyle + ' ';
    if (fontWeight !== 'normal') result += fontWeight + ' ';
    result += fontSize + 'px ';
    result += fontFamily;
    
    return result;
}

/**
 * Get interpolated font size based on zoom level
 * @param {Object} config - Style configuration with min/max font settings
 * @param {number} currentResolution - Current map resolution
 * @returns {number} Interpolated font size
 */
function getInterpolatedFontSize(config, currentResolution) {
    return Math.round(lerp(
        currentResolution,
        config.minFontZoom,
        config.maxFontZoom,
        config.minFontSize,
        config.maxFontSize
    ));
}

/**
 * Get interpolated dot radius based on zoom level
 * @param {Object} config - Style configuration with min/max radius settings
 * @param {number} currentResolution - Current map resolution
 * @returns {number} Interpolated radius
 */
function getInterpolatedRadius(config, currentResolution) {
    const marker = config.marker || {};
    return lerp(
        currentResolution,
        marker.minRadiusZoom || 0,
        marker.maxRadiusZoom || 0,
        marker.minRadius || 0,
        marker.maxRadius || 0
    );
}

/**
 * Check if label should be visible at current zoom level
 * @param {Object} config - Style configuration
 * @param {number} currentResolution - Current map resolution
 * @returns {boolean}
 */
function shouldShowLabel(config, currentResolution) {
    return currentResolution <= config.minZoomLevel && 
           currentResolution >= config.maxZoomLevel;
}

/**
 * Check if dot should be visible at current zoom level
 * @param {Object} config - Style configuration
 * @param {number} currentResolution - Current map resolution
 * @returns {boolean}
 */
function shouldShowDot(config, currentResolution) {
    return currentResolution <= config.minZoomLevel && 
           currentResolution >= config.maxZoomLevel;
}

/**
 * Get settlement label declutter priority across human, dwarf, and wood elf layers.
 * Higher values are less likely to be hidden by decluttering.
 *
 * Priority mapping:
 * 6: Tier 6 settlements
 * 5: Tier 5 settlements
 * 4: Tier 4 settlements
 * 3: Tier 3 settlements, Karaks, Wood Elf settlements
 * 2: Tier 2 settlements, Kazads, Khazids (and other non-Karak dwarf holds)
 * 1: Tier 1 settlements
 *
 * @param {OL.Feature} feature - OpenLayers feature
 * @returns {number} Priority value for decluttering
 */
function getSettlementDeclutterPriority(feature) {
    const featureType = feature.get('featureType');

    if (featureType === 'dwarf') {
        const dwarfType = feature.get('dwarfType');
        if (dwarfType === 'Karak') {
            return 3;
        }
        if (dwarfType === 'Kazad' || dwarfType === 'Khazid') {
            return 2;
        }
        // Grung and any unknown dwarf types default to the Tier 2 grouping.
        return 2;
    }

    if (featureType === 'woodelf') {
        return 3;
    }

    const sizeCategory = parseInt(feature.get('sizeCategory'), 10);
    if (sizeCategory >= 6) return 6;
    if (sizeCategory === 5) return 5;
    if (sizeCategory === 4) return 4;
    if (sizeCategory === 3) return 3;
    if (sizeCategory === 2) return 2;
    return 1;
}

/**
 * Create an OpenLayers Style object for a POI
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createPOIStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        console.warn('Styles configuration not loaded yet');
        return null;
    }
    
    const config = STYLES_CONFIG.poi.default;
    
    // Early exit for performance - don't even check visibility if way out of range
    if (currentResolution > config.minZoomLevel * 2) {
        return null;
    }
    
    // Check visibility
    const showLabel = shouldShowLabel(config, currentResolution);
    const showDotVisible = shouldShowDot(config, currentResolution);
    
    if (!showLabel && !showDotVisible) {
        return null;
    }
    
    // Get interpolated values
    const fontSize = getInterpolatedFontSize(config, currentResolution);
    const radius = getInterpolatedRadius(config, currentResolution);
    
    // Check if this feature is highlighted (from search)
    const isHighlighted = feature.get('highlighted') === true;
    
    // Cache the circle image (non-feature-specific) - unless highlighted
    let imageStyle = null;
    if (showDotVisible) {
        if (isHighlighted) {
            // Don't cache highlighted styles - create fresh red circle
            imageStyle = new ol.style.Circle({
                radius: radius * 1.3,  // Slightly larger
                fill: new ol.style.Fill({ color: '#f44336' }),  // Red
                stroke: new ol.style.Stroke({ 
                    color: '#d32f2f',
                    width: config.strokeWidth * 1.5 
                })
            });
        } else {
            const imageCacheKey = `poi_img_${currentResolution.toFixed(4)}`;
            imageStyle = getCachedStyle(STYLE_CACHE.poi, imageCacheKey, () => {
                return new ol.style.Circle({
                    radius: radius,
                    fill: new ol.style.Fill({ color: config.color }),
                    stroke: new ol.style.Stroke({ 
                        color: config.strokeColor, 
                        width: config.strokeWidth 
                    })
                });
            });
        }
    }
    
    // Create style with feature-specific text (not cached)
    // POI z-index set to 2.5 to render below Tier 3 settlements (priority 3)
    // but above Tier 2 settlements (priority 2) in the decluttering hierarchy
    // Highlighted POIs get z-index 9999 to appear above everything except measurements
    const style = new ol.style.Style({
        image: imageStyle,
        zIndex: isHighlighted ? 9999 : 2.5
    });
    
    // Add text if visible (feature-specific, so not cached)
    if (showLabel) {
        const fontConfig = isHighlighted ? 'bold ' + config.textFont : config.textFont;
            const poiLabelText = formatPOILabelText(feature.get('name'));
            const multilineOffsetY = poiLabelText.includes('\n')
                ? config.textOffsetY - Math.max(3, Math.round(fontSize * 0.35))
                : config.textOffsetY;

        style.setText(new ol.style.Text({
                text: poiLabelText,
                offsetY: multilineOffsetY,
            font: constructFontString(fontConfig, fontSize),
            fill: new ol.style.Fill({ color: isHighlighted ? '#d32f2f' : config.textFillColor }),
            stroke: new ol.style.Stroke({ 
                color: config.textStrokeColor, 
                width: isHighlighted ? config.textStrokeWidth * 1.3 : config.textStrokeWidth 
            })
        }));
    }
    
    return style;
}

/**
 * Create an OpenLayers Style object for a settlement
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createSettlementStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        console.warn('Styles configuration not loaded yet');
        return null;
    }
    
    const sizeCategory = feature.get('sizeCategory');
    const config = STYLES_CONFIG.settlements.sizeCategories[sizeCategory];
    
    if (!config) {
        return null;
    }
    
    // Early exit for performance - don't even check if way out of range
    if (currentResolution > config.minZoomLevel * 2) {
        return null;
    }
    
    // Check visibility
    const showLabel = shouldShowLabel(config, currentResolution);
    const showDotVisible = shouldShowDot(config, currentResolution);
    
    if (!showLabel && !showDotVisible) {
        return null;
    }
    
    // Get interpolated values
    const fontSize = getInterpolatedFontSize(config, currentResolution);
    const radius = getInterpolatedRadius(config, currentResolution);
    
    // Check if this feature is highlighted (from search)
    const isHighlighted = feature.get('highlighted') === true;
    
    // Cache the circle image (non-feature-specific) - unless highlighted
    let imageStyle = null;
    if (showDotVisible) {
        if (isHighlighted) {
            // Don't cache highlighted styles - create fresh red circle
            imageStyle = new ol.style.Circle({
                radius: radius * 1.3,  // Slightly larger
                fill: new ol.style.Fill({ color: '#f44336' }),  // Red
                stroke: new ol.style.Stroke({ 
                    color: '#d32f2f',
                    width: config.strokeWidth * 1.5 
                })
            });
        } else {
            const imageCacheKey = `settle_img_${sizeCategory}_${currentResolution.toFixed(4)}`;
            imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
                return new ol.style.Circle({
                    radius: radius,
                    fill: new ol.style.Fill({ color: config.color }),
                    stroke: new ol.style.Stroke({ 
                        color: config.strokeColor, 
                        width: config.strokeWidth 
                    })
                });
            });
        }
    }
    
    // Create style with feature-specific text (not cached)
    // Set zIndex based on settlement size for decluttering priority
    // Higher population settlements get higher zIndex and won't be hidden
    // Highlighted features get maximum zIndex
    const style = new ol.style.Style({
        image: imageStyle,
        zIndex: isHighlighted ? 9999 : getSettlementDeclutterPriority(feature)
    });
    
    // Add text if visible (feature-specific, so not cached)
    if (showLabel) {
        const fontConfig = isHighlighted ? 'bold ' + config.textFont : config.textFont;
        style.setText(new ol.style.Text({
            text: formatLabelText(feature.get('name')),
            offsetY: config.textOffsetY,
            font: constructFontString(fontConfig, fontSize),
            fill: new ol.style.Fill({ color: isHighlighted ? '#d32f2f' : config.textFillColor }),
            stroke: new ol.style.Stroke({ 
                color: config.textStrokeColor, 
                width: isHighlighted ? config.textStrokeWidth * 1.3 : config.textStrokeWidth 
            })
        }));
    }
    
    return style;
}

/**
 * Create an OpenLayers Style object for a settlement marker only (no label)
 * Used for the always-visible marker layer underneath the decluttered label layer
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createSettlementMarkerOnlyStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        return null;
    }
    
    const sizeCategory = feature.get('sizeCategory');
    const config = STYLES_CONFIG.settlements.sizeCategories[sizeCategory];
    
    if (!config) {
        return null;
    }
    
    // Early exit for performance
    if (currentResolution > config.minZoomLevel * 2) {
        return null;
    }
    
    // Check if dot should be visible
    const showDotVisible = shouldShowDot(config, currentResolution);
    
    if (!showDotVisible) {
        return null;
    }
    
    // Get interpolated radius
    const radius = getInterpolatedRadius(config, currentResolution);
    
    // Check if this feature is highlighted (from search)
    const isHighlighted = feature.get('highlighted') === true;
    
    // Cache the circle image - unless highlighted
    let imageStyle = null;
    if (isHighlighted) {
        // Don't cache highlighted styles - create fresh red circle
        imageStyle = new ol.style.Circle({
            radius: radius * 1.3,  // Slightly larger
            fill: new ol.style.Fill({ color: '#f44336' }),  // Red
            stroke: new ol.style.Stroke({ 
                color: '#d32f2f',
                width: config.strokeWidth * 1.5 
            })
        });
    } else {
        const imageCacheKey = `settle_marker_${sizeCategory}_${currentResolution.toFixed(4)}`;
        imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
            return new ol.style.Circle({
                radius: radius,
                fill: new ol.style.Fill({ color: config.color }),
                stroke: new ol.style.Stroke({ 
                    color: config.strokeColor, 
                    width: config.strokeWidth 
                })
            });
        });
    }
    
    // Return style with only the marker (no text)
    return new ol.style.Style({
        image: imageStyle,
        zIndex: isHighlighted ? 9999 : 0
    });
}

/**
 * Create an OpenLayers Style object for a province label
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createProvinceStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        console.warn('Styles configuration not loaded yet');
        return null;
    }
    
    const provinceType = feature.get('provinceType');
    const config = STYLES_CONFIG.provinces[provinceType];
    
    if (!config) {
        return null;
    }
    
    // Check if should be visible (early exit)
    if (!shouldShowLabel(config, currentResolution)) {
        return null;
    }
    
    // Get interpolated font size
    const fontSize = getInterpolatedFontSize(config, currentResolution);
    
    // Province labels are text-only and feature-specific, so less benefit from caching
    // The font size calculation is lightweight, so we create fresh styles
    return new ol.style.Style({
        text: new ol.style.Text({
            text: formatLabelText(feature.get('name')),
            font: constructFontString(config.textFont, fontSize),
            fill: new ol.style.Fill({ color: config.textFillColor }),
            stroke: new ol.style.Stroke({ 
                color: config.textStrokeColor, 
                width: config.textStrokeWidth 
            })
        })
    });
}

/**
 * Create an OpenLayers Style object for a water label
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createWaterStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        console.warn('Styles configuration not loaded yet');
        return null;
    }
    
    const waterbodyType = feature.get('waterbodyType');
    const config = STYLES_CONFIG.water[waterbodyType];
    
    if (!config) {
        return null;
    }
    
    // Check if should be visible (early exit)
    if (!shouldShowLabel(config, currentResolution)) {
        return null;
    }
    
    // Get interpolated font size
    const fontSize = getInterpolatedFontSize(config, currentResolution);
    
    // Water labels are text-only and feature-specific, so less benefit from caching
    // The font size calculation is lightweight, so we create fresh styles
    return new ol.style.Style({
        text: new ol.style.Text({
            text: formatWaterLabelText(feature.get('name')),
            font: constructFontString(config.textFont, fontSize),
            fill: new ol.style.Fill({ color: config.textFillColor }),
            stroke: new ol.style.Stroke({ 
                color: config.textStrokeColor, 
                width: config.textStrokeWidth 
            })
        })
    });
}

/**
 * Create an OpenLayers Style object for a dwarf settlement
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createDwarfSettlementStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        console.warn('Styles configuration not loaded yet');
        return null;
    }
    
    const dwarfType = feature.get('dwarfType');
    const config = STYLES_CONFIG.dwarfSettlements[dwarfType];
    
    if (!config) {
        return null;
    }
    
    // Early exit for performance - don't even check if way out of range
    if (currentResolution > config.minZoomLevel * 2) {
        return null;
    }
    
    // Check visibility
    const showLabel = shouldShowLabel(config, currentResolution);
    const showDotVisible = shouldShowDot(config, currentResolution);
    
    if (!showLabel && !showDotVisible) {
        return null;
    }
    
    // Get interpolated values
    const fontSize = getInterpolatedFontSize(config, currentResolution);
    const radius = getInterpolatedRadius(config, currentResolution);
    
    // Check if this feature is highlighted (from search)
    const isHighlighted = feature.get('highlighted') === true;
    
    // Cache the circle image (non-feature-specific) - unless highlighted
    let imageStyle = null;
    if (showDotVisible) {
        if (isHighlighted) {
            // Don't cache highlighted styles - create fresh red circle
            imageStyle = new ol.style.Circle({
                radius: radius * 1.3,  // Slightly larger
                fill: new ol.style.Fill({ color: '#f44336' }),  // Red
                stroke: new ol.style.Stroke({ 
                    color: '#d32f2f',
                    width: config.strokeWidth * 1.5 
                })
            });
        } else {
            const imageCacheKey = `dwarf_img_${dwarfType}_${currentResolution.toFixed(4)}`;
            imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
                return new ol.style.Circle({
                    radius: radius,
                    fill: new ol.style.Fill({ color: config.color }),
                    stroke: new ol.style.Stroke({ 
                        color: config.strokeColor, 
                        width: config.strokeWidth 
                    })
                });
            });
        }
    }
    
    // Create style with feature-specific text (not cached)
    // Set zIndex based on settlement type for decluttering priority
    // Highlighted features get maximum zIndex
    const style = new ol.style.Style({
        image: imageStyle,
        zIndex: isHighlighted ? 9999 : getSettlementDeclutterPriority(feature)
    });
    
    // Add text if visible (feature-specific, so not cached)
    if (showLabel) {
        const fontConfig = isHighlighted ? 'bold ' + config.textFont : config.textFont;
        style.setText(new ol.style.Text({
            text: formatLabelText(feature.get('name')),
            offsetY: config.textOffsetY,
            font: constructFontString(fontConfig, fontSize),
            fill: new ol.style.Fill({ color: isHighlighted ? '#d32f2f' : config.textFillColor }),
            stroke: new ol.style.Stroke({ 
                color: config.textStrokeColor, 
                width: isHighlighted ? config.textStrokeWidth * 1.3 : config.textStrokeWidth 
            })
        }));
    }
    
    return style;
}

/**
 * Create an OpenLayers Style object for a wood elf settlement
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createWoodElfSettlementStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        console.warn('Styles configuration not loaded yet');
        return null;
    }

    const config = STYLES_CONFIG.woodElfSettlements['default'];

    if (!config) {
        return null;
    }

    // Early exit for performance
    if (currentResolution > config.minZoomLevel * 2) {
        return null;
    }

    // Check visibility
    const showLabel = shouldShowLabel(config, currentResolution);
    const showDotVisible = shouldShowDot(config, currentResolution);

    if (!showLabel && !showDotVisible) {
        return null;
    }

    // Get interpolated values
    const fontSize = getInterpolatedFontSize(config, currentResolution);
    const radius = getInterpolatedRadius(config, currentResolution);

    // Check if this feature is highlighted (from search)
    const isHighlighted = feature.get('highlighted') === true;

    let imageStyle = null;
    if (showDotVisible) {
        if (isHighlighted) {
            imageStyle = new ol.style.Circle({
                radius: radius * 1.3,
                fill: new ol.style.Fill({ color: '#f44336' }),
                stroke: new ol.style.Stroke({
                    color: '#d32f2f',
                    width: config.strokeWidth * 1.5
                })
            });
        } else {
            const imageCacheKey = `woodelf_img_${currentResolution.toFixed(4)}`;
            imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
                return new ol.style.Circle({
                    radius: radius,
                    fill: new ol.style.Fill({ color: config.color }),
                    stroke: new ol.style.Stroke({
                        color: config.strokeColor,
                        width: config.strokeWidth
                    })
                });
            });
        }
    }

    const style = new ol.style.Style({
        image: imageStyle,
        zIndex: isHighlighted ? 9999 : getSettlementDeclutterPriority(feature)
    });

    if (showLabel) {
        const fontConfig = isHighlighted ? 'bold ' + config.textFont : config.textFont;
        style.setText(new ol.style.Text({
            text: formatLabelText(feature.get('name')),
            offsetY: config.textOffsetY,
            font: constructFontString(fontConfig, fontSize),
            fill: new ol.style.Fill({ color: isHighlighted ? '#d32f2f' : config.textFillColor }),
            stroke: new ol.style.Stroke({
                color: config.textStrokeColor,
                width: isHighlighted ? config.textStrokeWidth * 1.3 : config.textStrokeWidth
            })
        }));
    }

    return style;
}

/**
 * Create label style for any settlement feature in the combined settlement layer.
 * Routes to the appropriate settlement style function by feature type.
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createUnifiedSettlementStyle(feature, currentResolution) {
    const featureType = feature.get('featureType');

    if (featureType === 'poi') {
        const poiLayerVisible = typeof mapManager !== 'undefined'
            ? mapManager.getPOILayer()?.getVisible() !== false
            : true;

        return poiLayerVisible ? createPOIStyle(feature, currentResolution) : null;
    }

    if (featureType === 'dwarf') {
        return createDwarfSettlementStyle(feature, currentResolution);
    }

    if (featureType === 'woodelf') {
        return createWoodElfSettlementStyle(feature, currentResolution);
    }

    return createSettlementStyle(feature, currentResolution);
}

/**
 * Create an OpenLayers Style object for a wood elf settlement marker only (no label)
 * Used for the always-visible marker layer underneath the decluttered label layer
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createWoodElfSettlementMarkerOnlyStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        return null;
    }

    const config = STYLES_CONFIG.woodElfSettlements['default'];

    if (!config) {
        return null;
    }

    // Early exit for performance
    if (currentResolution > config.minZoomLevel * 2) {
        return null;
    }

    const showDotVisible = shouldShowDot(config, currentResolution);

    if (!showDotVisible) {
        return null;
    }

    const radius = getInterpolatedRadius(config, currentResolution);
    const isHighlighted = feature.get('highlighted') === true;

    let imageStyle = null;
    if (isHighlighted) {
        imageStyle = new ol.style.Circle({
            radius: radius * 1.3,
            fill: new ol.style.Fill({ color: '#f44336' }),
            stroke: new ol.style.Stroke({
                color: '#d32f2f',
                width: config.strokeWidth * 1.5
            })
        });
    } else {
        const imageCacheKey = `woodelf_marker_${currentResolution.toFixed(4)}`;
        imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
            return new ol.style.Circle({
                radius: radius,
                fill: new ol.style.Fill({ color: config.color }),
                stroke: new ol.style.Stroke({
                    color: config.strokeColor,
                    width: config.strokeWidth
                })
            });
        });
    }

    return new ol.style.Style({
        image: imageStyle,
        zIndex: isHighlighted ? 9999 : 0
    });
}

/**
 * Create an OpenLayers Style object for a dwarf settlement marker only (no label)
 * Used for the always-visible marker layer underneath the decluttered label layer
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createDwarfSettlementMarkerOnlyStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        return null;
    }
    
    const dwarfType = feature.get('dwarfType');
    const config = STYLES_CONFIG.dwarfSettlements[dwarfType];
    
    if (!config) {
        return null;
    }
    
    // Early exit for performance
    if (currentResolution > config.minZoomLevel * 2) {
        return null;
    }
    
    // Check if dot should be visible
    const showDotVisible = shouldShowDot(config, currentResolution);
    
    if (!showDotVisible) {
        return null;
    }
    
    // Get interpolated radius
    const radius = getInterpolatedRadius(config, currentResolution);
    
    // Check if this feature is highlighted (from search)
    const isHighlighted = feature.get('highlighted') === true;
    
    // Cache the circle image - unless highlighted
    let imageStyle = null;
    if (isHighlighted) {
        // Don't cache highlighted styles - create fresh red circle
        imageStyle = new ol.style.Circle({
            radius: radius * 1.3,  // Slightly larger
            fill: new ol.style.Fill({ color: '#f44336' }),  // Red
            stroke: new ol.style.Stroke({ 
                color: '#d32f2f',
                width: config.strokeWidth * 1.5 
            })
        });
    } else {
        const imageCacheKey = `dwarf_marker_${dwarfType}_${currentResolution.toFixed(4)}`;
        imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
            return new ol.style.Circle({
                radius: radius,
                fill: new ol.style.Fill({ color: config.color }),
                stroke: new ol.style.Stroke({ 
                    color: config.strokeColor, 
                    width: config.strokeWidth 
                })
            });
        });
    }
    
    // Return style with only the marker (no text)
    return new ol.style.Style({
        image: imageStyle,
        zIndex: isHighlighted ? 9999 : 0
    });
}
