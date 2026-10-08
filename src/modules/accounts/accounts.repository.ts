// Acceso a la colección "accounts" (credenciales).
import type { Db } from "mongodb";
import { ignoreCase } from "../../db/mongo";
import type { Account } from "../../types";

export function createAccountsRepository(db: Db) {
  const accounts = db.collection<Account>("accounts");

  return {
    /** Guarda la cuenta. Devuelve false si el nombre ya existe */
    async create(account: Account): Promise<boolean> {
      try {
        await accounts.insertOne(account);
        return true;
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return false; // índice único: nombre repetido
        throw e;
      }
    },

    /** Busca por nombre sin importar mayúsculas */
    findByName(dname: string): Promise<Account | null> {
      return accounts.findOne({ dname }, { collation: ignoreCase });
    },
  };
}

export type AccountsRepository = ReturnType<typeof createAccountsRepository>;
