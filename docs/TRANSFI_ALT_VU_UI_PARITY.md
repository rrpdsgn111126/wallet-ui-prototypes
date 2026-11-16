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

## Каноническое поле списания, валюты и мобильная шапка (16.11.2026)

**Проверенные источники:** исходный компонент [components/fld.html](../components/fld.html) (состояние «Только чтение, серое»), [components/amount.html](../components/amount.html) (монета у суммы), `css/alt-vu-wallet.css` (размеры `.fld`, `.fi`, `.head`). Актуальные экземпляры живых полей в [components/bankfields.html](../components/bankfields.html), [UI Kit](../ui-kit/index.html#bankfields); единственный источник их разметки и логики — `transfi-remittance/legacy.html`. Не подменять оригинал произвольно созданными собственными стилями.

### 1. «Со счёта alt.vu» — один readonly-вариант

- Разметка: `<div class="fld g tf-field tf-source"><div class="fi">Логотип alt.vu</div><div class="fl"><i>Со счёта alt.vu</i><b>Доступно 4 812.60 $</b></div></div>`.
- Контейнер `.fld.g`: 68 px в высоту, радиус 16 px, серый `var(--n100)`, отступы поля 16 px, зазор иконка/текст 14 px; `.fi` 40×40 с логотипом 24×24. Текстовое значение уже содержит единицу доллара.
- **Запрещён дополнительный правый `.addon` / `USD` / суффикс / chevron**. Это не переключатель валютного счёта. Во всех исходящих банковских методах используется одна функция `uxSourceAccountField()`. Для новых вариантов вывода не копировать и не модифицировать её HTML вручную.
- Входящие пополнения не должны искусственно отображать списание с USD-счёта.

### 2. Иконки валют — общий оптический стандарт поля суммы

- У всех EUR/USD/GBP единый генератор `uxCurrencySymbol(code)`, но результат — **векторный** `<svg class="tf-currency-icon">`, а не типографические знаки `€/$/£`.
- Размер SVG **20×20 px**, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="var(--n850)"`, `stroke-width="1.8"`, `stroke-linecap="round"`, `stroke-linejoin="round"`. Серый круг поля `.fi` **40×40 px**, у строк в шторке `.ri` 32×32 px; сама иконка остаётся **20×20**, не растягивается.
- Это та же сетка, что и у монеты `components/amount.html` и других `tfIconFor()`. Толщину и размер не подбирать индивидуально под шрифт или отдельную валюту; не рисовать символы текстом с `font-size:23px`.
- Применение без исключений: фиксированное `Валюта пополнения` в SEPA, `inCurrency` в SWIFT, фиксированное `Валюта получения` в SEPA, `outCurrency` в SWIFT, в том числе **каждая строка нижнего селектора** и выбранное значение после выбора. Для иных валют добавить новый SVG-путь в `uxCurrencySymbol` с тем же оптическим контрактом.
- `Страна получателя` сохраняет отдельный паттерн **круглого SVG-флага 24×24**, не подменять его значком валюты.

### 3. Мобильное положение навбара

- Эталон: `css/alt-vu-wallet.css`, `@media (max-width:740px)`: `.head {padding-top:calc(14px + env(safe-area-inset-top))}`.
- У `legacy.html` на мобильной ширине (в том числе внутри 390/430 px iframe) `.phone.tf-phone:not(.is-home) > .head` использует **те же 14 px плюс safe area**, отступы слева/справа 16 px, снизу 14 px. Нельзя оставлять десктопные `padding-top:52px` внутри мобильного экрана.
- На ширине браузера свыше 740 px сохраняется десктопный шаблон; избегать сдвигов самих элементов навбара дополнительными margin/padding на отдельных банковских экранах.
- Playwright: `tests/bank-qa/smoke.py` проверяет невидимый правый USD, идентичную SVG-геометрию валют и монеты, мобильный отступ на 390 и 430 px, а также исходные действия селекторов.
