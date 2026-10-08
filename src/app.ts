// Rutas HTTP: POST /register y POST /login. Las dos devuelven un JWT para entrar al servidor de juego.
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { Db } from "mongodb";
import { nextUserId, sameNameIgnoringCase, type Account } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { newPlayer } from "./player";

export type Config = {
  jwtSecret: string; // el mismo JWT_SECRET que el servidor de juego
  jwtExpiresIn: string; // p. ej. "10m": el token solo se usa al hacer logIn
  corsOrigin: string; // URL del frontend
  requestsPerMinute: number; // límite de intentos por IP
};

const credentials = z.object({
  dname: z.string().regex(/^[a-zA-Z0-9_]{3,16}$/, "El nombre debe tener 3 a 16 letras, números o _"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
});

export async function buildApp(db: Db, config: Config) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
  await app.register(cors, { origin: config.corsOrigin });
  await app.register(rateLimit, { max: config.requestsPerMinute, timeWindow: "1 minute" });

  const accounts = db.collection<Account>("accounts");
  const users = db.collection("users");
  // JWT como lo espera el servidor de juego: HS256, sub = id numérico como texto
  const tokenFor = (id: number) =>
    jwt.sign({}, config.jwtSecret, { subject: String(id), expiresIn: config.jwtExpiresIn } as jwt.SignOptions);

  app.post("/register", async (req, reply) => {
    const body = credentials.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0].message });
    const { dname, password } = body.data;

    const id = await nextUserId(db);
    try {
      await accounts.insertOne({ userId: id, dname, passwordHash: await hashPassword(password), createdAt: new Date() });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return reply.code(409).send({ error: "Ese nombre ya existe" });
      throw e;
    }
    await users.insertOne(newPlayer(id, dname));

    req.log.info({ id, dname }, "Cuenta creada");
    return reply.code(201).send({ id, dname, token: tokenFor(id) });
  });

  app.post("/login", async (req, reply) => {
    const body = credentials.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0].message });
    const { dname, password } = body.data;

    const account = await accounts.findOne({ dname }, { collation: sameNameIgnoringCase });
    // Mismo mensaje si el nombre no existe o la contraseña está mal: no revela qué nombres existen
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      return reply.code(401).send({ error: "Nombre o contraseña incorrectos" });
    }

    return { id: account.userId, dname: account.dname, token: tokenFor(account.userId) };
  });

  return app;
}
