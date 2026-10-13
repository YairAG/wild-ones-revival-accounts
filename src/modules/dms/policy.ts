// ¿Puede `from` escribirle en privado a `to`? Depende de bloqueos y del ajuste de `to` (por defecto, solo amigos).
import type { Db } from "mongodb";
import type { ErrorId } from "../../shared/response";
import type { Account } from "../auth/types";
import { blockedEitherWay } from "../blocks/blocks";
import { findBetween } from "../friends/friendships";

/** null si puede; si no, el error y el mensaje para mostrar */
export async function dmRefusal(
  db: Db,
  from: number,
  to: Account,
): Promise<[number, ErrorId, string] | null> {
  if (to.userId === from) return [400, "INVALID_DATA", "No puedes escribirte a ti mismo"];
  if (await blockedEitherWay(db, from, to.userId)) {
    return [403, "BLOCKED", "No puedes escribirle a ese jugador"];
  }
  const policy = to.dmPolicy ?? "friends";
  if (policy === "nobody") {
    return [403, "DM_NOT_ALLOWED", `${to.dname} no recibe mensajes privados`];
  }
  if (policy === "friends" && (await findBetween(db, from, to.userId))?.status !== "accepted") {
    return [403, "DM_NOT_ALLOWED", `${to.dname} solo recibe mensajes privados de sus amigos`];
  }
  return null;
}
