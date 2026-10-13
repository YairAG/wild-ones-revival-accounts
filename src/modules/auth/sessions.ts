// Colección "sessions": un refresh token por sesión iniciada (cada navegador donde entraste).
// El token es aleatorio y solo se guarda su hash (sha256): si alguien lee la base, no le sirve. Rota en cada
// uso: /refresh entrega uno nuevo y el viejo deja de servir.
import { createHash, randomBytes } from "crypto";
import type { Db } from "mongodb";
import type { RefreshSession } from "./types";

// Si dos pestañas renuevan casi al mismo tiempo, la segunda llega con el token que la primera acaba de rotar.
// Durante estos segundos se acepta (sin rotar otra vez: la cookie nueva ya la tiene el navegador)
const GRACE_MS = 30_000;

const sessions = (db: Db) => db.collection<RefreshSession>("sessions");
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** Abre una sesión y devuelve su refresh token (va en la cookie) */
export async function createSession(db: Db, userId: number, days: number): Promise<string> {
  const token = newToken();
  await sessions(db).insertOne({
    userId,
    tokenHash: hash(token),
    expiresAt: daysFromNow(days),
    createdAt: new Date(),
  });
  return token;
}

/**
 * Renueva la sesión del token. Devuelve el jugador y el refresh token nuevo (undefined si no hay que cambiar la
 * cookie, por la gracia de las pestañas), o null si el token no existe, se usó antes o venció
 */
export async function rotateSession(
  db: Db,
  token: string,
  days: number,
): Promise<{ userId: number; token?: string } | null> {
  const now = new Date();
  const next = newToken();
  const rotated = await sessions(db).findOneAndUpdate(
    { tokenHash: hash(token), expiresAt: { $gt: now } },
    {
      $set: {
        tokenHash: hash(next),
        previousHash: hash(token),
        rotatedAt: now,
        expiresAt: daysFromNow(days),
      },
    },
  );
  if (rotated) return { userId: rotated.userId, token: next };

  const recent = await sessions(db).findOne({
    previousHash: hash(token),
    rotatedAt: { $gt: new Date(now.getTime() - GRACE_MS) },
  });
  return recent && { userId: recent.userId };
}

/** Cierra la sesión del token (si existe) */
export async function deleteSession(db: Db, token: string): Promise<void> {
  await sessions(db).deleteOne({ tokenHash: hash(token) });
}
