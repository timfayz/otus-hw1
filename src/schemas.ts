import { z } from 'zod';

/** один пользователь jsonplaceholder */
export const userSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  username: z.string().min(1),
  email: z.email(),
  phone: z.string(),
  website: z.string(),
  address: z.object({
    street: z.string(),
    suite: z.string(),
    city: z.string(),
    zipcode: z.string(),
    geo: z.object({
      lat: z.string(),
      lng: z.string(),
    }),
  }),
  company: z.object({
    name: z.string(),
    catchPhrase: z.string(),
    bs: z.string(),
  }),
});

// тип выводится из схемы — интерфейсы вручную не дублируем
export type User = z.infer<typeof userSchema>;

/** список пользователей */
export const userListSchema = z.array(userSchema);

/** query-параметры /users (jsonplaceholder поддерживает пагинацию) */
export const usersQuerySchema = z.object({
  _page: z.number().int().positive().optional(),
  _limit: z.number().int().positive().optional(),
});

export type UsersQuery = z.infer<typeof usersQuerySchema>;
