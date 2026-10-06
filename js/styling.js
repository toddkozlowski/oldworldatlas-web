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

    // Visual Options: "Label Font" override replaces the configured family
    // with a generic serif stack, applied everywhere since every label
    // style funnels through this function.
    if (typeof getLabelFontMode === 'function' && getLabelFontMode() === 'serif') {
        fontFamily = "'Times New Roman', Georgia, serif";
    }

    // Construct proper CSS font string
    let result = '';
    if (fontStyle !== 'normal') result += fontStyle + ' ';
    if (fontWeight !== 'normal') result += fontWeight + ' ';
    result += fontSize + 'px ';
    result += fontFamily;
    
    return result;
}

/**
 * Get interpolated font size based on zoom level.
 *
 * Normally a single (minFontZoom, maxFontZoom) -> (minFontSize, maxFontSize)
 * interpolation. Configs may optionally add deepMaxFontZoom/deepMaxFontSize
 * for a second segment that only kicks in beyond maxFontZoom (i.e. only at
 * extreme close zoom) - letting labels keep growing past their normal cap
 * without changing sizes at any resolution the normal range already covers.
 * @param {Object} config - Style configuration with min/max font settings
 * @param {number} currentResolution - Current map resolution
 * @returns {number} Interpolated font size
 */
function getInterpolatedFontSize(config, currentResolution) {
    if (config.deepMaxFontZoom !== undefined && currentResolution <= config.maxFontZoom) {
        return Math.round(lerp(
            currentResolution,
            config.maxFontZoom,
            config.deepMaxFontZoom,
            config.maxFontSize,
            config.deepMaxFontSize
        ));
    }
    return Math.round(lerp(
        currentResolution,
        config.minFontZoom,
        config.maxFontZoom,
        config.minFontSize,
        config.maxFontSize
    ));
}

/**
 * Get interpolated dot radius based on zoom level. See getInterpolatedFontSize
 * for the optional deep-zoom second segment (marker.deepMaxRadiusZoom/deepMaxRadius).
 * @param {Object} config - Style configuration with min/max radius settings
 * @param {number} currentResolution - Current map resolution
 * @returns {number} Interpolated radius
 */
function getInterpolatedRadius(config, currentResolution) {
    const marker = config.marker || {};
    if (marker.deepMaxRadiusZoom !== undefined && currentResolution <= marker.maxRadiusZoom) {
        return lerp(
            currentResolution,
            marker.maxRadiusZoom,
            marker.deepMaxRadiusZoom,
            marker.maxRadius || 0,
            marker.deepMaxRadius
        );
    }
    return lerp(
        currentResolution,
        marker.minRadiusZoom || 0,
        marker.maxRadiusZoom || 0,
        marker.minRadius || 0,
        marker.maxRadius || 0
    );
}

/**
 * Get interpolated icon display height (px), for POI types with a
 * config.icon image marker instead of a plain dot. Interpolates
 * config.iconMinSize -> config.iconMaxSize (pixel heights) over
 * config.iconMinZoom -> config.iconMaxZoom - its own zoom breakpoints,
 * independent of the dot marker's marker.minRadiusZoom/maxRadiusZoom (falls
 * back to those if icon-specific ones aren't given). Divide the result by
 * config.iconHeight (the source image's natural pixel height) to get an
 * ol.style.Icon scale factor.
 *
 * Interpolates over log(resolution) rather than raw resolution: resolution
 * shrinks by a constant factor per zoom step (each zoom-in step roughly
 * halves it), so a plain linear lerp over resolution front-loads almost all
 * the growth into the first couple of zoom-in steps and then barely changes
 * for the rest. Log-space makes each zoom step contribute a roughly equal
 * share of growth instead.
 * @param {Object} config - Style configuration with iconMinSize/iconMaxSize
 * @param {number} currentResolution - Current map resolution
 * @returns {number} Interpolated icon height in pixels
 */
