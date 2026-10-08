BNL V14.1 — SHARE LINK FIX

Fixes:
- Share button always creates public GitHub Pages links, never file:///D:/... links.
- Native Web Share is used only on HTTP(S) secure contexts.
- Opening index.html directly from D:\BNL falls back to copy/prompt instead of invoking the OS share sheet.
- Public base URL: https://seramya68.github.io/bongnilao/

Recommended local test:
  cd D:\BNL
  python -m http.server 5500
  open http://localhost:5500

Production test:
  https://seramya68.github.io/bongnilao/
