# TransFi → UX/UI-прототипы alt.vu: карта данных и экранов

> **2026-11-12 · UX-спецификация · НЕ backend-план.** Источники: [архитектура alt.vu](./APP_ARCHITECTURE.md), [существующий v6](../transfi-remittance/index.html), [TransFi v3](https://docs.transfi.com/docs/welcome-to-transfi-developer-hub).
>
> Сценарии: **«Пополнить → Международный перевод»** и **«Вывести → Международный перевод»**. Все значения в прототипах являются mock, пока не получены реальные ответы sandbox для конкретного merchant/MID. Другие методы alt.vu (СБП, крипто, внутренний перевод, карты) не меняем.

## 1. Принцип сборки прототипов

Мы изучаем **экранные данные**, а не инфраструктуру:
1. API → список опций/схема полей/расчёт/реквизиты/статус.
2. UX → что отображать, как пользователь выбирает, заполняет, подтверждает и исправляет.
3. Прототип → локальные fixtures с такой же структурой и нужными значениями; вручную переключаем сценарии и ошибочные ответы; никаких реальных запросов или ключей.

**Разделять источники:**
- **TransFi**: supported currencies, available rails, required field schemas, virtual account details, FX/fees/limits, order/status, compliance requirements.
- **alt.vu**: названия разделов, навигация, дизайн-система, доступный баланс кошелька, PIN, history, customer-friendly text, аналитика.
- **Пока неизвестно**: продуктовая модель расчётов, какие валюты/страны/методы доступны конкретному MID, имя держателя счёта, реальные purposeCodes, TTL котировки, точные схемы recipient, географические/юридические ограничения.

Не выводить «SEPA в стране X» из принадлежности к ЕС; показывать только метод, который возвращает API и разрешён для пользователя. RU в TransFi prohibited, KZ отсутствует в public countries и требует подтверждения. Для UX использовать **условные тестовые разрешённые коридоры**, помеченные «mock», не выдавать их за активную продуктовую доступность.

## 2. Матрица: API → UI → экран

| API/данные | Конкретные поля для прототипа | Компонент/UI | Когда показывать / ветка |
| --- | --- | --- | --- |
| `GET /v3/config/supported-currencies?direction=deposit/withdraw` | `currency`, `decimalPrecision` (если присутствует), `logoUrl` | Выбор валюты, формат суммы, логотип | Загрузка / данные / пустой список. Список зависит от направления |
| `GET /v3/config/payment-methods?direction=withdraw&currency=…&userType=individual` | `paymentType`, `paymentCode`, label/name, дополнительные требования (если присутствуют) | Список/сегмент банковских способов | При смене страны/валюты/типа получателя перестраивать список; нет метода → unavailable |
| `GET /v3/config/payment-methods/iban?currency=…&beneficiaryType=individual` | supported IBAN rail, `paymentCode` | Метод пополнения | Только реально поддерживаемые IBAN-методы |
| `POST /v3/iban/create-iban` или `GET /v3/iban/list-iban` | `currency`, `status`, `iban`, `bic`, `accountNumber`, `bankName`, `bankAccountHolderName`, `bankAddress`, country, account id | Реквизиты: копировать по полю/всё, предупреждения; пустой/неактивный счёт | Реквизиты показывать **только** после ответа; кто владеет IBAN — решается отдельно |
| `GET /v3/balance/iban` и/или order status | `available`, `locked`, `frozen`, `inTransit` и статус конкретного incoming deposit | Пополнение: доступно / на проверке / ещё не зачислено | Не показывать ожидание **конкретного перевода**, пока депозит не обнаружен |
| `POST /v3/recipients/mandatory-fields` | `inputs[]`, field key, label, required, type, options, validations, зависимые поля | Динамическая форма: текст, select, ошибка под полем, required | Страна/метод/тип получателя изменились → перестроить форму; точные поля из sandbox |
| `POST /v3/recipients/individual` | result recipient `userId`, ошибки валидации/комплаенса | После формы → review, либо error/supplemental information | Идентификатор скрыт от пользователя |
| `GET /v3/exchange-rates` | `sourceCurrency`, `sourceAmount`, `destinationCurrency`, `destinationAmount`, `conversionRate`, `totalFee`, `minLimit`, `maxLimit` и детальная комиссия, если доступна | Расчёт в параметрах и подтверждении | Ошибка котировки, лимит, изменение курса, отсутствие котировки; не выдумывать TTL |
| `POST /v3/orders`, `orderType=payout` | `orderId`, текущее состояние, сумма/валюта/метод/получатель | Отправка → processing; предотвращение повторного CTA | Создано ≠ доставлено |
| `GET /v3/orders/{orderId}`, v3 status events | `initiated`, `fund_processing`, `fund_settled`, `fund_failed`, `manual_review` (конкретный payout) | Статус, детали операции, история, отказ, проверка | Финальный «Доставлено» только `fund_settled`; fail → исправить и новый перевод |
| `GET /v3/kyc/status/{userId}` / KYC requirements (проверить применимость) | status, требуемый уровень/документы, hosted URL если выбран hosted flow | Экран ограничения/проверки личности | Не добавлять повторный KYC по умолчанию, если в alt.vu он уже пройден |

**Не показывать пользователю без необходимости:** `MID`, `partnerId`, `userId`, внутренние роли, секреты, request headers, необработанный ответ API и системные коды ошибок. `orderId` допустимо выводить в деталях как справочный номер.

## 3. Входящий банковский перевод — сценарий IN

**Точка входа:** alt.vu → «Пополнить» → «Международный перевод» (не заменяет СБП/USDT/USDC).

| ID | Экран | Компоненты alt.vu | Данные и поведение |
| --- | --- | --- | --- |
| IN-01 | Валюта и способ | `head`, `seg`/`rows`, `longlist` | Список поддерживаемых валют и IBAN payment methods; при отсутствии — IN-05 |
| IN-02 | Реквизиты для перевода | `head`, `rows`, `tbl`, `btn`, `lnk`, `warn` | Реальные bankAccountHolderName, IBAN, BIC, bankName, bankAddress, accountNumber, optional reference — только если есть в ответе. Копировать каждое поле/всё |
| IN-03 | Обнаружено поступление | `bdg`, `history`, `rows` | **Отдельное состояние**, возникает лишь после обнаружения входящего депозита, не после «Скопировать реквизиты»; показать сумму и дату, если есть |
| IN-04 | Зачислено | `done`, `tbl` | Фактически зачисленная сумма и валюта, транзакция в истории |
| IN-05 | Недоступно / IBAN не выдан | `warn`, `btno` | Нет банковских способов или счёта, понятная причина и возврат к выбору |
| IN-06 | На проверке | `warn`, `bdg` | Известный депозит, но `locked/frozen` / compliance; не показывать деньги как доступные |
| IN-07 | Требуется идентификация | `head`, `warn`, `btn` | Только если ответ/бизнес-правило требует KYC; перейти в существующий flow |

Не создавать экран «Вы отправили платёж» по одному нажатию внутри alt.vu: деньги отправляются во внешнем банке. Не обещать срок зачисления по умолчанию.

## 4. Исходящий банковский перевод — сценарий OUT

**Точка входа:** alt.vu → «Вывести» → «Международный перевод». В первом MVP — получатель физлицо; перевод организации только после отдельного решения.

| ID | Экран | Компоненты alt.vu | Данные и поведение |
| --- | --- | --- | --- |
| OUT-01 | Параметры | `head`, `amount`, `seg`, `rows`, `sheet`, `tbl` | Валюта списания, валюта получения, страна, доступный payment method, сумма, quote, комиссия, получит; применимость и лимиты |
| OUT-02 | Реквизиты получателя | `fld`, `longlist`, `rows`, `warn` | Поля строго из mandatory-fields fixture выбранного коридора; inline-валидация; выбор purposeCode из подтверждённого списка; данные сохраняются при возврате |
| OUT-03 | Проверка перевода | `tbl`, `btn`, `head` | Метод → ФИО → Страна → Счёт → Назначение → Курс, сумма, комиссия, получит; без дополнительного чекбокса; при изменении quote повторное подтверждение |
| OUT-04 | Обрабатывается | `bdg`, `rows`, `history` | Order создан, `initiated` или `fund_processing`; не объявлять успех, не отправлять повторно |
| OUT-05 | Доставлено | `done`, `tbl` | Только `fund_settled`, итоговые данные, ссылка на детали в истории |
| OUT-06 | Не выполнено | `warn`, `btn` | `fund_failed`, доступная причина; «Исправить реквизиты» → новая попытка (не старая операция) |
| OUT-07 | На проверке | `warn`, `bdg` | `manual_review`, без срока и без повторной отправки |
| OUT-08 | Недоступное направление | `warn`, `btno` | Не существует доступного метода / валюты / страны |
| OUT-09 | Недостаточно средств | `warn`, `amount` | Сравнить запрошенное списание с **балансом пользователя alt.vu**, не с merchant balance API |
| OUT-10 | Изменился расчёт | `tbl`, `btn`, `btno` | Изменение курса или суммы/fee на review. Показать предыдущий и новый расчёты; повторное согласие |
| OUT-11 | KYC требуется / проверяется | `head`, `warn`, `btn` | Только если пользователь не имеет нужного статуса |
| OUT-12 | Ошибка реквизитов | `fld`, `warn` | Required, тип, формат, длина, mismatch. Сохранять остальные заполненные поля |

**Логика формы:** не утверждаем, что для всех SWIFT обязательно нужны банк, BIC и адрес. Это конкретные поля только если их вернула схема. В моках можно использовать «SEPA/IBAN», «SWIFT/account+BIC», «US routing/account», но каждый mock отмечать как *пример*, а не фактический API response или гарантированную доступность коридора.

## 5. UX-правила API-driven интерфейса

1. Смена страны/валюты → обновить доступные rails; ранее выбранный метод, которого больше нет, снять; не сбрасывать независимые данные без необходимости.
2. Смена метода/типа получателя → перестроить набор полей по схеме; скрытые поля не включать в отправку и review.
3. Все API options/mock fixtures → loading / success / empty / error. Не показывать интерактивную кнопку при отсутствии обязательной конфигурации.
4. Расчёт → показывать `sourceAmount`, `totalFee`, `conversionRate`, `destinationAmount`; учитывать `minLimit/maxLimit`; при ошибке расчёта скрывать неподтверждённые значения и блокировать подтверждение.
5. Статус созданной операции не равен успешному завершению. `manual_review` — не ошибка и не успех.
6. После `fund_failed` — **новая** операция; нельзя незаметно повторно отправлять прежнюю.
7. Обновление статуса и browser refresh не должны возвращать пользователя на экран подтверждения для уже созданной операции.
8. Не подменять банковские реквизиты локально сгенерированными «валидными» значениями; mock отмечать явно за пределами экрана или в панели тестирования.
9. Сервисные данные, country availability, KYC, срок котировки и комиссия могут быть изменяемы; избегать фиксированных текстовых обещаний.
10. При настройке теста можно выбирать fixtures через внешнюю панель, **не на самом макете**.

## 6. Какие fixtures нужны для проверки

`paymentMethods.json`: has SEPA, only SWIFT, method unavailable, unsupported destination currency.
`ibanAccounts.json`: active EUR account (банковское имя, IBAN, BIC, адрес), not issued, inactive; deposit arrived/locked/credited.
`recipientFields.json`: EU IBAN, alternate bank routing, optional versus required field, one invalid field, schema unavailable.
`exchangeRates.json`: ordinary quote, min/max, fee change, rate change, quote failed, insufficient balance.
`orders.json`: initiated, fund_processing, fund_settled, fund_failed, manual_review, details returned with transaction reference.
`eligibility.json`: allowed, KYC required, KYC pending, country unsupported.

Все валюты, страны и суммы в примерах **искусственные демонстрационные комбинации**, пока нет подтверждённой конкретной конфигурации MID. В v6 тарифы 2.5/18 и FX coefficients — mock, не публичные тарифы TransFi.

## 7. Связь с существующей архитектурой и дизайн-системой

Переиспользовать компоновку приложения, входы «Пополнить»/«Вывести», существующую историю, пустые/ошибочные состояния, `head`, `fld`, `amount`, `rows`, `tbl`, `sheet`, `warn`, `done`, `bdg`, `btn` и токены. Новые композиции: динамическая recipient form, банковские реквизиты с copy action, currency/method availability, банковская quote с previous vs changed, compliance status.

**Результат работ по UX:** доступные кликабельные IN/OUT, управляемые фикстуры, матрица переходов и ошибок, тёмная/светлая темы, ширины 390/1440, референс компонентов. Playwright — проверить CTA/валидацию/навигацию, темы, scrolling, отсутствие runtime errors. Если запуска нет — отметить отсутствие фактической проверки.

## 8. Что нужно выяснить до окончательной фиксации макетов

1. Какая валютная модель отображается на балансе alt.vu и доступна для международного перевода?
2. Для каких **конкретных** стран получателя и банковских rails нужен первый набор экранов?
3. Пополнение через **индивидуальный** IBAN пользователя или банковские реквизиты merchant? Можно ли принимать деньги третьих лиц?
4. Только физлица или также получатели-организации?
5. Какой KYC пользователя уже пройден и должен ли провайдер запрашивать дополнительный?
6. Есть ли утверждённые название продукта, правила переводов, purpose codes, сроки и комиссия alt.vu?

Ответы влияют на реальные данные в UI, но не мешают создать согласовательный **mock-прототип**.

## 9. Проверенные публичные ссылки

- [List Supported Currencies](https://docs.transfi.com/reference/list-supported-currencies)
- [List Payment Methods](https://docs.transfi.com/reference/list-payment-methods)
- [Create and List IBANs](https://docs.transfi.com/docs/creating-and-listing-ibans)
- [Get IBAN Balance](https://docs.transfi.com/reference/get-iban-balance) — актуальная reference `/v3/balance/iban`, старые гайды используют `/v3/iban/balance`
- [Get Recipient Mandatory Fields](https://docs.transfi.com/reference/get-v3-recipients-mandatory-fields) — актуальная reference показывает POST с полем `geo`, старый payout-гайд показывает GET с `country`
- [Get Exchange Rates](https://docs.transfi.com/reference/get-exchange-rates)
- [Create Order](https://docs.transfi.com/reference/create-order)
- [Orders & Statuses](https://docs.transfi.com/docs/orders-and-statuses)
- [Payouts](https://docs.transfi.com/docs/payouts)
- [Virtual Account](https://docs.transfi.com/docs/collect-via-a-virtual-account)
