# Database Architecture — Content Manager

Этот документ описывает проектируемую архитектуру базы данных для системы управления контентом.

---

## Обзор

Система состоит из двух уровней:

1. **Global Layer** — общий пул контента и топиков, независимый от пользователей
2. **Workspace Layer** — пользовательские пространства со своими настройками и статусами публикаций

```
┌─────────────────────────────────────────────────────────────────────┐
│                     GLOBAL LAYER (Shared)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Source ──> Content ──> Topic                                      │
│                              │                                       │
│                              └── Category, Tags, Media               │
│                                                                      │
│   Контент собирается из источников, группируется в топики,          │
│   обогащается AI-анализом. Не принадлежит никакому workspace.       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WorkspaceStory (связь M:N)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     WORKSPACE LAYER (Per-tenant)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   User ──> Workspace ──┬──> WorkspaceDonor ──> Source               │
│                        │                                             │
│                        ├──> WorkspaceTopic ──> Topic (со статусом)  │
│                        │                                             │
│                        └──> Target (каналы публикации)              │
│                                                                      │
│   Каждый workspace видит глобальные топики через свою призму:       │
│   свои статусы, приоритеты, настройки публикации.                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Модели данных

### 1. Source (Источник)

Канал-донор, откуда парсится контент. Глобальная сущность — один источник может использоваться в разных workspace.

```prisma
model Source {
  id         String  @id @default(uuid())
  type       String  // 'telegram', 'twitter', 'rss', etc.
  externalId String  // channel username, feed URL, etc.
  
  // === Общие поля (заполняются при парсинге) ===
  name        String?  // Название канала/источника
  description String?  // Описание
  avatarUrl   String?  // Аватар/логотип
  language    String?  // Язык контента (ru, en, ...)
  url         String?  // Ссылка на источник (t.me/channel, twitter.com/user)
  
  // === Специфичные данные (зависят от type) ===
  metadata Json?
  // Telegram: { subscriberCount, isVerified, isChannel, ... }
  // RSS: { feedUrl, siteUrl, generator, ... }
  // Twitter: { followersCount, isBlueVerified, ... }
  
  isActive   Boolean   @default(true)
  lastSyncAt DateTime? // Когда последний раз синхронизировали метаданные

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  contents                 Content[]
  workspaceDonors          WorkspaceDonor[]
  integrationAccountSources IntegrationAccountSource[]

  @@unique([type, externalId])
  @@index([type])
  @@index([language])
}

// Связь: какие аккаунты могут парсить какие источники
model IntegrationAccountSource {
  accountId   String
  sourceId    String
  
  account     IntegrationAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  source      Source             @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  
  isExclusive Boolean @default(false) // Только этот аккаунт может парсить (закрытый канал)
  priority    Int     @default(0)     // Приоритет выбора аккаунта
  isActive    Boolean @default(true)
  
  createdAt   DateTime @default(now())

  @@id([accountId, sourceId])
  @@index([sourceId])
}
```

**Примеры metadata для разных типов:**

```typescript
// Telegram
interface TelegramSourceMetadata {
  subscriberCount?: number;
  isVerified?: boolean;
  isChannel?: boolean;  // true = канал, false = группа
  linkedChatId?: string;
}

// RSS
interface RssSourceMetadata {
  feedUrl: string;
  siteUrl?: string;
  generator?: string;
  ttl?: number;
}

// Twitter
interface TwitterSourceMetadata {
  followersCount?: number;
  followingCount?: number;
  isBlueVerified?: boolean;
  joinedAt?: string;
}
```

---


---

### 2. Content (Контент)

Один пост/сообщение из источника. Сырые данные.

```prisma
model Content {
  id         String   @id @default(uuid())
  externalId String   // ОБЯЗАТЕЛЬНО! Message ID from source (for deduplication)

  text    String?  // Original text content
  rawData Json?    // Full raw data from source

  // Связь с источником
  sourceId String
  source   Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  // Через какой аккаунт получен (для дедупликации)
  receivedViaId String?
  receivedVia   IntegrationAccount? @relation(fields: [receivedViaId], references: [id])

  // Статус обработки
  status ContentStatus @default(pending)

  // Векторное хранилище
  qdrantId       String?  @unique
  isVectorized   Boolean  @default(false)
  embeddingModel String?  // "text-embedding-3-large", для пересчёта при смене модели


  // AI Analysis
  aiAnalysis Json?

  // Timestamps
  sourceDate DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  // Связи
  media         Media[]
  contentTopics ContentTopic[]

  @@unique([sourceId, externalId])
  @@index([sourceId])
  @@index([status])
  @@index([isVectorized])
  @@index([createdAt])
}

