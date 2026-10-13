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

/** Silencia en el chat hasta `until`. Devuelve false si la cuenta no existe */
export async function muteAccount(db: Db, userId: number, until: Date): Promise<boolean> {
  const { matchedCount } = await accounts(db).updateOne(
    { userId },
    { $set: { mutedUntil: until } },
  );
  return matchedCount === 1;
}

/** Busca por nombre sin importar mayúsculas */
export function findAccountByName(db: Db, dname: string): Promise<Account | null> {
  return accounts(db).findOne({ dname }, { collation: ignoreCase });
}
