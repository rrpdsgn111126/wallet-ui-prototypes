# alt.vu — UX/UI-прототип кошелька

Репозиторий для разработки и проверки интерактивного **фронтенд-прототипа** alt.vu (HTML/CSS/JavaScript). Все платежи, остатки, статусы и банковские реквизиты — демонстрационные. Здесь нет реальной интеграции с backend или TransFi API.

## Ссылки

- [Действующий прототип](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/)
- [Тестовые сценарии и переключение результатов](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/?qa=1)
- [Единый UI Kit — work/design-system](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/ui-kit/)
- [Эталонные экраны и наборы компонентов](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/ui-kit/screens.html)
- [Токены и текстовые стили UI Kit](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/ui-kit/styles.html)
- [Экспериментальные компоненты вывода в UI Kit](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/ui-kit/#g-experiments)
- [Живой экспериментальный прототип вывода](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/transfi-remittance/?experiment=withdraw&mode=usdt)

## Единый UI Kit для экспериментальных сценариев

Ветка `work/design-system` — единственный источник `css/alt-vu-wallet.css` (импортирует `design-system.css` и `tokens/tokens.css`) и компонентов. Ветка `experiment/withdraw-route` подключает опубликованные стили по относительному адресу из `preview/design-system/` и использует их в экспериментальном выводе USDT, USDC и ALT.VU. Раздел `ui-kit/screens.html#g-experimental-compositions` показывает составные примеры из этой ветки, без альтернативной библиотеки; отдельные экспериментальные контролы остались в `ui-kit/index.html#g-experiments`. Слияние исходных веток пока не производится.

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
