// Colección "accounts": credenciales.
import type { Db } from "mongodb";
import { ignoreCase } from "../../db/mongo";
import type { Account } from "./types";

const accounts = (db: Db) => db.collection<Account>("accounts");

/** Guarda la cuenta. Devuelve false si el nombre ya existe */
export async function createAccount(db: Db, account: Account): Promise<boolean> {
  try {
    await accounts(db).insertOne(account);
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false; // índice único: nombre repetido
    throw e;
  }
}

export function findAccountById(db: Db, userId: number): Promise<Account | null> {
  return accounts(db).findOne({ userId });
}

/** Silencia en el chat hasta `until`. Devuelve la cuenta, o null si no existe */
export function muteAccount(db: Db, userId: number, until: Date): Promise<Account | null> {
  return accounts(db).findOneAndUpdate({ userId }, { $set: { mutedUntil: until } });
}

/** Quita el silencio. Devuelve la cuenta, o null si no estaba silenciada */
export function unmuteAccount(db: Db, userId: number): Promise<Account | null> {
  return accounts(db).findOneAndUpdate(
    { userId, mutedUntil: { $gt: new Date() } },
    { $unset: { mutedUntil: "" } },
  );
}

/** Cuentas silenciadas ahora, la que termina antes primero */
export function listMuted(db: Db): Promise<Account[]> {
  return accounts(db)
    .find({ mutedUntil: { $gt: new Date() } })
    .sort({ mutedUntil: 1 })
    .toArray();
}

/** Busca por nombre sin importar mayúsculas */
export function findAccountByName(db: Db, dname: string): Promise<Account | null> {
  return accounts(db).findOne({ dname }, { collation: ignoreCase });
}

export async function setPasswordHash(db: Db, userId: number, passwordHash: string): Promise<void> {
  await accounts(db).updateOne({ userId }, { $set: { passwordHash } });
}

export async function deleteAccount(db: Db, userId: number): Promise<void> {
  await accounts(db).deleteOne({ userId });
}
