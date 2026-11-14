# TransFi: UI alignment with alt.vu source components

**Visual authority:** `transfi-remittance/index.html`, the original archived alt.vu source.

**Scope:** SEPA and SWIFT flows, including both incoming bank details and outgoing configuration, recipient, review, processing and terminal states. No changes to transfer APIs, state machine, validation, or monetary formulas.

| TransFi | Original alt.vu component |
|---|---|
| Frame background / decorative top | `.view`, `.tint` |
| Back navigation and title | `.head .back .h1` |
| Scrollable content | `.wrap.tight` |
| Input, balance source | `.fld.w`, `.fld.g`, `.fi`, `.fl` |
| Bank currency/country/purpose picker | `.fld.w.net-pick` → `.view.ovl` with `.dim` + `.sheet`; `.box > .row > .ri + .rt + .rd` |
| Currency choice | `.seg` |
| Requirements, review | `.box .row .rt .rv` |
| Exchange and fee summary | `.tbl .rl` |
| Review summary | `.amt`, `.amsub` |
| Status indicator | `.hero`, `.okc`, native line-art SVG |
| Primary/secondary CTA | `.foot .btn`, `.btno` |

Bank-only CSS is located at `css/transfi-bank-altvu.css`, is scoped to `.phone.tf-phone` and loaded last by `transfi-remittance/legacy.html`. Do not change the original app-wide CSS or hand-draw new bank components unnecessarily.

**Acceptance:** same computed sizes as alt.vu where component shapes match (field height 68 px, CTA 52 px, title 20 px, box/table radius 20 px); no horizontal scrolling; all existing TransFi states render at 390 and 430 px; SWIFT config → recipient → review → processing works. Automated checks: `tests/bank-parity.mjs` / workflow `transfi-bank-parity.yml`.

## Канонический селектор — по экрану «Пополнение USDT → Сеть»

**Канонический компонент в UI Kit:** [components/bankpicker.html](../components/bankpicker.html) (интерактивные варианты «Страна» и «Валюта»). В каталоге [ui-kit/index.html](../ui-kit/index.html#bankpicker) он открывает **реальный** `uxRenderPicker()` по capture-only параметру `?picker=country|outCurrency` из `legacy.html`. Это специально сделано без копирования логики селектора в библиотеку: пример и рабочий экран используют одну реализацию. Эталон исходного USDT-селектора остаётся [components/netsheet.html](../components/netsheet.html).

Источники в исходном архиве alt.vu: `transfi-remittance/index.html`, извлечённые эталонные HTML-компоненты `components/netpick.html`, `components/netsheet.html`, исходные стили `css/alt-vu-wallet.css` (`.dim`, `.sheet`, `.grab`, `.sh2`, `.box`, `.row`, `.ri`, `.rt`, `.rd`).

- Триггер: стандартное поле `.fld.w` с `.fi` 40×40, `.fl`, стрелкой. Для страны внутри серого круга рисуется **круглая векторная иконка флага 24×24**, а не emoji, текстовый код страны или дополнительный вложенный серый круг.
- Модалка: отдельный экран `.view.ovl.on`; **подложка** `.dim` с `z-index:4`, чёрный фон и `opacity:.4`; **панель** `.sheet` с `z-index:5`, оригинальной верхней тенью, радиусами 24 px, `.grab` и заголовком `.sh2`. Панель обязана быть визуально **над** затемнением, иначе поверх неё появляется серый фильтр.
- Список: **единая белая** `.box`, несколько строк `.row` с внутренними разделителями; **не** отдельные карточки с зазорами и закруглёнными углами. Левая иконка `.ri` 32×32, надпись `.rt`, справа **штатный круглый селектор** `.rd` 24×24. Выбранное — только `.rd.on` с `box-shadow: inset 0 0 0 7px var(--brand)`. Не рисовать галочку, зелёную рамку строки или вторую модель радиоэлемента.
- Поведение: выбор строки меняет значение триггера и закрывает шторку, поля форм сохраняются; тап по затемнению и Escape закрывают без выбора; стрелки клавиатуры / Home / End переводят фокус по строкам. Не разрешать выбор неподдерживаемых стран для SEPA.
- Все банковские селекторы `inCurrency`, `outCurrency`, `country`, `purpose` работают через общий `uxRenderPicker` в `transfi-remittance/legacy.html`. Изменения не затрагивают оригинальную шторку сети USDT.
- Векторные флаги `DE, FR, NL, ES, GB, US` встроены без сторонних зависимостей; в каждой строке списка и в выбранном поле должна быть видна именно графика флага. `aria-checked` выставляется одному пункту, а внешний вид определяется только `.rd.on`.

**Регрессия:** `tests/bank-qa/smoke.py` проверяет поведение и вычисленный `z-index`, стили списка, размер и состояние радиоэлементов, реальные SVG-флаги и клики без `force`. `tests/bank-parity.mjs` проверяет общую визуальную согласованность на 390/430 px. Использовать GitHub Actions `prototype-playwright.yml` и `transfi-bank-parity.yml` перед приемкой.
