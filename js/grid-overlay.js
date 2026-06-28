/**
 * Grid overlay for Old World Atlas
 * Provides square and hexagonal grid overlays with configurable size and style
 */

class GridOverlay {
    constructor() {
        this.map = null;
        this.gridLayer = null;
        this.gridSource = null;
        this.gridType = 'off'; // 'off', 'square', or 'hex'
        this.gridSize = 100;
        this.gridUnit = 'miles';
        this.lineWidth = 1;
        this.lineStyle = 'dashed'; // 'solid' or 'dashed'

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
    }

    updateGrid(gridType, gridSize, gridUnit) {
        this.gridType = gridType;
        this.gridSize = gridSize;
        this.gridUnit = gridUnit;

        this.gridSource.clear();

        if (gridType === 'off') {
            this.gridLayer.setVisible(false);
            return;
        }

        if (gridType === 'square') {
            this.generateSquareGrid();
        } else if (gridType === 'hex') {
            this.generateHexGrid();
        }

        this.gridLayer.setVisible(true);
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

    generateSquareGrid() {
        const cellSize = this.distanceToMapUnits(this.gridSize, this.gridUnit);
        const [minX, minY, maxX, maxY] = this.mapExtent;

        const features = [];

        const startX = Math.floor(minX / cellSize) * cellSize;
        const startY = Math.floor(minY / cellSize) * cellSize;
        const endX = Math.ceil(maxX / cellSize) * cellSize;
        const endY = Math.ceil(maxY / cellSize) * cellSize;

        for (let x = startX; x <= endX; x += cellSize) {
            features.push(new ol.Feature({
                geometry: new ol.geom.LineString([[x, minY], [x, maxY]])
            }));
        }

        for (let y = startY; y <= endY; y += cellSize) {
            features.push(new ol.Feature({
                geometry: new ol.geom.LineString([[minX, y], [maxX, y]])
            }));
        }

        this.gridSource.addFeatures(features);
    }

    /**
     * Generate flat-top hexagonal grid.
     * Grid size = side length. Flat-top means top/bottom edges are horizontal.
     */
    generateHexGrid() {
        const side = this.distanceToMapUnits(this.gridSize, this.gridUnit);
        const [minX, minY, maxX, maxY] = this.mapExtent;

        // Flat-top hex geometry:
        //   width  = 2 * side
        //   height = sqrt(3) * side
        //   horizontal spacing between column centers = 1.5 * side
        //   vertical offset for odd columns = height / 2
        const hexW = 2 * side;
        const hexH = Math.sqrt(3) * side;
        const colSpacing = 1.5 * side;
        const rowSpacing = hexH;

        const startCol = Math.floor((minX - side) / colSpacing);
        const endCol = Math.ceil((maxX + side) / colSpacing);
        const startRow = Math.floor((minY - hexH) / rowSpacing);
        const endRow = Math.ceil((maxY + hexH) / rowSpacing);

        // Build a set of unique edge segments to avoid duplicate lines
        const edgeSet = new Set();
        const features = [];

        const roundCoord = (v) => Math.round(v * 1e6) / 1e6;

        const addEdge = (x1, y1, x2, y2) => {
            const rx1 = roundCoord(x1), ry1 = roundCoord(y1);
            const rx2 = roundCoord(x2), ry2 = roundCoord(y2);
            // Canonical ordering so each edge is stored once
            const key = rx1 < rx2 || (rx1 === rx2 && ry1 < ry2)
                ? `${rx1},${ry1}-${rx2},${ry2}`
                : `${rx2},${ry2}-${rx1},${ry1}`;
            if (edgeSet.has(key)) return;
            edgeSet.add(key);
            features.push(new ol.Feature({
                geometry: new ol.geom.LineString([[x1, y1], [x2, y2]])
            }));
        };

        for (let col = startCol; col <= endCol; col++) {
            const cx = col * colSpacing;
            const yOffset = (col % 2 !== 0) ? hexH / 2 : 0;

            for (let row = startRow; row <= endRow; row++) {
                const cy = row * rowSpacing + yOffset;

                // 6 vertices of a flat-top hex, starting from the right
                const verts = [];
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    verts.push([
                        cx + side * Math.cos(angle),
                        cy + side * Math.sin(angle)
                    ]);
                }

                for (let i = 0; i < 6; i++) {
                    const [x1, y1] = verts[i];
                    const [x2, y2] = verts[(i + 1) % 6];
                    addEdge(x1, y1, x2, y2);
                }
            }
        }

        this.gridSource.addFeatures(features);
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