function getInterpolatedIconSize(config, currentResolution) {
    const marker = config.marker || {};
    const minZoom = config.iconMinZoom !== undefined ? config.iconMinZoom : (marker.minRadiusZoom || 0);
    const maxZoom = config.iconMaxZoom !== undefined ? config.iconMaxZoom : (marker.maxRadiusZoom || 0);
    const size = lerp(
        Math.log(currentResolution),
        Math.log(minZoom),
        Math.log(maxZoom),
        config.iconMinSize || 0,
        config.iconMaxSize || 0
    );
    // Visual Options: "Large Icons" doubles icon size at every zoom level.
    const isLarge = typeof isLargeIconsEnabled === 'function' && isLargeIconsEnabled();
    return isLarge ? size * 2 : size;
}

/**
 * Half-height (px) of a feature's current marker - the distance from the
 * feature point up to the marker's top edge - for an icon (default OL
 * center anchor, so half its rendered height) or a dot/triangle (its
 * radius; a RegularShape triangle's top vertex is also exactly `radius`
 * above center). Used to keep label text clear of the marker regardless of
 * how big it's currently rendered.
 * @param {Object} config - Style configuration
 * @param {number} currentResolution - Current map resolution
 * @returns {number}
 */
function getMarkerHalfHeight(config, currentResolution) {
    if (configUsesIcon(config)) {
        return getInterpolatedIconSize(config, currentResolution) / 2;
    }
    return getInterpolatedRadius(config, currentResolution);
}

/**
 * Whether a config with an `icon` should actually render it, honoring the
 * Visual Options "Simple Icons" toggle (falls back to the plain dot/shape
 * when enabled).
 * @param {Object} config
 * @returns {boolean}
 */
function configUsesIcon(config) {
    return !!config.icon && !(typeof isSimpleIconsEnabled === 'function' && isSimpleIconsEnabled());
}

/**
 * Cache-key suffix covering the Visual Options that affect a marker's
 * cached image (Simple Icons, Large Icons) - without this, switching
 * either toggle would keep reusing a stale cached Circle/Icon style.
 * @returns {string}
 */
function getVisualOptionsCacheSuffix() {
    const simple = typeof isSimpleIconsEnabled === 'function' && isSimpleIconsEnabled();
    const large = typeof isLargeIconsEnabled === 'function' && isLargeIconsEnabled();
    return `${simple}_${large}`;
}

/**
 * Compute the vertical text offset (px, negative = above the feature point)
 * for a label, so it clears the marker below it - regardless of the
 * marker's current rendered size, and regardless of whether the label
 * itself wraps to two lines.
 *
 * config.textOffsetY is treated as the desired gap beyond the marker's top
 * edge (rather than a fixed offset from the feature's center point, so a
 * large icon gets proportionally more clearance than a small dot; at a
 * small marker size this is close to the original fixed-offset behavior).
 *
 * config.textOffsetY itself is also scaled by how large the current font
 * is relative to the tier's maxFontSize - it was tuned by eye against
 * roughly-max-size text, so using it unscaled at low zoom (where fontSize
 * can be a fraction of that, e.g. 3px vs a 10px max) leaves a gap that
 * reads as oversized relative to the tiny label sitting in it.
 *
 * Text keeps the default 'middle' baseline (small/single-line labels
 * already looked right with it), so a two-line label needs one explicit
 * extra line-height of clearance added on top - otherwise the second line
 * would hang down past the (vertically centered) anchor point and back
 * into the marker.
 * @param {Object} config - Style configuration with textOffsetY
 * @param {Object} markerConfig - Style configuration for the marker (icon/dot) sizing - usually the same object as config, but separate for POI where the marker can belong to a type override
 * @param {number} currentResolution - Current map resolution
 * @param {number} fontSize - current interpolated font size (px), for sizing the multiline compensation
 * @param {boolean} isMultiline - whether the label text wraps to two (or more) lines
 * @returns {number}
 */
function getLabelOffsetY(config, markerConfig, currentResolution, fontSize, isMultiline) {
    const referenceFontSize = config.maxFontSize || fontSize || 1;
    const scaledBaseOffset = config.textOffsetY * (fontSize / referenceFontSize);
    let offset = scaledBaseOffset - getMarkerHalfHeight(markerConfig, currentResolution);
    if (isMultiline) {
        offset -= Math.round(fontSize * 1.15);
    }
    return offset;
}

