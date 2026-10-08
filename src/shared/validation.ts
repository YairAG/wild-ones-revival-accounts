// Valida un body con zod; si no cumple, AppError 400 con el primer mensaje.
import type { z } from "zod";
import { AppError } from "./errors";

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw new AppError(400, result.error.issues[0].message);
  return result.data;
}
