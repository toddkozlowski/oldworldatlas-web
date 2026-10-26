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
 * The selected feature is highlighted until the card is closed with its X
 * button (or by tapping an empty part of the map).
 */
const MobileCardSheet = {
    mediaQuery: window.matchMedia('(max-width: 768px)'),
    sheetHeightVh: 40,
    sheet: null,
    body: null,

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
                height: ${this.sheetHeightVh}vh;
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
                flex: 1;
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
    },

    open(feature, coordinate) {
        this.body.scrollTop = 0;
        this.sheet.classList.add('open');
        this.select(feature);
        this.keepFeatureVisible(feature, coordinate);
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
     * Pan the map if the feature would end up hidden behind the sheet.
     */
    keepFeatureVisible(feature, coordinate) {
        const geometry = feature.getGeometry();
        const featureCoordinate = geometry && geometry.getType() === 'Point'
            ? geometry.getCoordinates()
            : coordinate;
        const size = this.map.getSize();
        if (!featureCoordinate || !size) {
            return;
        }

        const view = this.map.getView();
        const visibleHeight = size[1] * (1 - this.sheetHeightVh / 100);

        const pan = () => {
            // Search selections zoom to the feature first; wait for that
            if (view.getAnimating()) {
                setTimeout(pan, 100);
                return;
            }
            const pixel = this.map.getPixelFromCoordinate(featureCoordinate);
            if (!pixel || (pixel[1] > 60 && pixel[1] < visibleHeight - 40)) {
                return;
            }
            // Move the feature vertically to the middle of the visible area
            const dy = pixel[1] - visibleHeight / 2;
            const center = this.map.getCoordinateFromPixel([size[0] / 2, size[1] / 2 + dy]);
            view.animate({ center, duration: 250 });
        };
        pan();
    }
};

whenAtlasReady((map) => {
    MobileCardSheet.initialize(map);
    console.log('Atlas test build loaded');
});
