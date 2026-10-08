import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Db, MongoClient } from "mongodb";
import { buildApp, type Config } from "../src/app";
import { connectDb } from "../src/db";

process.env.LOG_LEVEL = "silent"; // sin logs del servidor en la salida de los tests

const config: Config = { jwtSecret: "secreto-de-test", jwtExpiresIn: "10m", corsOrigin: "*", requestsPerMinute: 1000 };

let mongod: MongoMemoryServer, client: MongoClient, db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;

before(async () => {
  mongod = await MongoMemoryServer.create({ binary: { version: process.env.MONGO_VERSION || "9.0.2" } });
  ({ client, db } = await connectDb(mongod.getUri("emu")));
  app = await buildApp(db, config);
});

after(async () => {
  await app?.close();
  await client?.close();
  await mongod?.stop();
});

const post = (url: string, body: object) => app.inject({ method: "POST", url, payload: body });

// Verifica el token igual que el servidor de juego (handler/auth.ts): HS256, sub = id numérico
function gameServerVerify(token: string): number {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  return Number(payload.sub);
}

test("registro: crea la cuenta y el jugador, y devuelve un token válido para el servidor de juego", async () => {
  const res = await post("/register", { dname: "Ana", password: "clave-segura" });
  assert.equal(res.statusCode, 201);
  const { id, dname, token } = res.json();
  assert.equal(id, 1);
  assert.equal(dname, "Ana");
  assert.equal(gameServerVerify(token), 1);

  // Jugador con el formato que espera el servidor de juego (docs/CUENTAS.md)
  const user = await db.collection("users").findOne({ id: 1 });
  assert.equal(user?.dname, "Ana");
  assert.equal(user?.gold, 1000);
  assert.ok(user?.ownedPets[user.currentPet], "currentPet tiene que existir en ownedPets");
  assert.equal(user?.password, undefined);

  // La contraseña solo está como hash, en accounts
  const account = await db.collection("accounts").findOne({ userId: 1 });
  assert.match(account?.passwordHash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.ok(!account?.passwordHash.includes("clave-segura"));
});

test("registro: ids consecutivos y nombres únicos sin importar mayúsculas", async () => {
  const beto = await post("/register", { dname: "Beto", password: "clave-segura" });
  assert.equal(beto.json().id, 2);

  const dup = await post("/register", { dname: "ana", password: "otra-clave-123" });
  assert.equal(dup.statusCode, 409);
  assert.equal(dup.json().error, "Ese nombre ya existe");
});

test("registro: datos inválidos", async () => {
  assert.equal((await post("/register", { dname: "a", password: "clave-segura" })).statusCode, 400);
  assert.equal((await post("/register", { dname: "con espacio", password: "clave-segura" })).statusCode, 400);
  assert.equal((await post("/register", { dname: "Caro", password: "corta" })).statusCode, 400);
  assert.equal((await post("/register", {})).statusCode, 400);
});

test("login: correcto devuelve token; nombre o clave incorrectos dan el mismo error", async () => {
  const ok = await post("/login", { dname: "ana", password: "clave-segura" }); // mayúsculas no importan
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().dname, "Ana");
  assert.equal(gameServerVerify(ok.json().token), 1);

  const wrongPassword = await post("/login", { dname: "Ana", password: "clave-mala-123" });
  const unknownUser = await post("/login", { dname: "Nadie", password: "clave-segura" });
  assert.equal(wrongPassword.statusCode, 401);
  assert.deepEqual(wrongPassword.json(), unknownUser.json());
});

test("límite de intentos por IP", async () => {
  const limited = await buildApp(db, { ...config, requestsPerMinute: 2 });
  const codes = [];
  for (let i = 0; i < 3; i++) {
    const res = await limited.inject({ method: "POST", url: "/login", payload: { dname: "Ana", password: "x" } });
    codes.push(res.statusCode);
  }
  await limited.close();
  assert.deepEqual(codes, [400, 400, 429]);
});
