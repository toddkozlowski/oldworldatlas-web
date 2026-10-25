/**
 * Grid overlay for Old World Atlas
 * Provides square and hexagonal grid overlays with configurable size and style.
 *
 * To keep small grid sizes from generating an unbounded number of lines, the
 * grid is only built for the visible part of the map (rebuilt after each pan or
 * zoom), and is hidden entirely while its cells would be too small on screen to
 * be useful. A hard minimum grid size and a feature cap act as further limits.
 */

class GridOverlay {
    // Hard limits on the grid size input (in the current distance unit)
    static MIN_GRID_SIZE = 10;
    static MAX_GRID_SIZE = 1000;

    // Grid is hidden while one cell would be smaller than this on screen
    static MIN_CELL_PIXELS = 16;

    // Safety net: never add more line features than this in one pass
    static MAX_FEATURES = 30000;

    // Fraction of the view size added on each side, so short pans don't
    // reveal ungridded edges before the grid is rebuilt
    static VIEW_BUFFER = 0.25;

    constructor() {
        this.map = null;
        this.gridLayer = null;
        this.gridSource = null;
        this.gridType = 'off'; // 'off', 'square', or 'hex'
        this.gridSize = 100;
        this.gridUnit = 'miles';
        this.lineWidth = 1;
        this.lineStyle = 'dashed'; // 'solid' or 'dashed'

        // True while the grid is on but hidden because it would be too dense
        this.tooDense = false;

        // Map extent from the base map tiles
        this.mapExtent = getImageExtent();

        // Conversion factors: map units to distance
        this.MAP_UNITS_TO_MILES = 83.5;
        this.MAP_UNITS_TO_KM = 83.5 * 1.60934;
    }

    initialize(map, gridLayer, gridSource) {
        this.map = map;
        this.gridLayer = gridLayer;
        this.gridSource = gridSource;
        this.gridLayer.setVisible(false);

        // Rebuild the grid for the new view after every pan or zoom
        this.map.on('moveend', () => {
            if (this.gridType !== 'off') this.render();
        });
    }

    static clampGridSize(size) {
        return Math.min(GridOverlay.MAX_GRID_SIZE, Math.max(GridOverlay.MIN_GRID_SIZE, size));
    }

    updateGrid(gridType, gridSize, gridUnit) {
        this.gridType = gridType;
        this.gridSize = GridOverlay.clampGridSize(gridSize);
        this.gridUnit = gridUnit;
        this.render();
    }

    /**
     * Regenerate grid features for the current view.
     */
    render() {
        this.gridSource.clear();

        if (this.gridType === 'off' || !this.map) {
            this.gridLayer.setVisible(false);
            this.setTooDense(false);
            return;
        }

        const view = this.map.getView();
        const resolution = view.getResolution();
        const size = this.map.getSize();
        if (!resolution || !size) {
            this.gridLayer.setVisible(false);
            return;
        }

        // Skip drawing when cells would be too small on screen to be useful
        const cellSize = this.distanceToMapUnits(this.gridSize, this.gridUnit);
        const cellPixels = (this.gridType === 'hex' ? Math.sqrt(3) * cellSize : cellSize) / resolution;
        if (cellPixels < GridOverlay.MIN_CELL_PIXELS) {
            this.gridLayer.setVisible(false);
            this.setTooDense(true);
            return;
        }

        const extent = this.getRenderExtent(view.calculateExtent(size));
        if (!extent) {
            this.gridLayer.setVisible(false);
            this.setTooDense(false);
            return;
        }

        const features = this.gridType === 'hex'
            ? this.generateHexGrid(extent)
            : this.generateSquareGrid(extent);

        this.gridSource.addFeatures(features);
        this.gridLayer.setVisible(true);
        this.setTooDense(false);
    }

    setTooDense(tooDense) {
        if (this.tooDense === tooDense) return;
        this.tooDense = tooDense;
        window.dispatchEvent(new CustomEvent('gridDensityChanged', { detail: { tooDense } }));
    }

