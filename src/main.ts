import http from "node:http";
import { ApiClient } from "./apiClient";
import { ApiHttpError, ApiValidationError } from "./errors";
import type { User } from "./schemas";
import { userListSchema, userSchema, usersQuerySchema } from "./schemas";

const api = new ApiClient({
  baseURL: "https://jsonplaceholder.typicode.com",
  headers: { Accept: "application/json" },
  maxAttempts: 3,
  baseDelay: 300,
  cacheTtlMs: 10_000,
});

async function main() {
  // 1. Список пользователей с query: тип User[] выводится из userListSchema
  const users = await api.get({
    url: "/users",
    responseSchema: userListSchema,
    querySchema: usersQuerySchema,
    query: { _limit: 3 },
  });
  console.log(
    `1. Получено ${users.length} пользователя (тип выведен из схемы):`,
  );
  for (const u of users) {
    console.log(`   - ${u.name} <${u.email}>, город: ${u.address.city}`);
  }

  // 2. Один пользователь: тип User выводится из userSchema
  const user: User = await api.get({
    url: "/users/1",
    responseSchema: userSchema,
    headers: { "X-Request-Id": "demo-1" }, // локальные headers объединяются с глобальными
  });
  console.log(
    `\n2. Пользователь 1: ${user.name}, компания: ${user.company.name}`,
  );

  // 3. ⭐ Кэш: повторный запрос по тому же URL берётся из кэша
  const start = Date.now();
  await api.get({ url: "/users/1", responseSchema: userSchema });
  console.log(
    `\n3. Повторный запрос /users/1 выполнен за ${Date.now() - start}мс (из кэша)`,
  );

  // 4. ⭐ Отмена запроса через AbortSignal
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 1);
  try {
    await api.get({
      url: "/users",
      responseSchema: userListSchema,
      signal: controller.signal,
    });
  } catch (error) {
    console.log(`\n4. Запрос отменён: ${(error as Error).name}`);
  }

  // 5. HTTP-ошибка (404) -> ApiHttpError
  try {
    await api.get({ url: "/users/11", responseSchema: userSchema });
  } catch (error) {
    if (error instanceof ApiHttpError) {
      console.log(
        `\n5. ApiHttpError: status=${error.status}, url=${error.url}, details=`,
        error.details,
      );
    }
  }

  // 6. Ошибка валидации: /posts/1 отвечает 200, но не проходит схему пользователя
  try {
    await api.get({ url: "/posts/1", responseSchema: userSchema });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      const first = error.zodError.issues[0];
      console.log(`\n6. ApiValidationError: url=${error.url}`);
      console.log(
        `   первая проблема: ${first.path.join(".")} — ${first.message}`,
      );
    }
  }

  // 7. ⭐ Экспоненциальный retry при 5xx на локальном "нестабильном" сервере
  await demoRetry();
}

/** поднимает сервер, который дважды отвечает 500, а потом 200 */
async function demoRetry() {
  let calls = 0;
  const server = http.createServer((req, res) => {
    calls++;
    if (calls < 3) {
      res.writeHead(500);
      res.end("boom");
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([{ id: 1, name: "Test" }]));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const flakyApi = new ApiClient({
    baseURL: `http://localhost:${(server.address() as { port: number }).port}`,
    maxAttempts: 3,
    baseDelay: 200,
  });

  try {
    const data = await flakyApi.get({
      url: "/flaky",
      responseSchema: userSchema.partial().array(), // [{ id, name }] — хватит partial-схемы
    });
    console.log(
      `\n7. Retry: сервер отдал 500 дважды, успех с попытки ${calls}:`,
      data,
    );
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error("Неожиданная ошибка:", error);
  process.exitCode = 1;
});