enum ContentStatus {
  pending       // Только получен
  parsing       // Парсится
  parsed        // Распаршен
  ai_analyzing  // AI анализирует
  ai_analyzed   // AI проанализировал
  vectorizing   // Создаётся embedding
  ready         // Полностью обработан
  error         // Ошибка обработки
}
```

---

### 3. Media (Медиа-файлы)

Изображения, видео, документы привязанные к контенту.

```prisma
model Media {
  id        String @id @default(uuid())
  contentId String
  content   Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  type      MediaType // image, video, audio, document
  url       String    // URL в storage
  mimeType  String?
  size      Int?      // bytes
  metadata  Json?     // width, height, duration, etc.

  // AI анализ медиа
  aiAnalysis Json?    // Описание, водяные знаки, пригодность и т.д.
  
  // Для векторного поиска по изображениям (на будущее)
  qdrantId String? @unique

  createdAt DateTime @default(now())

  @@index([contentId])
  @@index([type])
}

enum MediaType {
  image
  video
  audio
  document
}
```

**Структура aiAnalysis для изображений:**

```typescript
interface ImageAiAnalysis {
  // Описание содержимого
  description: string;           // "Фото митинга на Красной площади"
  detectedObjects?: string[];    // ["люди", "флаги", "здание"]
  
  // Текст на изображении (OCR)
  extractedText?: string;        // Если есть текст на фото
  
  // === Оценка пригодности к публикации ===
  usabilityScore: number;        // 0-1, где 1 = идеально для публикации
  // 0.9-1.0: Отлично, можно публиковать автоматически
  // 0.7-0.9: Хорошо, рекомендуется к публикации
  // 0.5-0.7: Средне, требует ревью редактора
  // 0.2-0.5: Плохо, есть проблемы
  // 0.0-0.2: Не рекомендуется публиковать
  
  usabilityIssues?: string[];    // ["watermark", "low_quality", "nsfw", "blurry"]
  
  // Детальные проверки
  hasWatermark: boolean;
  watermarkInfo?: string;        // "Getty Images" / "Shutterstock"
  
  // Качество
  qualityScore: number;          // 0-1
  isBlurry: boolean;
  resolution: 'high' | 'medium' | 'low';
  
  // Дополнительно
  dominantColors?: string[];     // ["#FF0000", "#FFFFFF"]
  faces?: number;                // Количество лиц
  nsfw: boolean;                 // Неприемлемый контент
  nsfwScore?: number;            // 0-1, уровень уверенности
}
```



**Структура aiAnalysis для видео:**

```typescript
interface VideoAiAnalysis {
  // Описание содержимого
  description: string;           // "Видеорепортаж с митинга в Москве"
  detectedObjects?: string[];    // ["люди", "флаги", "полиция"]
  
  // Метаданные видео
  duration: number;              // секунды
  hasAudio: boolean;
  hasSubtitles: boolean;
  language?: string;             // Язык речи в видео
  
  // Транскрипция (если есть речь)
  transcript?: string;           // Расшифровка аудио
  
  // === Оценка пригодности к публикации ===
  usabilityScore: number;        // 0-1, где 1 = идеально для публикации
  // 0.9-1.0: Отлично, можно публиковать
  // 0.7-0.9: Хорошо
  // 0.5-0.7: Требует ревью
  // 0.0-0.5: Проблемы
  
  usabilityIssues?: string[];    // ["watermark", "low_quality", "nsfw", "copyrighted_music"]
  
  // Детальные проверки
  hasWatermark: boolean;
  watermarkInfo?: string;
  hasCopyrightedMusic: boolean;  // Защищённая музыка (риск блокировки)
  
  // Качество
  qualityScore: number;          // 0-1
  resolution: '4k' | '1080p' | '720p' | '480p' | 'lower';
  isStable: boolean;             // Стабильная картинка (не трясётся)
  hasGoodLighting: boolean;
  
  // NSFW
  nsfw: boolean;
  nsfwScore?: number;            // 0-1
  
  // Ключевые кадры (превью)
  keyFrames?: {
    timestamp: number;           // секунда
    description: string;         // "Общий план толпы"
    thumbnailUrl?: string;       // URL превью
    usabilityScore?: number;     // Пригодность кадра как обложки
  }[];
  