/**
 * Apply the Visual Options "Text Outline" setting to a configured text
 * stroke width: 'thick' leaves it as configured (the default look),
 * 'thin' scales it down, and 'off' removes it entirely.
 * @param {number} baseWidth - config.textStrokeWidth (or a highlighted variant of it)
 * @returns {number}
 */
function getEffectiveTextStrokeWidth(baseWidth) {
    const mode = typeof getTextOutlineMode === 'function' ? getTextOutlineMode() : 'thick';
    if (mode === 'off') {
        return 0;
    }
    if (mode === 'thin') {
        return baseWidth * 0.4;
    }
    return baseWidth;
}

/**
 * Build the ol.style.Stroke for a label's text outline, honoring the Visual
 * Options "Text Outline" setting - returns undefined (no stroke at all)
 * when it computes to 0, rather than a zero-width ol.style.Stroke. Canvas
 * can still render a hairline for a 0-width stroke (some browsers clamp a
 * requested 0 up to a 1px minimum), so actually omitting the stroke is the
 * only way "Off" reliably means no outline.
 * @param {string} color - config.textStrokeColor
 * @param {number} baseWidth - config.textStrokeWidth (or a highlighted variant of it)
 * @returns {ol.style.Stroke|undefined}
 */
function buildTextStroke(color, baseWidth) {
    const width = getEffectiveTextStrokeWidth(baseWidth);
    if (width <= 0) {
        return undefined;
    }
    return new ol.style.Stroke({ color: color, width: width });
}

/**
 * Whether a config's label uses the atlas' plain default black text
 * (#000) - as opposed to a type's own deliberate color (dwarf holds'
 * brown, wood elf's green, water's blue, provinces'/tribes' faded or red
 * text). The Visual Options "Text Color" toggle only swaps labels in this
 * first group, so intentionally-colored labels aren't touched.
 * @param {Object} config
 * @returns {boolean}
 */
function usesDefaultBlackText(config) {
    return config.textFillColor === '#000';
}

/**
 * Apply the Visual Options "Text Color" setting to a label's fill color:
 * default-black labels become white when the mode is 'light', otherwise
 * unchanged.
 * @param {Object} config
 * @returns {string}
 */
function getEffectiveTextFillColor(config) {
    const mode = typeof getTextColorMode === 'function' ? getTextColorMode() : 'dark';
    if (mode === 'light' && usesDefaultBlackText(config)) {
        return '#fff';
    }
    return config.textFillColor;
}

/**
 * Apply the Visual Options "Text Color" setting to a label's outline
 * color: default-black labels get a black outline (instead of their usual
 * white one) when switched to white fill, so the outline stays visible
 * against the now-white text. Width still separately follows "Text
 * Outline" thick/thin/off via buildTextStroke - only the color changes here.
 * @param {Object} config
 * @returns {string}
 */
