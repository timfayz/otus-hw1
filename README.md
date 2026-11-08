# HW1. Типобезопасный API-клиент (TypeScript + Zod)

Мини-библиотека `ApiClient` для работы с https://jsonplaceholder.typicode.com/users:
fetch + Zod-валидация, типы запросов/ответов выводятся автоматически из схем.

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

## Как это работает

- **Вывод типов**: `get(config)` возвращает `Promise<z.infer<S>>`, где `S` — схема ответа.
  Тип query-параметров выводится условным типом:
  `type QueryOf<Q> = Q extends ZodTypeAny ? z.infer<Q> : undefined` —
  без `querySchema` передать `query` не даст сам компилятор.
- **Ошибки**: `status >= 400` → `ApiHttpError`; провал `safeParse` → `ApiValidationError`.
- **⭐ Доп. возможности**: `signal: AbortSignal`, экспоненциальный retry при 5xx
  (`maxAttempts`, `baseDelay`), кэш GET с TTL (`cacheTtlMs`).

`bodySchema` для POST/PUT добавляется по тому же принципу, что и `responseSchema`
(метод `get` — единственный обязательный по заданию).

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
