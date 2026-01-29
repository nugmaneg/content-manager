# Список задач

## 🔴 Критические / Риск потери данных

### Race Conditions и дубликаты
- [ ] **Race Condition в createRawContent** (`database.grpc.controller.ts:2241-2254`): Параллельные вызовы с одинаковым `sourceId+externalId` могут привести к дубликатам. Между падением `create` и вызовом `findUnique` другой процесс может вставить запись. **Решение:** Использовать Prisma `upsert` вместо паттерна create+catch.
- [ ] **Race Condition в createContent** (`database.grpc.controller.ts:403-418`): Та же проблема для сущностей Content.

### Проблемы с транзакциями
- [ ] **Нет транзакции между Qdrant и Postgres** (`database.grpc.controller.ts:533-549`): `upsertContentVector` сначала сохраняет в Qdrant, затем обновляет Postgres. Если процесс упадёт между операциями, данные станут несогласованными (вектор есть, но `isVectorized=false`). **Решение:** Реализовать compensation pattern или saga.

### Целостность данных
- [ ] **offsetId всегда 0** (`telegram-sync.service.ts:60-66`): Каждый вызов sync получает одни и те же сообщения, потому что `offsetId: 0`. Может вызвать повторную обработку уже синхронизированного контента.

---

## 🔴 Высокий приоритет / Баги
- [ ] **Сохранение FactCheck**: Результаты FactCheck генерируются AI, но не сохраняются в базу данных. Нужно исследовать pipeline (AI Service → Core → Database), чтобы найти, где данные теряются.
- [ ] **Повторная обработка при Sync**: Синхронизация источников запускает AI-обработку для `RawContent`, который уже был обработан. Нужно реализовать проверку и пропускать AI/Vectorization, если контент уже существует и находится в финальном статусе.

### Пробелы в обработке ошибок
- [ ] **Нет retry для векторизации** (`vectorization.service.ts:52-58`): Если OpenAI API упадёт, юнит сохраняется БЕЗ вектора и никогда не повторяется. Юнит остаётся с `qdrant_id=null`, и Topic matching его навсегда пропускает.
- [ ] **Тихий провал при обновлении статуса** (`content-pipeline.processor.ts:148-151`): Если `updateRawContentStatus(FAILED)` упадёт, ошибка проглатывается. RawContent застревает в статусе PROCESSING навсегда.
- [ ] **Нет try-catch в Topic Matching** (`topic-matching.service.ts:49-67`): `searchSimilarUnits` может выбросить исключение, если Qdrant недоступен. Нет fallback, весь pipeline падает.

### Валидация входных данных
- [ ] **Нет валидации в gRPC контроллере** (`database.grpc.controller.ts:2217-2227`): Нет проверок для `sourceId`, `externalId`, `text`. Вызовы JSON.parse могут упасть на некорректном JSON (нет try-catch).

---

## 🟡 Средний приоритет / Технический долг

### Проблемы конкурентного доступа
- [ ] **Неатомарный инкремент версии** (`topic-matching.service.ts:85-87`): `version: topic.version + 1` не атомарен. При конкурентных обновлениях инкременты теряются. **Решение:** Использовать raw SQL `UPDATE SET version = version + 1` или Prisma `increment`.

### Идемпотентность
- [ ] **Нет idempotency key для задач очереди** (`content-pipeline.producer.ts:44-55`): Если контроллер перезапустится во время `waitUntilFinished`, состояние задачи неясно. Повторная отправка того же payload создаёт дублирующую задачу.

### Отсутствующая обработка ошибок
- [ ] **JSON.parse без try-catch** (`database.grpc.controller.ts:2222-2226`): Парсинг `mediaJson`, `urlsJson`, `sourceMetaJson` может упасть на некорректном JSON.

---

## 📊 Сводка по уязвимостям

| Критичность | Кол-во | Категория |
|-------------|--------|-----------|
| 🔴 Критические | 4 | Race conditions, Транзакции, Потеря данных |
| 🔴 Высокие | 5 | Обработка ошибок, Валидация, Существующие баги |
| 🟡 Средние | 3 | Конкурентный доступ, Идемпотентность, Тех. долг |

### Архитектура (для справки)
```
Telegram → TelegramSyncService → createRawContent → Queue(content-pipeline)
                                                            ↓
ContentPipelineProcessor → AI Analysis → Vectorization → Topic Matching
                                                            ↓
                                          Database (Postgres + Qdrant)
```

---

## ✅ Недавно исправлено
- [x] **Дубликаты интерфейсов в gRPC контроллере**: Удалены дублирующиеся определения `GetSourceRequest` и `ListSourcesRequest` в `database.grpc.controller.ts`. Первая версия `ListSourcesRequest` была неполной (отсутствовало поле `active_only`).
- [x] **Невалидный текст в Telegram sync**: Разобрались с проблемой `message.message` в `telegram-sync.service.ts`.
- [x] **Несоответствие gRPC контрактов**: Добавлены недостающие RPC методы `UpsertContentUnitVector`, `UpdateContentUnitTopic` и `SearchSimilarUnits` в `database.proto`.
- [x] **Ошибки создания Topic**:
    - Исправлено нарушение `Topic_categoryId_fkey` путём обработки пустых строк для категорий.
    - Добавлен fallback на `other` для невалидных значений enum `TopicType` (например, "humor").
- [x] **Стабильность инфраструктуры**:
    - Исправлен healthcheck Qdrant (переключён на bash TCP проверку).
    - Добавлены явные зависимости между сервисами в `docker-compose.yml`.
    - Устранены конфликты портов Redis.

### Рефакторинг архитектуры синхронизации (2026-01-29) ✅
- [x] **Разделение ответственности (Clean Architecture)**:
    - Создан интерфейс `SourceSyncService` с унифицированным форматом `SyncMessage`
    - `TelegramSyncService` переработан: теперь отвечает ТОЛЬКО за получение данных из Telegram API
    - `SourceSyncOrchestrator` отвечает за общую логику: проверку дубликатов, создание RawContent, добавление в очередь
- [x] **Двухуровневая защита от дубликатов**:
    - Уровень 1 (адаптер): Incremental sync через `lastSyncedMessageId` в `metadata_json`
    - Уровень 2 (оркестратор): Batch-проверка через новый метод `checkRawContentExists()`
- [x] **Новая gRPC функциональность**:
    - Добавлен метод `CheckRawContentExists` в `database.proto`
    - Реализован в `database.grpc.controller.ts` с batch SELECT для эффективной проверки дубликатов
    - Добавлен в `database.grpc.client.ts` для использования из core-сервиса
- [x] **Модульность и расширяемость**:
    - Архитектура готова для добавления новых источников (RSS, Twitter) без изменения общей логики
    - Удалён старый `SourceSyncService`, внедрён паттерн Strategy через `SourceSyncOrchestrator`
- [x] **Тестирование на реальных данных**:
    - Проверена синхронизация Telegram-канала @RBCCrypto (10 сообщений)
    - Подтверждена работа инкрементальной синхронизации (metadata: lastSyncedMessageId обновляется)
    - Проверены оба уровня дедупликации: адаптер предотвращает лишние API-вызовы, оркестратор предотвращает дубликаты в БД

**Результат**: Архитектура стала модульной, эффективной (меньше запросов к БД), и готова к добавлению новых источников контента.

---
*Создано: 2026-01-23*
*Аудит уязвимостей: 2026-01-23*
*Рефакторинг архитектуры: 2026-01-29*