  // Рекомендуемая обложка
  suggestedThumbnail?: {
    timestamp: number;
    reason: string;              // "Чёткий кадр с хорошим освещением"
  };
}
```

**Структура aiAnalysis для аудио:**

```typescript
interface AudioAiAnalysis {
  // Описание содержимого
  description: string;           // "Подкаст о политике / Голосовое сообщение"
  
  // Метаданные
  duration: number;              // секунды
  language?: string;             // Язык речи
  speakerCount?: number;         // Количество говорящих
  
  // Транскрипция
  transcript?: string;           // Полная расшифровка
  transcriptSegments?: {         // Сегменты с таймкодами
    start: number;
    end: number;
    text: string;
    speaker?: string;            // "Speaker 1" / имя
  }[];
  
  // === Оценка пригодности к публикации ===
  usabilityScore: number;        // 0-1
  usabilityIssues?: string[];    // ["low_quality", "background_noise", "copyrighted_music"]
  
  // Детальные проверки
  hasCopyrightedMusic: boolean;  // Защищённая музыка
  hasBackgroundNoise: boolean;   // Много шума
  
  // Качество
  qualityScore: number;          // 0-1
  isClear: boolean;              // Чистый звук без помех

  
  // Тип контента
  contentType: 'speech' | 'music' | 'mixed' | 'ambient';
  
  // NSFW (ненормативная лексика и т.д.)
  nsfw: boolean;
  nsfwScore?: number;            // 0-1
}
```

---


---


### 4. Topic (Топик / Рабочая единица)

Агрегирует один или несколько Content. Это то, с чем работает редактор.

```prisma
model Topic {
  id   String    @id @default(uuid())
  type TopicType // news, opinion, guide, etc.

  title    String  // Заголовок (AI-генерированный или из контента)
  summary  String? // Краткое описание (AI)
  language String  @default("ru") // Язык контента топика

  // Категория
  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id])

  // Дата события (необязательно, для сводок/новостей)
  eventDate DateTime? 

  // Векторное хранилище (для поиска похожих)
  qdrantId       String? @unique
  embeddingModel String? // Какой моделью создан вектор


  // Версионирование (для отслеживания обновлений)
  version       Int      @default(1)
  lastUpdatedAt DateTime @default(now())

  // === Актуальность (Freshness) ===
  expiresAt      DateTime? // Когда топик станет неактуальным
  relevanceScore Float     @default(1.0) // 0-1, падает со временем
  isExpired      Boolean   @default(false)

  // Timestamps
  firstSeenAt DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Связи
  contentTopics   ContentTopic[]
  topicTags       TopicTag[]
  workspaceTopics WorkspaceTopic[]

  @@index([type])
  @@index([categoryId])
  @@index([createdAt])
}

