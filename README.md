# OTUS. HW1. Типобезопасный API-клиент (TypeScript + Zod)

Домашняя работа №1, курс Node.js Разработчик.

Данный репозиторий реализует мини-библиотеку `ApiClient` для работы с https://jsonplaceholder.typicode.com/users с fetch + Zod-валидацией, где типы запросов/ответов выводятся автоматически из схем.

## Запуск

```bash
npm install
npm start        # демо: запросы, кэш, отмена, ошибки, retry
npm run typecheck
```

## Структура

| Файл               | Что внутри                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/errors.ts`    | `ApiHttpError { status, url, details? }`, `ApiValidationError { url, zodError }`                     |
| `src/apiClient.ts` | класс `ApiClient`: baseURL, глобальные headers, метод `get`, сериализация query, объединение headers |
| `src/schemas.ts`   | Zod-схемы эндпоинтов и типы через `z.infer` (без ручных интерфейсов)                                 |
| `src/main.ts`      | демо всех возможностей                                                                               |

## Как работает

- **Вывод типов**: `get(config)` возвращает `Promise<z.infer<S>>`, где `S` — схема ответа.
  Тип query-параметров выводится условным типом:
  `type QueryOf<Q> = Q extends z.ZodType ? z.infer<Q> : undefined` —
  без `querySchema` передать `query` не даст сам компилятор.
- **Ошибки**: `status >= 400` → `ApiHttpError`; провал `safeParse` → `ApiValidationError`.
- **Опции**: возможность `signal: AbortSignal`, экспоненциальный retry при 5xx
  (`maxAttempts`, `baseDelay`), и кэш GET с TTL (`cacheTtlMs`).

## Пример

```ts
const api = new ApiClient({ baseURL: "https://jsonplaceholder.typicode.com" });

const users = await api.get({
  url: "/users",
  responseSchema: userListSchema, // тип ответа -> User[]
  querySchema: usersQuerySchema,
  query: { _limit: 3 }, // тип проверен по UsersQuery
});
```
