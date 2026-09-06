/**
 * Visual Options panel: user-toggleable rendering preferences that aren't
 * part of styles-config.json - simple icons (plain dots instead of the
 * graphic icons), large icons (2x icon size), label font family, text
 * outline thickness, and text color. Persisted to localStorage; styling.js's
 * style functions read these live via the getters below, and changing any
 * of them forces every map layer to re-evaluate its style through
 * mapManager.refreshAllStyles() (the same mechanism used when the view's
 * resolution changes).
 */

const VISUAL_OPTIONS_STORAGE_KEYS = {
    simpleIcons: 'visual_simple_icons',
    largeIcons: 'visual_large_icons',
    labelFont: 'visual_label_font',
    textOutline: 'visual_text_outline',
    textColor: 'visual_text_color',
};

const visualOptionsState = {
    simpleIcons: localStorage.getItem(VISUAL_OPTIONS_STORAGE_KEYS.simpleIcons) === 'true',
    largeIcons: localStorage.getItem(VISUAL_OPTIONS_STORAGE_KEYS.largeIcons) === 'true',
    labelFont: localStorage.getItem(VISUAL_OPTIONS_STORAGE_KEYS.labelFont) || 'sans-serif',
    textOutline: localStorage.getItem(VISUAL_OPTIONS_STORAGE_KEYS.textOutline) || 'thick',
    textColor: localStorage.getItem(VISUAL_OPTIONS_STORAGE_KEYS.textColor) || 'dark',
};

function isSimpleIconsEnabled() {
    return visualOptionsState.simpleIcons;
}

function isLargeIconsEnabled() {
    return visualOptionsState.largeIcons;
}

function getLabelFontMode() {
    return visualOptionsState.labelFont;
}

function getTextOutlineMode() {
    return visualOptionsState.textOutline;
}

function getTextColorMode() {
    return visualOptionsState.textColor;
}

function setVisualOption(key, value) {
    visualOptionsState[key] = value;
    localStorage.setItem(VISUAL_OPTIONS_STORAGE_KEYS[key], String(value));
    if (typeof mapManager !== 'undefined' && mapManager.getMap()) {
        mapManager.refreshAllStyles();
    }
}

function initVisualOptions() {
    const simpleIconsCheckbox = document.getElementById('visual-simple-icons');
    const largeIconsCheckbox = document.getElementById('visual-large-icons');
    const fontSansBtn = document.getElementById('visual-font-sans');
    const fontSerifBtn = document.getElementById('visual-font-serif');
    const outlineThickBtn = document.getElementById('visual-outline-thick');
    const outlineThinBtn = document.getElementById('visual-outline-thin');
    const outlineOffBtn = document.getElementById('visual-outline-off');
    const textColorDarkBtn = document.getElementById('visual-text-color-dark');
    const textColorLightBtn = document.getElementById('visual-text-color-light');

    if (simpleIconsCheckbox) {
        simpleIconsCheckbox.checked = visualOptionsState.simpleIcons;
        simpleIconsCheckbox.addEventListener('change', () => {
            setVisualOption('simpleIcons', simpleIconsCheckbox.checked);
        });
    }

    if (largeIconsCheckbox) {
        largeIconsCheckbox.checked = visualOptionsState.largeIcons;
        largeIconsCheckbox.addEventListener('change', () => {
            setVisualOption('largeIcons', largeIconsCheckbox.checked);
        });
    }

    function updateFontButtons() {
        const isSerif = visualOptionsState.labelFont === 'serif';
        if (fontSansBtn) fontSansBtn.classList.toggle('active', !isSerif);
        if (fontSerifBtn) fontSerifBtn.classList.toggle('active', isSerif);
    }
    if (fontSansBtn && fontSerifBtn) {
        updateFontButtons();
        fontSansBtn.addEventListener('click', () => {
            setVisualOption('labelFont', 'sans-serif');
            updateFontButtons();
        });
        fontSerifBtn.addEventListener('click', () => {
            setVisualOption('labelFont', 'serif');
            updateFontButtons();
        });
    }

    function updateOutlineButtons() {
        const mode = visualOptionsState.textOutline;
        if (outlineThickBtn) outlineThickBtn.classList.toggle('active', mode === 'thick');
        if (outlineThinBtn) outlineThinBtn.classList.toggle('active', mode === 'thin');
        if (outlineOffBtn) outlineOffBtn.classList.toggle('active', mode === 'off');
    }
    if (outlineThickBtn && outlineThinBtn && outlineOffBtn) {
        updateOutlineButtons();
        outlineThickBtn.addEventListener('click', () => {
            setVisualOption('textOutline', 'thick');
            updateOutlineButtons();
        });
        outlineThinBtn.addEventListener('click', () => {
            setVisualOption('textOutline', 'thin');
            updateOutlineButtons();
        });
        outlineOffBtn.addEventListener('click', () => {
            setVisualOption('textOutline', 'off');
            updateOutlineButtons();
        });
    }

    function updateTextColorButtons() {
        const isLight = visualOptionsState.textColor === 'light';
        if (textColorDarkBtn) textColorDarkBtn.classList.toggle('active', !isLight);
        if (textColorLightBtn) textColorLightBtn.classList.toggle('active', isLight);
    }
    if (textColorDarkBtn && textColorLightBtn) {
        updateTextColorButtons();
        textColorDarkBtn.addEventListener('click', () => {
            setVisualOption('textColor', 'dark');
            updateTextColorButtons();
        });
        textColorLightBtn.addEventListener('click', () => {
            setVisualOption('textColor', 'light');
            updateTextColorButtons();
        });
    }
}
