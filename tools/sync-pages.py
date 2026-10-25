#!/usr/bin/env python3
"""
Regenerate the pages derived from index.html so they stay in sync with it.

atlas-live.html (the /test page) is index.html plus:
  - noindex meta tag and a "[TEST]" title prefix
  - a "TEST BUILD" badge in the bottom-left corner
  - window.ATLAS_TEST_BUILD = true, set before any other script runs
  - js/test-features.js, loaded after app.js (cache-busted on every load)
  Put demo-only code and CSS in js/test-features.js so it survives re-syncs.

dev.html (developer mode / community contributions) is index.html plus:
  - noindex meta tag and a "Developer Mode" title
  - css/dev-mode.css and a "DEV MODE" badge
  - the username modal, right-click popup and send button from
    tools/dev-page-body.html
  - js/dev-mode.js, loaded before app.js

Run from the repository root:  python3 tools/sync-pages.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'index.html'
SOURCE_TITLE = '<title>Atlas of the Old World</title>'

TEST_HEAD = '''
    <!-- TEST BUILD: generated from index.html by tools/sync-pages.py -->
    <meta name="robots" content="noindex, nofollow" />
    <script>window.ATLAS_TEST_BUILD = true;</script>
    <style>
        .test-build-badge {
            position: fixed;
            bottom: 32px;
            left: 10px;
            z-index: 10000;
            padding: 3px 10px;
            border-radius: 4px;
            background: #b8860b;
            color: #fff;
            font: bold 12px/1.4 'Lucida Grande', Geneva, Arial, Verdana, sans-serif;
            letter-spacing: 0.08em;
            pointer-events: none;
            opacity: 0.85;
        }
    </style>
'''

TEST_BODY = '''
    <div class="test-build-badge" title="Test build - features here may be unfinished">TEST BUILD</div>
'''

TEST_SCRIPTS = '''
    <!-- Test-only features (cache-busted on every load) -->
    <script>
        (function () {
            var s = document.createElement('script');
            s.src = 'js/test-features.js?t=' + Date.now();
            document.body.appendChild(s);
        })();
    </script>
'''

DEV_HEAD = '''
    <!-- DEVELOPER MODE: generated from index.html by tools/sync-pages.py -->
    <meta name="robots" content="noindex, nofollow" />
    <link rel="stylesheet" href="css/dev-mode.css?v=17" />
'''

DEV_BODY = '''
    <div class="dev-badge" title="Developer mode - community contributions">DEV MODE</div>

''' + (ROOT / 'tools' / 'dev-page-body.html').read_text(encoding='utf-8')

PAGES = [
    {
        'target': 'atlas-live.html',
        'title': '<title>[TEST] Atlas of the Old World</title>',
        'head': TEST_HEAD,
        'body': TEST_BODY,
        'scripts_after_app': TEST_SCRIPTS,
    },
    {
        'target': 'dev.html',
        'title': '<title>Atlas of the Old World - Developer Mode</title>',
        'head': DEV_HEAD,
        'body': DEV_BODY,
        'scripts_before_app': '    <script src="js/dev-mode.js?v=17"></script>\n',
    },
]


def replace_once(html, old, new):
    if html.count(old) != 1:
        raise SystemExit(f'Expected exactly one occurrence of {old!r} in {SOURCE.name}')
    return html.replace(old, new)


def build(source, page):
    html = replace_once(source, SOURCE_TITLE, page['title'])
    html = replace_once(html, '</head>', page['head'] + '</head>')
    html = replace_once(html, '<body>', '<body>' + page['body'])
    app_line = next(line for line in html.splitlines(keepends=True) if 'src="js/app.js' in line)
    html = replace_once(html, app_line,
                        page.get('scripts_before_app', '') + app_line + page.get('scripts_after_app', ''))
    return html


def main():
    source = SOURCE.read_text(encoding='utf-8')
    for page in PAGES:
        (ROOT / page['target']).write_text(build(source, page), encoding='utf-8')
        print(f'Wrote {page["target"]} from {SOURCE.name}')


if __name__ == '__main__':
    main()
