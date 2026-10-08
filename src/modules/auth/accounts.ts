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

/** Busca por nombre sin importar mayúsculas */
export function findAccountByName(db: Db, dname: string): Promise<Account | null> {
  return accounts(db).findOne({ dname }, { collation: ignoreCase });
}
