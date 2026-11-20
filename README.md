# Между нами

667 вопросов для двоих, Telegram-бот и Mini App. Лавандово-розовый дизайн, авторские SVG-персонажи, пиксельный аватар бота, без эмодзи.

## Текущее развёртывание

- Бот: https://t.me/VOPROS667AGENT
- Supabase: проект `mezhdu-nami`, ref `icleianorxfnwbpylelw`, регион Франкфурт.
- Постоянный backend: Edge Function `couple-api`, Telegram webhook и Postgres.
- Mini App пока использует **временный Arena preview URL** из секрета `APP_URL`. Когда sandbox останавливается, эта ссылка перестаёт работать. Бот и серверный прогресс от sandbox не зависят.
- Для постоянного frontend-хостинга подготовлен GitHub Pages workflow. Интеграция получила HTTP 403 на включение Pages: владелец должен включить его в Settings → Pages → Source: GitHub Actions, затем повторно запустить workflow Publish Mini App для текущей ветки. Не требуется переключать ветку или сливать её в main. После публикации нужно заменить `APP_URL` и повторить административную настройку кнопки Telegram.

## Возможности

- Свободный режим: вопросы 1–667 с постепенным увеличением глубины.
- Десять категорий и случайный незаданный вопрос.
- Единые отметки «Обсудили» в боте и Mini App. Уже отмеченные вопросы не появляются в выборке.
- Текущий вопрос тоже общий; Mini App получает изменения раз в 5 секунд.
- История, даты обсуждения, отмена отдельной отметки в Mini App.
- **Reset** в шапке Mini App и кнопка/команда `/reset` в боте. Только с явным подтверждением. Удаляет общий прогресс и возвращает к вопросу № 1. В браузерном демо сбрасывает только локальный прогресс.
- На сервере подтверждение сброса одноразовое, привязано к Telegram-пользователю и поколению прогресса, действует 5 минут. После сброса старые кнопки сообщений не могут вернуть предыдущие отметки.
- Ответы не собираются: хранятся только ID вопросов и время отметки.
- Пока разрешён один аккаунт. Чтобы добавить Вику, обновите `TELEGRAM_USER_IDS` в Supabase Secrets: два числовых ID через запятую. Значения ID и токенов в репозитории не хранятся.

## Локальный запуск

Нужен Node.js 22.13+.

```sh
npm ci
cp .env.example .env
npm run dev
```

http://localhost:3000, сервер слушает `0.0.0.0`. Без Telegram доступно локальное демо в `localStorage`; оно не переносится в общий прогресс автоматически.

Для подключения frontend к развёрнутому backend укажите в `.env.local` публичный URL (это не секрет):

```dotenv
VITE_API_URL=https://icleianorxfnwbpylelw.supabase.co/functions/v1/couple-api
```

Открывайте Mini App **из бота**, иначе Telegram initData отсутствует и приложение работает как локальное демо. Внутри Telegram при ошибке проверки аккаунта приложение блокируется, а не подменяет общий прогресс локальным. Сессия initData действует 24 часа; затем закройте Mini App и запустите снова.

```sh
npm test
npm run build
npm start
```

Production static build для Pages: `npm run build -- --base=/voprosi/` с `VITE_API_URL`, как в workflow. Не меняйте origin frontend без обновления `APP_URL`/CORS.

## Backend и безопасность

`supabase/migrations/202611190001_couple.sql` создаёт каталог, общий прогресс, временные подтверждения reset и дедупликацию Telegram updates. На всех таблицах RLS без публичных политик; доступ к таблицам и RPC закрыт для `anon`/`authenticated`. Только Edge Function с service-role ключом обращается к ним. Секреты никогда не передаются в frontend.

`supabase/functions/couple-api/index.ts` обслуживает:

