// JWT como lo espera el servidor de juego: HS256, sub = id numérico como texto.
import jwt from "jsonwebtoken";
import type { Config } from "../types";

export function createTokens(config: Config) {
  return {
    sign: (userId: number): string =>
      jwt.sign({}, config.jwtSecret, {
        subject: String(userId),
        expiresIn: config.jwtExpiresIn,
      } as jwt.SignOptions),
  };
}

export type Tokens = ReturnType<typeof createTokens>;
