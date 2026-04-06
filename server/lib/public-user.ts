import type { User } from "@shared/schema";

export type PublicUser = Omit<User, "password">;

export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...rest } = user;
  return rest;
}
