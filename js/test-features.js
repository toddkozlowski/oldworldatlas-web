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

whenAtlasReady(() => {
    console.log('Atlas test build loaded');
    // Add test features here.
});
