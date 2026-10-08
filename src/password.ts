// Contraseñas con scrypt (incluido en Node). Se guarda "salt:hash" en hex, nunca la contraseña.
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return salt.toString("hex") + ":" + hash.toString("hex");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const attempt = await scryptAsync(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(attempt, Buffer.from(hash, "hex")); // tiempo constante: no da pistas al comparar
}
