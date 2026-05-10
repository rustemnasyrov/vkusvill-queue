# Dev setup (Этап 1)

## 1) Подготовка

- Установите Docker Desktop.
- В корне проекта проверьте наличие `.env.dev`.

## 2) Запуск окружения

```bash
docker compose -f docker-compose.dev.yml up --build
```

Если менялись зависимости (`backend/requirements.txt` или `frontend/package.json`), обязательно пересоберите:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Сервисы:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## 3) Проверка live reload

1. Откройте `frontend/src/App.tsx`, измените заголовок.
2. Сохраните файл и убедитесь, что UI обновился без рестарта контейнера.
3. Откройте `backend/app/main.py`, измените ответ `GET /`.
4. Сохраните и проверьте `http://localhost:8000/` — изменения должны примениться автоматически.

## 4) Проверка смартфона (PWA dev shell)

1. Узнайте локальный IP вашей машины в той же Wi-Fi сети.
2. Откройте на смартфоне `http://<YOUR_LOCAL_IP>:5173`.
3. На странице должен отображаться статус health-check backend.

## 5) Остановка

```bash
docker compose -f docker-compose.dev.yml down
```

## 6) Тестовые пользователи (Этап 2)

- manager: `manager@local.dev` / `manager123`
- courier: `courier@local.dev` / `courier123`
