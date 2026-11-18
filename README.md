# alt.vu — UX/UI-прототип кошелька

Репозиторий для разработки и проверки интерактивного **фронтенд-прототипа** alt.vu (HTML/CSS/JavaScript). Все платежи, остатки, статусы и банковские реквизиты — демонстрационные. Здесь нет реальной интеграции с backend или TransFi API.

## Ссылки

- [Действующий прототип](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/)
- [Тестовые сценарии и переключение результатов](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/?qa=1)
- [UI Kit — библиотека компонентов](https://rrpdsgn111126.github.io/wallet-ui-prototypes/ui-kit/)

- [Предпросмотр новой дизайн-системы](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/)
- [Отдельный тестовый прототип с новой дизайн-системой](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/transfi-remittance/)
- [UI Kit новой дизайн-системы](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/ui-kit/)

Рабочие ветки: [`work/prototype`](https://github.com/rrpdsgn111126/wallet-ui-prototypes/tree/work/prototype) — изменения прототипа, [`work/design-system`](https://github.com/rrpdsgn111126/wallet-ui-prototypes/tree/work/design-system) — независимые изменения типографики, цветов и компонентов. Публикация содержимого `work/design-system` в `preview/design-system/` — только статическая сборка для просмотра, не перенос изменений в рабочую версию.


## Структура

- `transfi-remittance/` — **единственный действующий прототип** (`index.html`, банковские сценарии в `legacy.html`).
- `components/`, `ui-kit/` — образцы существующих компонентов и их состояний.
- `css/`, `tokens/`, `assets/` — стили, токены и графика.
- `tests/` — автоматизированные проверки.
- [`AGENTS.md`](./AGENTS.md) — точка входа и правила работы AI-агента.
- [`docs/APP_ARCHITECTURE.md`](./docs/APP_ARCHITECTURE.md) — продуктовые ограничения и UX-сценарии.
- [`docs/UI_PATTERNS.md`](./docs/UI_PATTERNS.md) — канонические UI-компоненты и паттерны.

## Локальный запуск

Из корня репозитория:

```bash
python3 -m http.server 8000
```

Открыть `http://localhost:8000/transfi-remittance/` или `http://localhost:8000/ui-kit/`.

## Проверки

При установленных Playwright и Chromium:

```bash
python3 tests/bank-qa/smoke.py
python3 tests/bank-qa/source-flows.py
```

Дополнительная визуальная регрессия — `node tests/bank-parity.mjs` (требуется Playwright для Node.js).

**Новые версии прототипа отдельными каталогами не создавать.** Работать в `transfi-remittance/` и его необходимых зависимостях.
