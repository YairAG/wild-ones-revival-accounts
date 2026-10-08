// Lógica de registro y login. No sabe nada de HTTP: recibe datos ya validados y lanza AppError si algo falla.
import { AppError } from "../../shared/errors";
import { hashPassword, verifyPassword } from "../../shared/password";
import type { Tokens } from "../../shared/tokens";
import type { Session } from "../../types";
import type { AccountsRepository } from "../accounts/accounts.repository";
import type { PlayersRepository } from "../players/players.repository";
import { newPlayer } from "../players/new-player";
import type { Credentials } from "./auth.schemas";

type Deps = {
  accounts: AccountsRepository;
  players: PlayersRepository;
  tokens: Tokens;
  nextUserId: () => Promise<number>;
};

export function createAuthService({ accounts, players, tokens, nextUserId }: Deps) {
  return {
    async register({ dname, password }: Credentials): Promise<Session> {
      const id = await nextUserId();
      const created = await accounts.create({
        userId: id,
        dname,
        passwordHash: await hashPassword(password),
        createdAt: new Date(),
      });
      if (!created) throw new AppError(409, "Ese nombre ya existe");

      await players.create(newPlayer(id, dname));
      return { id, dname, token: tokens.sign(id) };
    },

    async login({ dname, password }: Credentials): Promise<Session> {
      const account = await accounts.findByName(dname);
      // Mismo error si el nombre no existe o la contraseña está mal: no revela qué nombres existen
      if (!account || !(await verifyPassword(password, account.passwordHash))) {
        throw new AppError(401, "Nombre o contraseña incorrectos");
      }
      return { id: account.userId, dname: account.dname, token: tokens.sign(account.userId) };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