enum TopicType {
  news         // Новость о конкретном событии (группируется)
  opinion      // Мнение, колонка, аналитика
  rumor        // Слух, неподтверждённая информация (группируется)
  guide        // Гайд, инструкция, how-to
  review       // Обзор, рецензия
  digest       // Дайджест, сборник
  announcement // Анонс, релиз
  quote        // Цитата, высказывание
  other        // Прочее
}
```

**Логика группировки по типам:**

| Тип | Группировка | Описание |
|-----|-------------|----------|
| news | По событию | AI ищет совпадения и объединяет |
| rumor | По событию | Слухи из разных источников объединяются |
| opinion | Нет | Каждое мнение — отдельный топик |
| guide | Нет | Каждый гайд — отдельный топик |
| review | Нет | Каждый обзор — отдельный топик |
| digest | Ручная | Создаётся вручную редактором |
| announcement | Нет | Каждый анонс — отдельный топик |
| quote | Нет | Каждая цитата — отдельный топик |

---

### Логика актуальности (AI-Driven Freshness)

Вместо жестких констант, время жизни каждого топика (`expiresAt`) определяется **AI-сервисом** на этапе анализа.

**Как это работает:**
1. **Первичный анализ**: AI оценивает масштаб события, его тип и контекст.
   - *Пример:* Новость о пробке — TTL 1 час.
   - *Пример:* Научное открытие — TTL 6 месяцев.
2. **Динамическое продление**: При добавлении нового контента (`ContentTopic`) в существующий топик, AI может пересмотреть срок актуальности.
3. **Обоснование**: AI может сохранять причину выбора срока (`aiRelevanceReasoning`), чтобы куратор понимал логику системы.

**Защита при публикации:**
Если `now > topic.expiresAt`, в интерфейсе отображается статус "Outdated", а автоматические процессы публикации игнорируют этот топик.


---

### 5. ContentTopic (Связь Content ↔ Topic)

Many-to-Many связь. Один Content может быть в нескольких Topic (редко), один Topic содержит несколько Content.

```prisma
model ContentTopic {
  id        String @id @default(uuid())
  contentId String
  topicId   String
  
  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)
  topic   Topic   @relation(fields: [topicId], references: [id], onDelete: Cascade)

  isPrimary Boolean @default(false) // Главный контент для топика
  addedAt   DateTime @default(now())

  @@unique([contentId, topicId])
  @@index([topicId])
}
```

---

### 5.5. TopicRelation (Связи между топиками) — *На будущее*

Связи для follow-up новостей, опровержений и связанных историй.

```prisma
model TopicRelation {
  id            String       @id @default(uuid())
  
  parentTopicId String
  childTopicId  String
  
  parentTopic   Topic        @relation("TopicParent", fields: [parentTopicId], references: [id], onDelete: Cascade)
  childTopic    Topic        @relation("TopicChild", fields: [childTopicId], references: [id], onDelete: Cascade)
  
  relationType  RelationType
  confidence    Float?       // Уверенность AI в связи (0-1)
  
  createdAt     DateTime     @default(now())

  @@unique([parentTopicId, childTopicId])
  @@index([parentTopicId])
  @@index([childTopicId])
}

enum RelationType {
  FOLLOW_UP    // Продолжение истории
  RELATED      // Похожая тема
  CONTRADICTS  // Опровергает предыдущую
  UPDATE       // Обновление старой новости
}
```

**Примеры использования:**
- `FOLLOW_UP`: «Суд начался» → «Суд вынес приговор»
- `CONTRADICTS`: «Компания обанкротилась» → «Опровержение»
- `UPDATE`: «Пожар в здании» → «Пожар потушен»

> ⚠️ **MVP**: Эта модель не используется в первой версии. Подключим позже для таймлайнов и связанных историй.



---

### 6. Category (Категория)

Фиксированный справочник категорий. AI выбирает из существующих.

```prisma
model Category {
  id          String @id @default(uuid())
  name        String @unique
  slug        String @unique
  description String?

  // Иерархия (опционально)
  parentId String?
  parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children Category[] @relation("CategoryHierarchy")

  createdAt DateTime @default(now())

  topics           Topic[]
  targetCategories TargetCategory[]

  @@index([parentId])
}
```

---

### 7. Tag (Тег)

Динамические теги, генерируются AI.

```prisma
model Tag {
  id         String @id @default(uuid())
  name       String @unique
  slug       String @unique
  usageCount Int    @default(0)

  createdAt DateTime @default(now())

  topicTags TopicTag[]

  @@index([usageCount])
}

model TopicTag {
  id      String @id @default(uuid())
  topicId String
  tagId   String

  topic Topic @relation(fields: [topicId], references: [id], onDelete: Cascade)
  tag   Tag   @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([topicId, tagId])
  @@index([tagId])
}
```

---

### 7.5. AiAgent (Настройки ИИ)

Конфигурации для различных задач (классификация, саммари, рерайтинг).

```prisma
model AiAgent {
  id          String   @id @default(uuid())
  name        String   // "Summarizer v1", "Telegram Rewriter"
  role        AiRole   // CLASSIFIER, SUMMARIZER, POST_MAKER
  modelName   String   // "gpt-4o", "claude-3-5-sonnet"
  
  systemPrompt String  // Системный промпт
  temperature  Float   @default(0.7)
  
  settings     Json?   // { maxTokens, stopSequences, topP, etc. }
  
  isActive     Boolean @default(true)
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Можно привязать агента к конкретному воркспейсу
  workspaceId  String?
  workspace    Workspace? @relation(fields: [workspaceId], references: [id])
}

