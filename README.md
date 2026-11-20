# alt.vu — UX/UI-прототип кошелька

Репозиторий для разработки и проверки интерактивного **фронтенд-прототипа** alt.vu (HTML/CSS/JavaScript). Все платежи, остатки, статусы и банковские реквизиты — демонстрационные. Здесь нет реальной интеграции с backend или TransFi API.

## Ссылки

- [Действующий прототип](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/)
- [Тестовые сценарии и переключение результатов](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/?qa=1)
- [UI Kit — библиотека компонентов](https://rrpdsgn111126.github.io/wallet-ui-prototypes/ui-kit/)

## Экспериментальная ветка: вывод «Откуда → Куда»

Исходники живут в [`experiment/withdraw-route`](https://github.com/rrpdsgn111126/wallet-ui-prototypes/tree/experiment/withdraw-route), созданной от `work/prototype`. Ветка изолирована от `main`, `work/prototype` и `work/design-system`. В ней один интерактивный прототип и собственная библиотека UI Kit, опубликованные через независимую копию статических файлов (без merge исходников).

- [Экспериментальный прототип](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/transfi-remittance/)
- [Вывод USDT](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/transfi-remittance/?experiment=withdraw&mode=usdt)
- [Вывод USDC](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/transfi-remittance/?experiment=withdraw&mode=usdc)
- [Перевод ALT.VU](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/transfi-remittance/?experiment=withdraw&mode=altvu)
- [UI Kit экспериментальной ветки](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/ui-kit/#withdraw-route-experiment)

Изменены только входные экраны USDT, USDC и ALT.VU. Нативные экраны подтверждения, PIN, детали и локальные mock-операции сохранены. **Прототип не отправляет деньги и не подключается к банковскому или блокчейн API.**

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
