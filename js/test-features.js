/**
 * Test-only features for the /test page (atlas-live.html).
 *
 * This file is loaded only by atlas-live.html, after app.js, so anything here
 * can be demoed without affecting the live site. The page sets
 * window.ATLAS_TEST_BUILD = true before any other script runs.
 *
 * Map data loads asynchronously; use whenAtlasReady() to run code once the
 * map exists. When a feature is ready to ship, move it into the shared js/
 * files and index.html, then run tools/sync-pages.py.
 */

function whenAtlasReady(callback) {
    const check = () => {
        if (typeof mapManager !== 'undefined' && mapManager.map) {
            callback(mapManager.map);
        } else {
            setTimeout(check, 100);
        }
    };
    check();
}

/**
 * Mobile bottom-sheet cards.
 *
 * On narrow screens the settlement/POI card is shown in a panel fixed to the
 * bottom of the screen instead of floating next to the feature on the map.
 * Cards with a wiki description take up sheetHeightVh of the screen; shorter
 * cards shrink to fit their content. The selected feature is centred in the
 * part of the map left visible above the card, and stays highlighted until
 * the card is closed with its X button (or by tapping an empty part of the map).
 */
const MobileCardSheet = {
    mediaQuery: window.matchMedia('(max-width: 768px)'),
    sheetHeightVh: 40,
    sheet: null,
    body: null,
    lastZoomRequest: null,  // {resolution, time} of the latest mapManager.zoomToFeature call

    initialize(map) {
        this.map = map;
        this.injectStyles();
        this.createSheet();
        this.patchUiControls();

        // Switching to a desktop-width layout closes the sheet
        this.mediaQuery.addEventListener('change', () => this.close());
    },

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .mobile-card-sheet {
                position: fixed;
                left: 0;
                right: 0;
                bottom: 0;
                max-height: ${this.sheetHeightVh}vh;
                z-index: 10001;
                display: none;
                flex-direction: column;
                background: #fff;
                border-radius: 12px 12px 0 0;
                box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.25);
                padding-bottom: env(safe-area-inset-bottom);
            }
            .mobile-card-sheet.open {
                display: flex;
            }
            .mobile-card-sheet.full {
                height: ${this.sheetHeightVh}vh;
            }
            .mobile-card-sheet-close {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 36px;
                height: 36px;
                border: none;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.06);
                color: #333;
                font-size: 24px;
                line-height: 36px;
                text-align: center;
                cursor: pointer;
                z-index: 1;
            }
            .mobile-card-sheet-close:active {
                background: rgba(0, 0, 0, 0.15);
            }
            .mobile-card-sheet-body {
                flex: 1 1 auto;
                min-height: 0;
                padding-bottom: 12px;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                overscroll-behavior: contain;
            }
            .mobile-card-sheet-body .settlement-popup {
                min-width: 0;
                max-width: none;
            }
            .mobile-card-sheet-body .settlement-popup-header {
                padding-right: 52px;
            }
        `;
        document.head.appendChild(style);
    },

    createSheet() {
        this.sheet = document.createElement('div');
        this.sheet.className = 'mobile-card-sheet';
        this.sheet.setAttribute('role', 'dialog');
        this.sheet.setAttribute('aria-label', 'Location details');

        const closeButton = document.createElement('button');
        closeButton.className = 'mobile-card-sheet-close';
        closeButton.title = 'Close';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => this.close());

        this.body = document.createElement('div');
        this.body.className = 'mobile-card-sheet-body';

        this.sheet.appendChild(closeButton);
        this.sheet.appendChild(this.body);
        document.body.appendChild(this.sheet);
    },

    patchUiControls() {
        const ui = window.uiControls;
        const originalShow = ui.showSettlementPopup.bind(ui);
        const originalHide = ui.hidePopup.bind(ui);

        ui.showSettlementPopup = (feature, coordinate) => {
            if (!this.mediaQuery.matches) {
                this.close();
                return originalShow(feature, coordinate);
            }

            // Render the normal card into the sheet: swap in the sheet body
            // and a no-op overlay so the floating popup never shows or pans.
            originalHide();
            const popupElement = ui.popupElement;
            const popupOverlay = ui.popupOverlay;
            ui.popupElement = this.body;
            ui.popupOverlay = { setPosition() {} };
            try {
                originalShow(feature, coordinate);
            } finally {
                ui.popupElement = popupElement;
                ui.popupOverlay = popupOverlay;
            }
            this.open(feature, coordinate);
        };

        ui.hidePopup = () => {
            originalHide();
            this.close();
        };

        // Search selections zoom to the feature before its card is shown;
        // remember the zoom so open() can redo it with the card accounted for.
        const originalZoom = mapManager.zoomToFeature.bind(mapManager);
        mapManager.zoomToFeature = (feature, zoomLevel) => {
            originalZoom(feature, zoomLevel);
            this.lastZoomRequest = { resolution: zoomLevel ?? 0.005, time: Date.now() };
        };
    },

    open(feature, coordinate) {
        this.body.scrollTop = 0;
        this.sheet.classList.toggle('full', !!this.body.querySelector('.settlement-popup-wiki-description'));
        this.sheet.classList.add('open');
        this.select(feature);
        this.centerFeature(feature, coordinate);
    },

    close() {
        if (!this.sheet.classList.contains('open')) {
            return;
        }
        this.sheet.classList.remove('open');
        this.body.innerHTML = '';
        if (window.searchManager) {
            window.searchManager.clearSelection();
        }
    },

    /**
     * Highlight the feature, tracked by the search manager so that its
     * clearSelection() removes the highlight again.
     */
    select(feature) {
        const search = window.searchManager;
        if (!search || search.selectedFeature === feature) {
            return;
        }
        search.clearSelection();
        search.selectedFeature = feature;
        feature.set('highlighted', true);
    },

    /**
     * Centre the feature in the part of the map left visible above the sheet.
     */
    centerFeature(feature, coordinate) {
        const geometry = feature.getGeometry();
        const featureCoordinate = geometry && geometry.getType() === 'Point'
            ? geometry.getCoordinates()
            : coordinate;
        const size = this.map.getSize();
        if (!featureCoordinate || !size) {
            return;
        }

        const view = this.map.getView();
        const mapTop = this.map.getTargetElement().getBoundingClientRect().top;
        const visibleHeight = Math.min(size[1], this.sheet.getBoundingClientRect().top - mapTop);
        // How far above the map's centre the feature should sit, in pixels
        const offsetPx = size[1] / 2 - visibleHeight / 2;

        // A search selection has just started zooming to the feature: replace
        // that animation with one that ends at the offset centre.
        const zoom = this.lastZoomRequest;
        const fromSearch = !!zoom && Date.now() - zoom.time < 100;
        const resolution = fromSearch ? zoom.resolution : view.getResolution();
        this.lastZoomRequest = null;

        view.cancelAnimations();
        view.animate({
            center: [featureCoordinate[0], featureCoordinate[1] - offsetPx * resolution],
            resolution,
            duration: fromSearch ? 1000 : 250
        });
    }
};

whenAtlasReady((map) => {
    MobileCardSheet.initialize(map);
    console.log('Atlas test build loaded');
});