enum AiRole {
  CLASSIFIER    // Определяет категорию и теги
  SUMMARIZER    // Делает краткую выжимку
  POST_MAKER    // Формирует финальный пост для канала
  MEDIA_ANALYST // Анализирует фото/видео/аудио
  TRANSLATOR    // Переводит контент
}
```


### 7.6. AiLog (Логирование AI-вычислений)

Логи всех обращений к AI для отладки, аналитики затрат и понимания решений.

```prisma
model AiLog {
  id String @id @default(uuid())

  agentId String?
  agent   AiAgent? @relation(fields: [agentId], references: [id])

  // Что обрабатывали
  resourceType String // "CONTENT", "TOPIC", "MEDIA"
  resourceId   String

  // Запрос/ответ
  prompt   String? @db.Text
  response String? @db.Text

  // Метрики
  inputTokens  Int?
  outputTokens Int?
  latencyMs    Int?
  cost         Float? // В долларах

  // Результат
  success Boolean
  error   String?

  createdAt DateTime @default(now())

  @@index([agentId])
  @@index([resourceType, resourceId])
  @@index([createdAt])
}
```

---


## Workspace Layer (Пользовательский уровень)

### 8. User (Пользователь)

```prisma
model User {
  id           String  @id @default(uuid())
  email        String  @unique
  name         String?
  passwordHash String
  isActive     Boolean @default(true)
  role         UserRole @default(USER)

  // === Telegram Integration ===
  telegramId       String? @unique
  telegramUsername String?
  
  // === Profile ===
  avatarUrl    String?
  settings     Json?   // UI preferences, notifications, etc.

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspaces          Workspace[]         // Воркспейсы, где owner
  workspaceUsers      WorkspaceUser[]     // Все воркспейсы, где участник
  integrationAccounts IntegrationAccount[]
  auditLogs           AuditLog[]
}

enum UserRole {
  FATHER // Супер-админ (Владелец системы)
  ADMIN
  USER
  EDITOR
}
```



---

### 9. Workspace (Рабочее пространство)

```prisma
model Workspace {
  id      String @id @default(uuid())
  name    String
  ownerId String
  owner   User   @relation(fields: [ownerId], references: [id])

  // Настройки фильтрации и публикации
  settings Json? // categoryFilters, tagPriorities, autoApprove, etc.

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  donors   WorkspaceDonor[]
  targets  Target[]
  topics   WorkspaceTopic[]
  aiAgents AiAgent[]
  users    WorkspaceUser[]
}
```

---

### 9.5. WorkspaceUser (Связь Workspace ↔ User)

Кроме owner, в воркспейсе могут быть другие участники с разными правами.

```prisma
model WorkspaceUser {
  id          String        @id @default(uuid())
  workspaceId String
  userId      String
  
  workspace   Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  role        WorkspaceRole @default(VIEWER)
  
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([workspaceId, userId])
  @@index([userId])
}

