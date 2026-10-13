// JWT como lo espera el servidor de juego: HS256, sub = id numérico como texto.
import jwt from "jsonwebtoken";
import type { Config } from "../../config/env";

export function signToken(config: Config, userId: number): string {
  return jwt.sign({}, config.jwtSecret, {
    subject: String(userId),
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

/** Id del jugador si el token es válido (firma, vigencia y sub numérico); si no, null */
export function verifyToken(config: Config, token: string): number | null {
  try {
    const { sub } = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    const id = Number(sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
