#!/usr/bin/env python3
"""
Regenerate atlas-live.html (the /test page) from index.html.

atlas-live.html is index.html plus a few test-only additions:
  - noindex meta tag and a "[TEST]" title prefix
  - a "TEST BUILD" badge in the bottom-left corner
  - window.ATLAS_TEST_BUILD = true, set before any other script runs
  - js/test-features.js, loaded after app.js (cache-busted on every load)

Put demo-only code and CSS in js/test-features.js so it survives re-syncs.
Run from the repository root:  python3 tools/sync-test-page.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'index.html'
TARGET = ROOT / 'atlas-live.html'

HEAD_ADDITIONS = '''
    <!-- TEST BUILD: generated from index.html by tools/sync-test-page.py -->
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

BODY_ADDITIONS = '''
    <div class="test-build-badge" title="Test build - features here may be unfinished">TEST BUILD</div>
'''

TEST_SCRIPT = '''
    <!-- Test-only features (cache-busted on every load) -->
    <script>
        (function () {
            var s = document.createElement('script');
            s.src = 'js/test-features.js?t=' + Date.now();
            document.body.appendChild(s);
        })();
    </script>
'''


def replace_once(html, old, new):
    if html.count(old) != 1:
        raise SystemExit(f'Expected exactly one occurrence of {old!r} in {SOURCE.name}')
    return html.replace(old, new)


def main():
    html = SOURCE.read_text(encoding='utf-8')
    html = replace_once(html, '<title>Atlas of the Old World</title>',
                        '<title>[TEST] Atlas of the Old World</title>')
    html = replace_once(html, '</head>', HEAD_ADDITIONS + '</head>')
    html = replace_once(html, '<body>', '<body>' + BODY_ADDITIONS)
    app_tag = next(line for line in html.splitlines() if 'src="js/app.js' in line)
    html = replace_once(html, app_tag, app_tag + TEST_SCRIPT)
    TARGET.write_text(html, encoding='utf-8')
    print(f'Wrote {TARGET.name} from {SOURCE.name}')


if __name__ == '__main__':
    main()