function getEffectiveTextStrokeColor(config) {
    const mode = typeof getTextColorMode === 'function' ? getTextColorMode() : 'dark';
    if (mode === 'light' && usesDefaultBlackText(config)) {
        return '#000';
    }
    return config.textStrokeColor;
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
    
    const poiType = feature.get('type');
    const typeOverrides = STYLES_CONFIG.poi[poiType];
    const config = typeOverrides ? { ...STYLES_CONFIG.poi.default, ...typeOverrides } : STYLES_CONFIG.poi.default;
    const isPeak = poiType === 'Mountain Peak';

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
            const imageCacheKey = `poi_img_${poiType}_${getVisualOptionsCacheSuffix()}_${currentResolution.toFixed(4)}`;
            imageStyle = getCachedStyle(STYLE_CACHE.poi, imageCacheKey, () => {
                if (isPeak) {
                    // Dark triangle, like a peak symbol on a topographic map
                    return new ol.style.RegularShape({
                        points: 3,
                        radius: radius,
                        angle: 0, // one point faces up
                        fill: new ol.style.Fill({ color: config.color }),
                        stroke: new ol.style.Stroke({
                            color: config.strokeColor,
                            width: config.strokeWidth
                        })
                    });
                }
                if (configUsesIcon(config)) {
                    const iconHeight = getInterpolatedIconSize(config, currentResolution);
                    return new ol.style.Icon({
                        src: config.icon,
                        scale: iconHeight / config.iconHeight,
                    });
                }
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

        style.setText(new ol.style.Text({
            text: poiLabelText,
            offsetY: getLabelOffsetY(config, config, currentResolution, fontSize, poiLabelText.includes('\n')),
            font: constructFontString(fontConfig, fontSize),
            fill: new ol.style.Fill({ color: isHighlighted ? '#d32f2f' : getEffectiveTextFillColor(config) }),
            stroke: buildTextStroke(getEffectiveTextStrokeColor(config), isHighlighted ? config.textStrokeWidth * 1.3 : config.textStrokeWidth)
        }));
    }
    
    return style;
}

/**
 * Create an OpenLayers Style object for a POI marker only (no label)
 * Used for the always-visible marker layer underneath the decluttered
 * combined settlement/POI label layer, so a POI's icon stays visible
 * even when its label gets decluttered away. Only POI types with a
 * dedicated icon get one; the rest (dots, peaks) declutter with their label.
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createPOIMarkerOnlyStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) {
        return null;
    }

    const poiType = feature.get('type');
    const typeOverrides = STYLES_CONFIG.poi[poiType];
    const config = typeOverrides ? { ...STYLES_CONFIG.poi.default, ...typeOverrides } : STYLES_CONFIG.poi.default;

    // POIs without a dedicated icon are drawn (and decluttered) by the combined label layer only
    if (!config.icon) {
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
        const imageCacheKey = `poi_marker_${poiType}_${getVisualOptionsCacheSuffix()}_${currentResolution.toFixed(4)}`;
        imageStyle = getCachedStyle(STYLE_CACHE.poi, imageCacheKey, () => {
            if (configUsesIcon(config)) {
                const iconHeight = getInterpolatedIconSize(config, currentResolution);
                return new ol.style.Icon({
                    src: config.icon,
                    scale: iconHeight / config.iconHeight,
                });
            }
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
        const labelText = formatLabelText(feature.get('name'));
        style.setText(new ol.style.Text({
            text: labelText,
            offsetY: getLabelOffsetY(config, config, currentResolution, fontSize, labelText.includes('\n')),
            font: constructFontString(fontConfig, fontSize),
            fill: new ol.style.Fill({ color: isHighlighted ? '#d32f2f' : getEffectiveTextFillColor(config) }),
            stroke: buildTextStroke(getEffectiveTextStrokeColor(config), isHighlighted ? config.textStrokeWidth * 1.3 : config.textStrokeWidth)
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
    
    // Keyed by svg_layer (Nation-State, Grand-Province, Province, Sub-Province)
    const config = STYLES_CONFIG.provinces[feature.get('provinceStyleKey')];
    
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
            text: formatLabelText(feature.get('label') || feature.get('name')),
            font: constructFontString(config.textFont, fontSize),
            fill: new ol.style.Fill({ color: getEffectiveTextFillColor(config) }),
            stroke: buildTextStroke(getEffectiveTextStrokeColor(config), config.textStrokeWidth)
        })
    });
}

/**
 * Create an OpenLayers Style object for a tribe label (greenskin, northmen or araby)
 * @param {OL.Feature} feature - OpenLayers feature
 * @param {number} currentResolution - Current map resolution
 * @returns {OL.style.Style}
 */
function createTribeStyle(feature, currentResolution) {
    if (!STYLES_CONFIG) return null;

    const config = STYLES_CONFIG.tribes[getTribeLabel(feature)];

    if (!config) return null;
    if (!shouldShowLabel(config, currentResolution)) return null;

    const fontSize = getInterpolatedFontSize(config, currentResolution);
    const isGreenskin = feature.get('tribeGroup') === 'Greenskins';
    const rawName = feature.get('name') || '';
    const labelText = !isGreenskin
        ? formatLabelText(rawName.toUpperCase())
        : formatWaterLabelText(rawName);
    return new ol.style.Style({
        text: new ol.style.Text({
            text: labelText,
            font: constructFontString(config.textFont, fontSize),
            fill: new ol.style.Fill({ color: getEffectiveTextFillColor(config) }),
            stroke: buildTextStroke(getEffectiveTextStrokeColor(config), config.textStrokeWidth)
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
            fill: new ol.style.Fill({ color: getEffectiveTextFillColor(config) }),
            stroke: buildTextStroke(getEffectiveTextStrokeColor(config), config.textStrokeWidth)
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
            const isFallen = feature.get('isFallen') === true && !!config.fallenIcon;
            const iconSrc = configUsesIcon(config) ? (isFallen ? config.fallenIcon : config.icon) : null;
            const imageCacheKey = `dwarf_img_${dwarfType}_${isFallen}_${getVisualOptionsCacheSuffix()}_${currentResolution.toFixed(4)}`;
            imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
                if (iconSrc) {
                    const iconHeight = getInterpolatedIconSize(config, currentResolution);
                    return new ol.style.Icon({
                        src: iconSrc,
                        scale: iconHeight / config.iconHeight,
                    });
                }
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
        const labelText = formatLabelText(feature.get('name'));
        style.setText(new ol.style.Text({
            text: labelText,
            offsetY: getLabelOffsetY(config, config, currentResolution, fontSize, labelText.includes('\n')),
            font: constructFontString(fontConfig, fontSize),
            fill: new ol.style.Fill({ color: isHighlighted ? '#d32f2f' : getEffectiveTextFillColor(config) }),
            stroke: buildTextStroke(getEffectiveTextStrokeColor(config), isHighlighted ? config.textStrokeWidth * 1.3 : config.textStrokeWidth)
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
            const imageCacheKey = `woodelf_img_${getVisualOptionsCacheSuffix()}_${currentResolution.toFixed(4)}`;
            imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
                if (configUsesIcon(config)) {
                    const iconHeight = getInterpolatedIconSize(config, currentResolution);
                    return new ol.style.Icon({
                        src: config.icon,
                        scale: iconHeight / config.iconHeight,
                    });
                }
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
        const labelText = formatLabelText(feature.get('name'));
        style.setText(new ol.style.Text({
            text: labelText,
            offsetY: getLabelOffsetY(config, config, currentResolution, fontSize, labelText.includes('\n')),
            font: constructFontString(fontConfig, fontSize),
            fill: new ol.style.Fill({ color: isHighlighted ? '#d32f2f' : getEffectiveTextFillColor(config) }),
            stroke: buildTextStroke(getEffectiveTextStrokeColor(config), isHighlighted ? config.textStrokeWidth * 1.3 : config.textStrokeWidth)
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
        const imageCacheKey = `woodelf_marker_${getVisualOptionsCacheSuffix()}_${currentResolution.toFixed(4)}`;
        imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
            if (configUsesIcon(config)) {
                const iconHeight = getInterpolatedIconSize(config, currentResolution);
                return new ol.style.Icon({
                    src: config.icon,
                    scale: iconHeight / config.iconHeight,
                });
            }
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
        const isFallen = feature.get('isFallen') === true && !!config.fallenIcon;
        const iconSrc = configUsesIcon(config) ? (isFallen ? config.fallenIcon : config.icon) : null;
        const imageCacheKey = `dwarf_marker_${dwarfType}_${isFallen}_${getVisualOptionsCacheSuffix()}_${currentResolution.toFixed(4)}`;
        imageStyle = getCachedStyle(STYLE_CACHE.settlements, imageCacheKey, () => {
            if (iconSrc) {
                const iconHeight = getInterpolatedIconSize(config, currentResolution);
                return new ol.style.Icon({
                    src: iconSrc,
                    scale: iconHeight / config.iconHeight,
                });
            }
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
