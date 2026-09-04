/**
 * Populates the topographic key panel's icon legend column (to the left of
 * the topographic colorbar) with every marker/icon style used on the map:
 * the settlement size categories, dwarf hold types (including the fallen
 * Karak variant), and the castle/chaos-shrine/peak POI icons.
 *
 * Every swatch is rendered at the same single reference zoom resolution, so
 * their relative sizes in the legend match how they'd actually compare on
 * the map at that zoom - rather than each being drawn at its own arbitrary
 * "max size", which would misrepresent how big markers really look next to
 * each other.
 */

const MAP_KEY_REFERENCE_RESOLUTION = 0.001;

function escapeHtmlKeyLegend(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function mapKeyCircleSwatch(diameterPx, fillColor, strokeColor, strokeWidth) {
    const size = Math.max(diameterPx, 2);
    return `<span style="
        width:${size}px; height:${size}px;
        background:${fillColor};
        border:${strokeWidth || 1}px solid ${strokeColor || '#000'};
        border-radius:50%;
        display:inline-block;
        box-sizing:border-box;
    "></span>`;
}

// Matches the map's peak marker: ol.style.RegularShape({points: 3, angle: 0})
// - a point faces up.
function mapKeyTriangleSwatch(radiusPx, fillColor, strokeColor, strokeWidth) {
    const r = Math.max(radiusPx, 2);
    const points = [0, 1, 2].map((i) => {
        const angle = -Math.PI / 2 + i * (2 * Math.PI / 3);
        return `${(r + r * Math.cos(angle)).toFixed(2)},${(r + r * Math.sin(angle)).toFixed(2)}`;
    }).join(' ');
    return `<svg width="${r * 2}" height="${r * 2}" viewBox="0 0 ${r * 2} ${r * 2}">
        <polygon points="${points}" fill="${fillColor}" stroke="${strokeColor || '#000'}" stroke-width="${strokeWidth || 1}"/>
    </svg>`;
}

function mapKeyIconSwatch(src, heightPx) {
    const h = Math.max(heightPx, 2);
    return `<img src="${src}" style="height:${h}px; width:auto; display:block;">`;
}

// Renders whatever marker a config actually uses at the reference
// resolution: its icon if it has one, otherwise its dot.
function mapKeySwatchForConfig(config, resolution) {
    if (config.icon) {
        return mapKeyIconSwatch(config.icon, getInterpolatedIconSize(config, resolution));
    }
    const radius = getInterpolatedRadius(config, resolution);
    return mapKeyCircleSwatch(radius * 2, config.color, config.strokeColor, config.strokeWidth);
}

function mapKeyRenderSection(title, rows) {
    const rowsHTML = rows.map((row) => `
        <div class="map-key-legend-row">
            <span class="map-key-legend-swatch">${row.swatch}</span>
            <span class="map-key-legend-label">${escapeHtmlKeyLegend(row.label)}</span>
        </div>`).join('');
    return `<div class="map-key-legend-section-title">${escapeHtmlKeyLegend(title)}</div>${rowsHTML}`;
}

function buildMapKeyLegend() {
    const container = document.getElementById('map-key-legend');
    if (!container || !STYLES_CONFIG) {
        return;
    }

    const res = MAP_KEY_REFERENCE_RESOLUTION;
    const sections = [];

    // Human settlements - all 6 size categories
    const settlementRows = [1, 2, 3, 4, 5, 6].map((sizeCategory) => {
        const config = STYLES_CONFIG.settlements.sizeCategories[String(sizeCategory)];
        return { label: getSizeCategoryLabel(sizeCategory), swatch: mapKeySwatchForConfig(config, res) };
    });
    sections.push(['Settlements', settlementRows]);

    // Dwarf holds
    const dwarfRows = [
        { type: 'Grung', label: 'Mining Settlement' },
        { type: 'Khazid', label: 'Town / Fortress' },
        { type: 'Karak', label: 'Great Hold' },
    ].map(({ type, label }) => ({ label, swatch: mapKeySwatchForConfig(STYLES_CONFIG.dwarfSettlements[type], res) }));
    const karakConfig = STYLES_CONFIG.dwarfSettlements['Karak'];
    if (karakConfig && karakConfig.fallenIcon) {
        dwarfRows.push({
            label: 'Fallen Great Hold',
            swatch: mapKeyIconSwatch(karakConfig.fallenIcon, getInterpolatedIconSize(karakConfig, res)),
        });
    }
    sections.push(['Dwarf Holds', dwarfRows]);

    // POI icons
    const poiDefault = STYLES_CONFIG.poi.default;
    const castleConfig = { ...poiDefault, ...STYLES_CONFIG.poi['Forts and Castles'] };
    const chaosConfig = { ...poiDefault, ...STYLES_CONFIG.poi['Chaos Shrines'] };
    const peakConfig = { ...poiDefault, ...STYLES_CONFIG.poi['Peaks'] };
    const poiRows = [
        { label: 'Fort / Castle', swatch: mapKeySwatchForConfig(castleConfig, res) },
        { label: 'Chaos Shrine', swatch: mapKeySwatchForConfig(chaosConfig, res) },
        {
            label: 'Peak',
            swatch: mapKeyTriangleSwatch(getInterpolatedRadius(peakConfig, res), peakConfig.color, peakConfig.strokeColor, peakConfig.strokeWidth),
        },
    ];
    sections.push(['Points of Interest', poiRows]);

    container.innerHTML = sections.map(([title, rows]) => mapKeyRenderSection(title, rows)).join('');
}
