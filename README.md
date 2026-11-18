# alt.vu — UX/UI-прототип кошелька

Репозиторий для разработки и проверки интерактивного **фронтенд-прототипа** alt.vu (HTML/CSS/JavaScript). Все платежи, остатки, статусы и банковские реквизиты — демонстрационные. Здесь нет реальной интеграции с backend или TransFi API.

## Ссылки

| Версия | Интерактивный прототип | UI Kit | GitHub |
|---|---|---|---|
| **Основная опубликованная** `main` | [Открыть](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/) | [Открыть](https://rrpdsgn111126.github.io/wallet-ui-prototypes/ui-kit/) | [`main`](https://github.com/rrpdsgn111126/wallet-ui-prototypes/tree/main) |
| **Разработка прототипа** `work/prototype` | [Открыть](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/prototype/transfi-remittance/) | [Открыть](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/prototype/ui-kit/) | [`work/prototype`](https://github.com/rrpdsgn111126/wallet-ui-prototypes/tree/work/prototype) |
| **Новая дизайн-система** `work/design-system` | [Открыть](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/transfi-remittance/) | [Открыть](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/ui-kit/) | [`work/design-system`](https://github.com/rrpdsgn111126/wallet-ui-prototypes/tree/work/design-system) |

Дополнительные страницы: [QA основного прототипа](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/?qa=1), [проектная сборка прототипа](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/prototype/), [сборка новой дизайн-системы](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/).

Рабочие ветки публикуются автоматически как независимые статические копии в `preview/`; исходники `main` не заменяются. Правила выбора веток и согласования слияния — в [`AGENTS.md`](./AGENTS.md).

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