    /**
     * The visible extent plus a buffer, clipped to the map extent.
     * Returns null if the view doesn't overlap the map at all.
     */
    getRenderExtent(viewExtent) {
        const [vMinX, vMinY, vMaxX, vMaxY] = viewExtent;
        const bufX = (vMaxX - vMinX) * GridOverlay.VIEW_BUFFER;
        const bufY = (vMaxY - vMinY) * GridOverlay.VIEW_BUFFER;
        const [mMinX, mMinY, mMaxX, mMaxY] = this.mapExtent;

        const minX = Math.max(mMinX, vMinX - bufX);
        const minY = Math.max(mMinY, vMinY - bufY);
        const maxX = Math.min(mMaxX, vMaxX + bufX);
        const maxY = Math.min(mMaxY, vMaxY + bufY);

        if (minX >= maxX || minY >= maxY) return null;
        return [minX, minY, maxX, maxY];
    }

    updateLineStyle(lineWidth, lineStyle) {
        this.lineWidth = lineWidth;
        this.lineStyle = lineStyle;
        this.gridLayer.setStyle(GridOverlay.createGridStyle(lineWidth, lineStyle));
    }

    distanceToMapUnits(distance, unit) {
        if (unit === 'miles') {
            return distance / this.MAP_UNITS_TO_MILES;
        } else {
            return distance / this.MAP_UNITS_TO_KM;
        }
    }

    generateSquareGrid(extent) {
        const cellSize = this.distanceToMapUnits(this.gridSize, this.gridUnit);
        const [minX, minY, maxX, maxY] = extent;

        const features = [];

        // Lines stay anchored to multiples of cellSize so they don't shift when panning
        const startCol = Math.ceil(minX / cellSize);
        const endCol = Math.floor(maxX / cellSize);
        const startRow = Math.ceil(minY / cellSize);
        const endRow = Math.floor(maxY / cellSize);

        for (let col = startCol; col <= endCol && features.length < GridOverlay.MAX_FEATURES; col++) {
            const x = col * cellSize;
            features.push(new ol.Feature({
                geometry: new ol.geom.LineString([[x, minY], [x, maxY]])
            }));
        }

        for (let row = startRow; row <= endRow && features.length < GridOverlay.MAX_FEATURES; row++) {
            const y = row * cellSize;
            features.push(new ol.Feature({
                geometry: new ol.geom.LineString([[minX, y], [maxX, y]])
            }));
        }

        return features;
    }

    /**
     * Generate flat-top hexagonal grid.
     * Grid size = side length. Flat-top means top/bottom edges are horizontal.
     */
    generateHexGrid(extent) {
        const side = this.distanceToMapUnits(this.gridSize, this.gridUnit);
        const [minX, minY, maxX, maxY] = extent;

        // Flat-top hex geometry:
        //   width  = 2 * side
        //   height = sqrt(3) * side
        //   horizontal spacing between column centers = 1.5 * side
        //   vertical offset for odd columns = height / 2
        const hexH = Math.sqrt(3) * side;
        const colSpacing = 1.5 * side;
        const rowSpacing = hexH;

        // One extra hex on each side so the lower edges along the bottom of the
        // extent (drawn as the upper edges of the hexes below) are included
        const startCol = Math.floor((minX - side) / colSpacing);
        const endCol = Math.ceil((maxX + side) / colSpacing);
        const startRow = Math.floor((minY - hexH) / rowSpacing);
        const endRow = Math.ceil((maxY + hexH) / rowSpacing);

        // Vertex offsets of a flat-top hex, starting from the right, counter-clockwise
        const offsets = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            offsets.push([side * Math.cos(angle), side * Math.sin(angle)]);
        }

        const features = [];

        for (let col = startCol; col <= endCol; col++) {
            const cx = col * colSpacing;
            const yOffset = (col % 2 !== 0) ? hexH / 2 : 0;

            for (let row = startRow; row <= endRow; row++) {
                if (features.length >= GridOverlay.MAX_FEATURES) return features;

                const cy = row * rowSpacing + yOffset;

                // Each edge is shared by two hexes, so every hex draws only its
                // three upper edges (upper-right, top, upper-left); its lower edges
                // are the upper edges of the neighbours below it. This yields each
                // edge exactly once without needing to de-duplicate.
                const points = [];
                for (let i = 0; i <= 3; i++) {
                    points.push([cx + offsets[i][0], cy + offsets[i][1]]);
                }
                features.push(new ol.Feature({
                    geometry: new ol.geom.LineString(points)
                }));
            }
        }

        return features;
    }

    static createGridStyle(lineWidth = 1, lineStyle = 'dashed') {
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'rgba(0, 0, 0, 0.3)',
                width: lineWidth,
                lineDash: lineStyle === 'dashed' ? [5, 5] : undefined
            }),
            fill: null
        });
    }
}

const gridOverlay = new GridOverlay();
