# alt.vu — UX/UI-прототип кошелька

Репозиторий для разработки и проверки интерактивного **фронтенд-прототипа** alt.vu (HTML/CSS/JavaScript). Все платежи, остатки, статусы и банковские реквизиты — демонстрационные. Здесь нет реальной интеграции с backend или TransFi API.

## Ссылки

- [Действующий прототип](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/)
- [Тестовые сценарии и переключение результатов](https://rrpdsgn111126.github.io/wallet-ui-prototypes/transfi-remittance/?qa=1)
- [Единый UI Kit — work/design-system](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/ui-kit/)

## Экспериментальная ветка: вывод «Откуда → Куда»

Исходники живут в [`experiment/withdraw-route`](https://github.com/rrpdsgn111126/wallet-ui-prototypes/tree/experiment/withdraw-route), созданной от `work/prototype`. Ветка изолирована от `main` и `work/prototype`. В ней один интерактивный прототип, но **нет отдельного UI Kit**: компоненты и стили заимствуются в браузере из опубликованной ветки `work/design-system` через `../../design-system/css/alt-vu-wallet.css` (она импортирует `css/design-system.css` и `tokens/tokens.css`). Источником компонентов остаётся единая библиотека `work/design-system/ui-kit/`; исходники веток не сливаются.

- [Экспериментальный прототип](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/transfi-remittance/)
- [Вывод USDT](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/transfi-remittance/?experiment=withdraw&mode=usdt)
- [Вывод USDC](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/transfi-remittance/?experiment=withdraw&mode=usdc)
- [Перевод ALT.VU](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/withdraw-route/transfi-remittance/?experiment=withdraw&mode=altvu)
- [Экспериментальные компоненты в едином UI Kit](https://rrpdsgn111126.github.io/wallet-ui-prototypes/preview/design-system/ui-kit/#g-experiments)

Изменены только входные экраны USDT, USDC и ALT.VU. Нативные экраны подтверждения, PIN, детали и локальные mock-операции сохранены. **Прототип не отправляет деньги и не подключается к банковскому или блокчейн API.**

## Структура

- `transfi-remittance/` — **единственный действующий прототип** (`index.html`, банковские сценарии в `legacy.html`).
- `components/` — исторические образцы исходного прототипа; актуальные компоненты и их состояния находятся в UI Kit ветки `work/design-system` (отдельная экспериментальная `ui-kit/` удалена).
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

Для проверки актуальных стилей локально подготовьте дизайн-систему рядом с `transfi-remittance/`:

```bash
git fetch origin work/design-system
git worktree add --detach design-system origin/work/design-system
python3 -m http.server 8000
```

Открыть `http://localhost:8000/transfi-remittance/?experiment=withdraw&mode=usdt`. В опубликованной версии стили загружаются автоматически из `/preview/design-system/css/`. Локальная папка `design-system/` — только временное рабочее дерево, не копия UI Kit в исходниках ветки.

## Проверки

При установленных Playwright и Chromium:

```bash
python3 tests/bank-qa/smoke.py
python3 tests/bank-qa/source-flows.py
```

Дополнительная визуальная регрессия — `node tests/bank-parity.mjs` (требуется Playwright для Node.js).

**Новые версии прототипа отдельными каталогами не создавать.** Работать в `transfi-remittance/` и его необходимых зависимостях.
