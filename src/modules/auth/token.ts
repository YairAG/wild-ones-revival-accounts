// JWT como lo espera el servidor de juego: HS256, sub = id numérico como texto.
import jwt from "jsonwebtoken";
import type { Config } from "../../config/env";

export function signToken(config: Config, userId: number): string {
  return jwt.sign({}, config.jwtSecret, {
    subject: String(userId),
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}
