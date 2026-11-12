# План интеграции TransFi v3 в alt.vu

> Статус: рабочий план для согласования, **не** утверждённые требования к production. Дата: 2026-11-12.
> Основа: [APP_ARCHITECTURE.md](./APP_ARCHITECTURE.md), [прототип v6](../transfi-remittance/index.html), [TransFi Developer Hub](https://docs.transfi.com/docs/welcome-to-transfi-developer-hub).
> Не изменяет существующую бизнес-логику и не предполагает, что TransFi уже подключён к реальному backend.

## 1. Решение и границы

**Рекомендуемый первый релиз:** отдельный модуль «Международный перевод» в существующих «Пополнить» и «Вывести», основанный на готовом прототипе v6, с серверной интеграцией TransFi. Сначала один юридически разрешённый, подтверждённый провайдером банковский коридор; пример для исследования — EUR/SEPA. SWIFT, USD/GBP и дополнительные страны — только после фактической проверки MID, лимитов и реквизитов. Криптопереводы, onramp/offramp и карточные операции не подменять автоматически TransFi.

**Стоп-фактор до production:** [реестр стран TransFi](https://docs.transfi.com/docs/supported-countries) относит Россию (RU) к Prohibited. Казахстан (KZ) не указан: по правилам TransFi неоценённые страны считать недоступными до ответа account manager. Наличие валюты в API не означает доступность её для любых резидентов, паспортов и платёжных направлений. В частности, **не считать TransFi заменой СБП/RUB**. Проверить юридическое лицо клиента, гражданство/резидентство пользователей, источник денег, страну назначения и разрешённый use case.

### Три возможные модели денег — выбрать одну до UX-финализации

1. **Payout с баланса TransFi:** alt.vu предварительно финансирует merchant balance и отправляет деньги получателю. Пользовательский баланс alt.vu — отдельный ledger; backend резервирует средства пользователя и делает payout из merchant funds.
2. **POBO/remittance:** alt.vu действует по распоряжению конечного отправителя; TransFi требует регистрацию/верификацию отправителей и получателей, учёт отношения к клиенту. См. [POBO/COBO](https://docs.transfi.com/docs/pobo-cobo).
3. **Прямой onramp/offramp:** пользователь покупает/продаёт крипто, средства не проходят через merchant balance. Это **иная** юридическая и UX-модель; не использовать её вместо банковского вывода без решения продукта. См. [On/Off-ramp](https://docs.transfi.com/docs/on-ramp-and-off-ramp).

В MVP по умолчанию прорабатывать **вариант 1**, но не включать real-money операции, пока вариант не подтверждён владельцем продукта и провайдером.

## 2. Что есть в репозитории

- [APP_ARCHITECTURE.md](./APP_ARCHITECTURE.md): карта экранов по PNG и HTML-библиотеке. В ней описаны СБП, USDT/USDC, внутренние ALT.VU-переводы, история, KYC, карты, профиль. Это **не** схема реального backend и не контракт ledger.
- [transfi-remittance/index.html](../transfi-remittance/index.html): существующий интерактивный прототип v6. **Пополнение:** in-details / in-pending / in-success / in-held. **Вывод:** out-config / out-recipient / out-review / out-progress / out-success / out-failed / out-held / out-unavailable.
- В v6 пока жёстко заданы: валюты EUR/USD/GBP; страны DE/FR/NL/GB/US/ES; SEPA/SWIFT; комиссия 2.5/18, таблица FX; демонстрационные IBAN, BIC и банк; ручные симуляции статусов. **Ни одно из этих значений не переносить в реальные требования или production.**
- HTML/CSS образцы — reference для визуальной сборки; не работающие банковские интеграции. Сохранять общие светлую/тёмную темы, 390/1440 px и источники компонентов.

## 3. Матрица соответствия пользовательских сценариев и API

| Сценарий alt.vu | TransFi v3 / источник | Что меняем | Приоритет |
| --- | --- | --- | --- |
| Доступность международного метода | GET /v3/config/supported-currencies, GET /v3/config/payment-methods, страна + MID + corridor-policy backend | Показывать только реально разрешённые направления/методы; unavailable вместо неработающего CTA | P0 |
| Текущий пользователь / KYC | POST /v3/senders/mandatory-fields; POST /v3/senders/individual; POST /v3/kyc/standard; GET KYC status; при наличии Sumsub — POST /v3/kyc/share/same-vendor | Привязать altvuUserId к transfiUserId; проверить sender-role, локальные ограничения и согласия | P0 |
| Входящий международный банковский перевод | GET /v3/config/payment-methods/iban; POST /v3/iban/create-iban; GET /v3/iban/list-iban; GET /v3/iban/balance; сопоставление входящих депозитов/order; webhook | in-details, in-pending, in-held, in-success. IBAN и имя владельца приходят только с сервера | P0, если входящие в scope |
| Исходящий международный банковский перевод | GET /v3/config/payment-methods?direction=withdraw; GET /v3/exchange-rates; POST /v3/recipients/mandatory-fields; POST /v3/recipients/individual; POST /v3/orders orderType=payout; GET /v3/orders/{orderId}; webhook | out-config, out-recipient, out-review, out-progress, out-success, out-failed, out-held, out-unavailable | P0, если исходящие в scope |
| Финансирование и доступность средств | GET /v3/balance; при необходимости fiat_prefund/crypto_prefund через POST /v3/orders | Отделить ledger alt.vu, merchant balance TransFi и зарезервированные средства. Не выдавать payout без покрытия | P0 |
| История и детали | GET /v3/orders/{orderId}, List Orders, webhook + **собственный** журнал alt.vu | Добавить международный перевод в общую историю без подмены других типов платежей | P0 |
| Криптопополнение / криптовывод | payin с crypto source / payout с crypto destination + network/tokens | **Возможное расширение**, сравнить с текущим криптопровайдером, не менять автоматически | P2 |
| Fiat ↔ crypto | onramp/offramp + quote, wallet address, KYC | Отдельный продуктовый сценарий с иной моделью платежа | P2 |
| Внутренний ALT.VU P2P / карты / СБП | Не следует напрямую из API TransFi | Без изменений до отдельного решения | Вне scope |

**Важно о маршрутах API:** в TransFi одновременно существуют общие flow guides и более точные страницы API reference. Для IBAN flow guide показывает POST /v3/iban, но [reference](https://docs.transfi.com/reference/create-iban) — POST /v3/iban/create-iban. Для recipient mandatory fields в [гайде payouts](https://docs.transfi.com/docs/payouts) фигурирует GET с query, а [reference](https://docs.transfi.com/reference/get-v3-recipients-mandatory-fields) — POST с body/geo. Для котировки один гайд использует GET /v3/rates, а [reference](https://docs.transfi.com/reference/get-exchange-rates) — GET /v3/exchange-rates. До разработки подтвердить реальные endpoints и response schemas **в sandbox**; при расхождении ориентироваться на актуальную reference и проверенный ответ sandbox, фиксировать версию в API contract.

## 4. Предлагаемая архитектура интеграции

Пользовательский интерфейс alt.vu (web / PWA / TMA)
→ собственный alt.vu backend API
→ TransFi adapter (server-side credentials + MID + allowlist + quote)
→ TransFi v3.

В обратную сторону:
TransFi webhook → verify HMAC on raw bytes → persist event / deduplicate → reconcile order + ledger → status from alt.vu backend → UI / история / уведомление.

**Никогда** не помещать TransFi Basic credentials, MID secrets и webhook secret в клиентскую HTML-страницу, браузерный JS или GitHub Pages. Веб-прототип остаётся mock/demo; для реального API нужен собственный защищённый backend. Указывать в app свои безопасные endpoints, например:
- GET /api/payment-options и GET /api/transfer/quote
- GET /api/international/deposit-details; GET /api/international/deposits
- POST /api/recipients/validate и POST /api/recipients
- POST /api/transfers (с client idempotency key)
- GET /api/transfers/{id}; GET /api/transactions
- POST /internal/webhooks/transfi (только для провайдера с проверкой подписи)

Это **предлагаемые внутренние** маршруты alt.vu, не маршруты TransFi. Итоговые названия согласовать с реальным backend.

Хранить: internalTransactionId, altvuUserId, TransFi userId/role, recipientId, provider orderId, partnerId, corridor, source/destination currencies and amounts, quote snapshot + fee, bank method, ledger reservation, provider status, normalized UI status, timestamps, raw event audit pointer, failure/reconciliation flags. Денежные суммы — decimal/string + явная точность; не JS floating point для платежных расчётов.

## 5. Пользовательские сценарии MVP

### А. Входящий перевод (virtual IBAN)

1. Пользователь открывает «Пополнить → Международный перевод»; backend определяет eligibility, KYC и разрешённые методы.
2. Выбирает разрешённую валюту; показывает доступные банковские rails из конфигурации MID. Не обещать SEPA/SWIFT по эвристике «страна в Европе».
3. Если счёт ещё не создан, backend получает схему/настройки IBAN, создаёт/получает IBAN **для правильного владельца**, сохраняет ownership и показывает реальные реквизиты, имя владельца, reference, ограничения. Владелец IBAN после выдачи неизменяемый.
4. Входящий платёж учитывается после реального события от провайдера; может требовать order matching, sender identification, compliance и KYC. «Нажал отправил» не доказывает поступление.
5. Показывать **ожидается / проверяется (held) / доступно (credited) / требуется действие**; средства в alt.vu зачислять строго после финального provider+ledger confirmation, без двойного кредита.
6. Раздельно спроектировать «входящий депозит без соответствующего заказа», возврат/недопуск, неверный reference и платеж от третьего лица.

Источники: [Virtual Account](https://docs.transfi.com/docs/collect-via-a-virtual-account), [Create Virtual IBAN](https://docs.transfi.com/reference/create-iban), [Creating and Listing IBANs](https://docs.transfi.com/docs/creating-and-listing-ibans).

### Б. Исходящий перевод (payout)

1. «Вывести → Международный перевод»: backend выдаёт доступные страны/валюты/платёжные методы по MID, пользователю и source balance. Для MVP физическое лицо; business recipient — отдельный сценарий.
2. Ввод суммы: проверить balance, currency, min/max, destination amount vs source amount, fees. GET /v3/exchange-rates с orderType=payout; показать явный курс, комиссии и «Получит».
3. По стране и валюте получить **динамические поля** из POST /v3/recipients/mandatory-fields; использовать реальные правила валидации (в т.ч. cross-field). Для SEPA/SWIFT не копировать универсальную статическую форму из v6.
4. Создать/повторно использовать verified recipient по разрешённой модели и показать review: метод → ФИО → страна → счёт → назначение → расчёт. Перед отправкой освежить quote; при изменении расчёта требовать повторного подтверждения.
5. После user authorization/backend risk checks создать **один** payout: POST /v3/orders с orderType=payout, purposeCode, partnerId, source/destination. До запроса атомарно зарезервировать сумму в ledger; при неоднозначном тайм-ауте сначала выяснить состояние по partnerId/orderId, а не отправлять второй payout.
6. После создания показать processing, а не success. Финальное «Доставлен» — только на fund_settled. fund_failed → корректно освободить reservation/восстановить balance после reconciliation; создать новую операцию только по явному действию и новому partnerId.
7. Сохранить операцию в общей истории, показать детали, фактический курс/комиссию/итог, order reference. Квитанцию выдавать только если backend/провайдер действительно генерирует подтверждающий документ.

Источники: [Remittances](https://docs.transfi.com/docs/remittances), [Payouts](https://docs.transfi.com/docs/payouts), [Create Order](https://docs.transfi.com/reference/create-order).

## 6. UI-статусы (нормализованные, не копия provider enum)

| UI | Provider примеры | Что показываем |
| --- | --- | --- |
| preparing | локальная подготовка, quote, KYC | Проверка реквизитов/расчёт, редактирование |
| awaiting_action | initiated, hosted payment / crypto deposit | Ожидаем действие пользователя; реквизиты/ссылка, если применимо |
| processing | fund_processing, fund_deposited, asset_processing | Операция выполняется, повторное списание запрещено |
| review | manual_review / compliance; held/locked IBAN | На проверке, без обещания срока, возможные запрошенные документы |
| succeeded | fund_settled для fiat payout; asset_settled для crypto; подтверждённое ledger credit для входящего | Финальный результат |
| failed | fund_failed, fund_deposit_failed, asset_settle_failed, expired (по конкретному flow) | Причина, возможность исправить реквизиты и **создать новый order** |
| unavailable | corridor/method/KYC prohibit | Отключить CTA и объяснить ограничение |
| needs_attention | неясный статус, разошедшаяся сверка, поздний webhook | Не объявлять успех/провал до проверки, показать обращение в поддержку |

Provider enums зависят от типа order. Не считать redirect после payUrl подтверждением оплаты. [Orders & Statuses](https://docs.transfi.com/docs/orders-and-statuses), [Webhooks](https://docs.transfi.com/docs/webhooks).

## 7. План исполнения и критерии приёмки

**Этап 0 — договорённости / no-go.**
- Подтвердить merchant MID и модель: merchant prefunded payout, POBO или ramp; страны пользователей (гражданство, резидентство), направления и валюты. Отдельно согласовать RU/KZ.
- Установить источник пользовательского balance/ledger, существующий backend, кто делает KYC и кто юридически владеет IBAN/деньгами.
- Выбрать одну комбинацию входящий/исходящий, страна, валюта, тип клиента и payment rail. **Выход:** подписанная corridor matrix и перечень ограничений; иначе разработку реального платежа не начинать.

**Этап 1 — API discovery / sandbox contract.**
- Получить sandbox credentials и MID на backend стороне; запросить поддерживаемые валюты, payment methods, IBAN rails, limits; выполнить dry-run создания recipient, quote, order, IBAN в разрешённом коридоре.
- Проверить спорные маршруты (IBAN/mandatory fields/rates), deviceDetails, invoiceId/document requirements, bank details, order cancellation, статусы и webhooks.
- **Выход:** сохранённые обезличенные request/response fixtures, таблица confirmed/unsupported и mapping field/schema/validation.

**Этап 2 — продуктовая спецификация и UX (на основе v6).**
- Добавить раздел международного перевода в APP_ARCHITECTURE (entry points, eligibility, balance model, navigation, states, data, recovery) после подтверждения этапов 0–1.
- Вынести из прототипа фиксированные страны, валюты, банк, fee и курс; рендерить из конфигурации/fixtures. Сделать dynamic recipient fields и проверки; добавить KYC, unavailable, held, quote changed, insufficient balance, retry-safeguard.
- Использовать компоненты из repo, сохранить существующие сценарии СБП/крипто/P2P; не переписывать UI kit и исходный CSS ради новой фичи.
- **Выход:** кликабельные оба сценария и матрица всех переходов/ошибок (без production денег).

**Этап 3 — backend integration.**
- Реализовать серверный adapter, credential storage, webhook HMAC-SHA256, order/job state machine, idempotency, immutable journal, reconciliation/polling.
- Обеспечить атомарное резервирование денег/восстановление при failed; не делать двойное начисление по повторным webhooks.
- Развести TransFi merchant balance и alt.vu user ledger; добавить аудит, мониторинг, ручной разбор held/unmatched/reversed.
- **Выход:** sandbox end-to-end на реальных API, без hardcoded банковских данных и без секретов в браузере.

**Этап 4 — тестирование/rollout.**
- Playwright: ширина 390 и 1440, светлая/тёмная, Web/PWA/TMA где применимо; тесты keyboard, back, copy bank details, сохранение заполненных полей, loading/empty/errors.
- Sandbox: success, bank decline, KYC required, review, invalid recipient, unavailable corridor, stale quote, timeout, повторное нажатие, refresh browser, missing/out-of-order/duplicate webhook, unlinked IBAN deposit, failure after debit, insufficient TransFi balance.
- Сверить журнал alt.vu с GET order/list orders и settlement/IBAN balances; feature flag для каждого коридора и kill switch. Не включать live операции до согласования finance/compliance.
- **Выход:** тестовые сценарии с логами/скриншотами + sign-off.

## 8. Решения, которые нельзя придумать вместо владельца продукта

1. **Где и кому предоставляем услугу?** Юридическое лицо merchant; гражданство/резидентство отправителя, страна и валюта получателя. RU запрещена, KZ требует отдельного подтверждения.
2. **Что запускаем первым?** Входящий IBAN, исходящий payout или обе стороны; какие конкретные страны/валюты, SEPA или SWIFT; одна ли карта способов на web и TMA.
3. **Откуда уходят деньги?** Пользовательский alt.vu ledger? merchant pre-funded TransFi balance? Прямой crypto-to-fiat? Как замораживаем/возвращаем balance?
4. **Кому принадлежит виртуальный IBAN?** Физическому лицу, merchant или submerchant? Разрешено ли принимать от третьих лиц, чем связываются депозит и user/order?
5. **KYC:** уже есть Sumsub и разрешён ли shared KYC token, либо hosted TransFi? Какие поля/согласия/страны допускаются?
6. **Нормы денег:** комиссии (TransFi + alt.vu), FX quote TTL, округление, лимиты, refunds, settlement, receipt, compliance / dispute workflow.
7. **Backend:** где настоящее приложение и server API (текущий repo содержит HTML-прототип, не сервер); кто будет реализовывать connector, ledger и webhooks?

## 9. Несовпадения в документации для проверки

- Virtual IBAN: flow guide POST /v3/iban, актуальный reference POST /v3/iban/create-iban; список GET /v3/iban vs GET /v3/iban/list-iban.
- Recipient fields: payout guide иллюстрирует GET /v3/recipients/mandatory-fields?country=..., reference указывает POST /v3/recipients/mandatory-fields с geo/type/currencyType.
- Quotes: flow guide использует /v3/rates, reference — /v3/exchange-rates.
- В разных местах по-разному описаны required deviceDetails, partnerId и invoiceId. Использовать более строгий внутренний контракт, реальную обязательность проверить в sandbox и с provider.
- Технический и юридический support matrix зависит от MID и условий договора, а не только от публичных документов.

**Примечание:** анализ документации выполнен без действующих TransFi credentials. Живые запросы, availability payment methods по конкретному MID и фактическая бухгалтерская схема alt.vu не проверены. Этот план — рабочая постановка для product/backend/design, не свидетельство завершённой интеграции.