enum WorkspaceRole {
  ADMIN   // Полный доступ (настройки, удаление)
  EDITOR  // Может апрувить и публиковать
  VIEWER  // Только просмотр
}
```


**Логика прав доступа:**
- `owner` (из Workspace) — владелец, может удалить воркспейс
- `ADMIN` — всё, кроме удаления воркспейса
- `EDITOR` — работа с контентом, но не может менять настройки
- `VIEWER` — только читать и смотреть аналитику

---

### 10. WorkspaceDonor (Связь Workspace ↔ Source)

Какие источники слушает workspace.

```prisma
model WorkspaceDonor {
  id          String @id @default(uuid())
  workspaceId String
  sourceId    String

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  source    Source    @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  isActive Boolean @default(true)
  settings Json?   // Специфичные настройки для этого источника в этом workspace

  createdAt DateTime @default(now())

  @@unique([workspaceId, sourceId])
  @@index([sourceId])
}
```

---

### 11. Target (Канал публикации)

Куда workspace публикует контент.

```prisma
model Target {
  id          String @id @default(uuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  type        String  // 'telegram', 'twitter', etc.
  externalId  String  // channel id, handle, etc. (напр. @my_channel или -100...)
  name        String? // Название канала
  description String? // Описание/заметки
  
  // === Настройки публикации ===
  language    String @default("ru")
  timezone    String @default("UTC")
  
  // Гибкие настройки (промпты, шаблоны, подписи)
  settings        Json?  
  
  // Время работы (напр. { start: "08:00", end: "23:00", days: [1,2,3,4,5] })
  workSchedule    Json?  
  
  // === Инфраструктура ===
  // Через какой аккаунт/бот идет постинг
  accountId   String?
  account     IntegrationAccount? @relation(fields: [accountId], references: [id])
  
  // === Состояние и метрики ===
  isActive    Boolean @default(true)
  metadata    Json?   // { subscriberCount: 1500, avgReach: ... }

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  publications     Publication[]
  targetCategories TargetCategory[]
  targetTags       TargetTag[]

  // Глобальная уникальность канала в системе
  @@unique([type, externalId])
  @@index([workspaceId])
  @@index([accountId])
}

// Таблицы-связки для фильтрации контента в каналах
model TargetCategory {
  targetId   String
  categoryId String
  target     Target   @relation(fields: [targetId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  @@id([targetId, categoryId])
}

model TargetTag {
  targetId String
  tagId    String
  target   Target @relation(fields: [targetId], references: [id], onDelete: Cascade)
  tag      Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([targetId, tagId])
}
```

**Интерфейс TargetWorkSchedule:**

```typescript
interface TargetWorkSchedule {
  // Настройки по дням (1 - Понедельник, 7 - Воскресенье)
  days: {
    [key: number]: {
      isEnabled: boolean;
      // Массив окон активности (позволяет делать перерывы в середине дня)
      slots: {
        start: string; // "09:00"
        end: string;   // "21:00"
      }[];
    }
  };
  
  // Ограничения
  minDelayBetweenPosts: number; // Минимальная пауза в минутах
  maxPostsPerDay: number;       // Лимит постов в сутки
}
```

**Пример сложного расписания (JSON):**
```json
{
  "days": {
    "1": { "isEnabled": true, "slots": [{ "start": "09:00", "end": "22:00" }] },
    "2": { "isEnabled": true, "slots": [{ "start": "09:00", "end": "22:00" }] },
    "3": { "isEnabled": true, "slots": [{ "start": "09:00", "end": "22:00" }] },
    "4": { "isEnabled": true, "slots": [{ "start": "09:00", "end": "22:00" }] },
    "5": { "isEnabled": true, "slots": [
      { "start": "09:00", "end": "14:00" }, 
      { "start": "18:00", "end": "23:00" }
    ]},
    "6": { "isEnabled": false, "slots": [] },
    "7": { "isEnabled": false, "slots": [] }
  },
  "minDelayBetweenPosts": 45,
  "maxPostsPerDay": 12
}
```

**Интерфейс TargetSettings:**
```typescript
interface TargetSettings {
  // Промпт для ИИ, описывающий стиль канала
  aiPrompt?: string;         // "Будь саркастичным зумером из IT"
  
  // Шаблон поста (с плейсхолдерами)
  postTemplate?: string;     // "🔥 {{title}}\n\n{{summary}}\n\n🔗 {{link}}"
  
  // Фиксированная подпись
  signature?: string;        // "\n\nПодписывайтесь на @my_channel"
  
  // Настройки ИИ-агента
  preferredAiAgentId?: string;
  autoApproveScore?: number; // Если ИИ оценил пост выше 0.9 — сразу в отложку
}
```


---

### 12. WorkspaceTopic (Топик в контексте Workspace)

Связь Topic ↔ Workspace со статусом публикации.

```prisma
model WorkspaceTopic {
  id          String @id @default(uuid())
  workspaceId String
  topicId     String

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  topic     Topic     @relation(fields: [topicId], references: [id], onDelete: Cascade)

  // Статус в этом workspace (общий)
  status WorkspaceTopicStatus @default(pending)

  // Приоритет (для очереди обработки)
  priority Int @default(5) // 1-10

  // Версионирование
  publishedVersion Int?      // Какая версия Topic была в последний раз в плане
  hasUpdates       Boolean   @default(false)
  lastSeenVersion  Int?

  // Комментарии редактора
  notes String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  publications Publication[]

  @@unique([workspaceId, topicId])
  @@index([topicId])
  @@index([status])
}

enum WorkspaceTopicStatus {
  pending    // Ожидает решения
  approved   // Одобрен (готов к распределению по таргетам)
  skipped    // Пропущен
  archived   // В архиве
}
```

---

### 13. Publication (Очередь публикаций / Отложка)

Фактические задачи на пост в конкретные каналы.

```prisma
model Publication {
  id               String            @id @default(uuid())
  workspaceTopicId String
  workspaceTopic   WorkspaceTopic    @relation(fields: [workspaceTopicId], references: [id], onDelete: Cascade)
  
  targetId         String
  target           Target            @relation(fields: [targetId], references: [id], onDelete: Cascade)

  status           PublicationStatus @default(PENDING)
  
  // Версия топика на момент публикации
  topicVersion     Int
  
  // === Планирование ===
  scheduledAt      DateTime?         // null пока статус PENDING
  publishedAt      DateTime?         // Фактическое время
  
  // === Результат ===
  externalId       String?           // ID поста в ТГ/Твиттере
  error            String?           // Текст ошибки если FAILED

  // === Retry логика ===
  retryCount       Int               @default(0)  // Сколько раз пытались
  maxRetries       Int               @default(3)  // Максимум попыток
  nextRetryAt      DateTime?         // Когда следующая попытка

  // Опционально: специфичный текст для этого канала
  contentOverride  Json?             

  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@index([status])
  @@index([scheduledAt])
  @@index([targetId])
  @@index([nextRetryAt])
}


enum PublicationStatus {
  PENDING    // В очереди (ожидает применения расписания)
  SCHEDULED  // Запланирован на конкретное время
  PUBLISHING // Отправляется прямо сейчас
  PUBLISHED  // Успешно опубликован
  FAILED     // Ошибка (см. поле error)
  CANCELLED  // Отменен редактором
}
```

---

### 13.5. PublicationStats (Аналитика постов)

Актуальные данные о перфомансе каждого опубликованного контента.

```prisma
model PublicationStats {
  id            String      @id @default(uuid())
  publicationId String      @unique
  publication   Publication @relation(fields: [publicationId], references: [id], onDelete: Cascade)

  // Метрики (актуальные значения)
  views         Int         @default(0)
  reactions     Int         @default(0)
  shares        Int         @default(0)
  comments      Int         @default(0)
  clicks        Int         @default(0) // Если есть кнопки/ссылки

  // История изменений (JSON для графиков)
  history       Json?       // [{ t: "2024-01-01T12:00", v: 100, r: 5 }, ...]

  updatedAt     DateTime    @updatedAt
}
```

---

## Infrastructure Layer (Агенты и Интеграции)

### 14. IntegrationAccount (Аккаунты платформ)

Единая сущность для управления ботами, юзерботами и аккаунтами в других соцсетях.

```prisma
model IntegrationAccount {
  id        String          @id @default(uuid())
  platform  PlatformType    // TELEGRAM, TWITTER, etc.
  type      AccountType     // BOT, USER
  
  // === Идентификация ===
  name         String?      // Внутреннее имя ("Парсер новостей №1")
  login        String?      // @alert_bot или +7900...
  externalId   String?      // ID в системе платформы
  
  // === Данные ===
  credentials  Json         // Токены, куки, сессии (зашифровано)
  metadata     Json?        // Лимиты, прокси, юзерагент...

  // === Статус ===
  isActive     Boolean       @default(true)
  status       AccountStatus @default(ACTIVE) 
  statusDetails String?      // "FloodWait 500s"

  // === Метрики ===
  lastUsedAt   DateTime?
  usageCount   Int           @default(0)

  // === Инфраструктура ===
  proxyId      String?
  proxy        Proxy?        @relation(fields: [proxyId], references: [id])

  // === Привязка ===
  ownerId      String        // Кто добавил аккаунт
  owner        User          @relation(fields: [ownerId], references: [id])
  
  workspaceId  String?
  workspace    Workspace?    @relation(fields: [workspaceId], references: [id])
  
  integrationAccountSources IntegrationAccountSource[] // Связь с источниками
  targets                   Target[]                   // Аккаунт может ПОСТИТЬ в эти таргеты
  contents                  Content[]                  @relation("ContentReceivedVia")

  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([platform, type])
  @@index([status])
  @@index([ownerId])
}

enum PlatformType {
  TELEGRAM
  TWITTER
  RSS
  YOUTUBE
  TIKTOK
}

enum AccountType {
  BOT     // API-доступ (официальный бот)
  USER    // User-доступ (юзербот/браузер)
}

enum AccountStatus {
  ACTIVE       // Работает
  BANNED       // Забанен платформой
  FLOOD        // Временное ограничение (FloodWait)
  AUTH_NEEDED  // Слетели креды
  ERROR        // Техническая ошибка
}
```

**Интерфейсы для credentials (зависит от платформы и типа):**

```typescript
type IntegrationCredentials = 
  | TelegramBotCredentials 
  | TelegramUserCredentials 
  | TwitterUserCredentials;

interface TelegramBotCredentials {
  token: string;              // BotFather token
}

interface TelegramUserCredentials {
  phoneNumber: string;
  apiId: number;
  apiHash: string;
  session: string;            // Telethon/Pyrogram/StringSession
  twoFactorAuth?: string;     // Password if enabled
}

interface TwitterUserCredentials {
  authTokens: {
    ct0: string;
    auth_token: string;
  };
  cookies: string;            // Raw cookies for backup
  userAgent: string;
}

// Интерфейс для metadata
interface IntegrationAccountMetadata {
  proxy?: {
    host: string;
    port: number;
    protocol: 'http' | 'socks5';
    username?: string;
    password?: string;
  };
  limits: {
    maxDailyPosts?: number;
    maxDailyParses?: number;
    currentDailyCount: number;
  };
  deviceInfo?: {
    appVersion: string;
    deviceModel: string;
    systemVersion: string;
  };
  lastErrorReason?: string;
  lastFloodWaitSeconds?: number;
}
```

---

### 15. Proxy (Прокси-серверы)

```prisma
model Proxy {
  id        String      @id @default(uuid())
  protocol  String      // "http", "socks5"
  host      String
  port      Int
  username  String?
  password  String?

  isActive  Boolean     @default(true)
  status    ProxyStatus @default(HEALTHY)
  
  // Статистика
  lastUsedAt DateTime?
  errorCount Int         @default(0)
  
  accounts   IntegrationAccount[]

  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

enum ProxyStatus {
  HEALTHY
  DEAD
  SLOW
}
```

---

### 16. AuditLog (Логирование действий)

```prisma
model AuditLog {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  
  action       String   // "PUBLISH_POST", "EDIT_TOPIC", "LOGIN"
  resourceType String   // "TOPIC", "WORKSPACE", "TARGET"
  resourceId   String?  // UUID ресурса
  
  oldData      Json?
  newData      Json?
  
  ip           String?
  userAgent    String?
  
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([action])
  @@index([resourceType, resourceId])
}
```

---

## Флоу данных

### 1. Сбор контента

```
Парсер → Source → Content → Media
                      ↓
                 AI Analysis
                      ↓
              Определение типа
                      ↓
         ┌───────────────────────┐
         │ Нужна группировка?    │
         └───────────────────────┘
              │           │
             Да          Нет
              ↓           ↓
     Поиск похожего    Создать
        Topic          новый Topic
              │           │
              └─────┬─────┘
                    ↓
              ContentTopic (связь)
                    ↓
         Уведомить все Workspace
```

### 2. Распределение по Workspace

```
Новый Topic создан
        ↓
Для каждого Workspace:
  ├── Проверить categoryFilters
  ├── Проверить WorkspaceDonor (источник слушается?)
  └── Если подходит → создать WorkspaceTopic(status=pending)
```

### 3. Публикация

```
Редактор видит WorkspaceTopic
        ↓
[Approve] → status=approved → очередь публикации
        ↓
Публикация в Target
        ↓
status=published, publishedAt=now, publishedVersion=topic.version
```

### 4. Обновление Topic

```
Новый Content добавляется к существующему Topic
        ↓
topic.version += 1
        ↓
Для всех WorkspaceTopic с publishedVersion < topic.version:
  └── hasUpdates = true
        ↓
Редактор видит "⚠️ Есть обновление!"
  ├── [Опубликовать апдейт]
  └── [Игнорировать] → hasUpdates=false, lastSeenVersion=current
```

---

## Открытые вопросы

1. ~~**Права доступа**: Нужна ли система ролей в Workspace?~~ ✅ Решено: `WorkspaceMember` + `WorkspaceRole`

2. ~~**Связи между Topic**: Нужна ли модель TopicRelation?~~ ✅ Решено: Добавлена (на будущее)

3. ~~**История изменений**: Нужен ли audit log?~~ ✅ Решено: `AuditLog`

4. ~~**Мультиязычность**: Один Topic на разных языках?~~ ✅ Решено: Нет. Один язык на Topic, перевод при публикации в Target.

5. ~~**Шаблоны публикации**: Разные форматы для Target?~~ ✅ Решено: `TargetSettings` с шаблонами

---

## TODO

- [x] Финализировать список TopicType
- [x] Определить структуру settings для Workspace
- [x] Продумать права доступа
- [ ] Добавить ContentRelation для репостов/цитат (на будущее)
- [x] Определить формат хранения credentials для Target → через IntegrationAccount

