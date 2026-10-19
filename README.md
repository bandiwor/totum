# Органайзер

Личное PWA-приложение (iPhone, экран «Домой»). Спецификация и архитектура — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```bash
npm install
npm run dev        # разработка
npm test           # тесты ядра
npm run build      # typecheck + сборка в dist/
npm run preview    # проверить собранную версию (с service worker)
```

Иконки: `public/icons/icon.svg` → `CHROMIUM=/path/to/chrome node scripts/render-icons.mjs`.

Деплой на GitHub Pages пока не настроен (будет GitHub Actions → Pages).