- `GET /config` — публичный флаг доступности общего режима, без пользовательских данных;
- `GET/POST /progress` — HMAC-проверка Telegram initData, срок действия, allowlist;
- `POST /webhook` — проверка отдельного `X-Telegram-Bot-Api-Secret-Token`, только личные чаты;
- `POST /setup` — закрытый административный endpoint, работает только при установленном временном `COUPLE_SETUP_SECRET` и совпадающем `x-setup-secret`. После настройки секрет удаляется, endpoint недоступен.

Постоянные Supabase Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_IDS`, `APP_URL`, `TELEGRAM_WEBHOOK_SECRET`. Supabase автоматически предоставляет `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`. Не добавляйте ключи в Git, переменные `VITE_*` или чат.

Проверка JWT у Edge Function отключена намеренно: Telegram не выдаёт JWT Supabase. Взамен каждый чувствительный маршрут проверяет Telegram-подпись или отдельный серверный секрет. CORS не используется как авторизация.

RPC блокирует строку общего состояния при изменениях: отметки и сброс атомарны. `generation` не позволяет старому клиенту или кнопке до сброса изменить новую историю; `revision` не даёт запоздавшему polling-ответу перезаписать более свежий прогресс. Повторная отметка одного ID идемпотентна.

**Не запускайте одновременно старый Node long polling и production webhook.** `server/bot.js`/SQLite — прежний необязательный standalone-вариант; он не связан с production Postgres. Для текущего backend токен хранится только в Supabase, не в `.env` Node-сервера. Старый SQLite-файл не мигрируется автоматически.

### Повторное развёртывание

Через Supabase CLI или подключённые инструменты разверните `couple-api` с `verify_jwt=false`. Не применяйте начальную миграцию повторно к существующей базе. Для первого развёртывания выполните миграцию, затем:

1. Установите постоянные секреты и случайный временный `COUPLE_SETUP_SECRET`.
2. Выполните POST `/setup` с заголовком `x-setup-secret` и телом `{"catalogUrl":"https://api.github.com/repos/tengizkaa-coder/voprosi/contents/shared/catalog.json?ref=<40-символьный commit SHA>"}`.
3. Setup загрузит закреплённый снимок каталога, не стирая прогресс, настроит меню/команды и webhook. Ответ должен содержать `ok:true`.
4. Удалите временный `COUPLE_SETUP_SECRET`. Не публикуйте его и не оставляйте постоянно действующим.

`shared/catalog.json` генерируется из **единственного исходного каталога** `shared/questions.js`. После редактирования вопросов обновите JSON, не меняя существующие ID; тест проверяет полное совпадение. Не передавайте администраторские секреты через URL.

## Проверки

`npm test` проверяет 667 уникальных вопросов, оба режима, подпись/allowlist, закрытые endpoint-ы и CORS. PGlite исполняет настоящий PostgreSQL SQL миграции и проверяет атомарный reset, срок подтверждения, привязку к пользователю, защиту от старых кнопок, дедупликацию и запрет публичного доступа. Сброс не тестируется на реальной пользовательской истории.

`node scripts/check-ui.mjs` — браузерный smoke-тест (нужен запущенный сервер и Chromium). Скрипт установки Chromium в sandbox может требовать отдельных библиотек. Для обычного окружения: `npx playwright install --with-deps chromium`.

## Файлы

- `src/main.jsx`, `src/style.css` — Mini App и SVG-персонажи.
- `src/progress.js` — локальный прогресс/reset и защита от устаревших ответов.
- `shared/questions.js`, `shared/catalog.json` — единый каталог и его снимок для деплоя.
- `shared/bot-profile.js` — публичное оформление бота.
- `supabase/functions/couple-api/index.ts` — production API и webhook.
- `supabase/migrations/` — схема и атомарные RPC.
- `assets/telegram-avatar.png` — установленный аватар, 512×512.
- `scripts/render-bot-avatar.mjs` — воспроизводимая отрисовка аватара.
- `supabase/functions/bot-style/index.ts` — исходник одноразового оформления; сама функция уже удалена из Supabase.

Шрифт Manrope поставляется локально; официальный Telegram Web App SDK загружается с `telegram.org`.
