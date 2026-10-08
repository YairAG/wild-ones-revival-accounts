// Rutas /register y /login, de punta a punta (HTTP → servicio → Mongo).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, testConfig, type TestApp } from "./helpers/setup";

let t: TestApp;
before(async () => (t = await startTestApp()));
after(() => t?.stop());

// Verifica el token igual que el servidor de juego (handler/auth.ts): HS256, sub = id numérico
function gameServerVerify(token: string): number {
  const payload = jwt.verify(token, testConfig.jwtSecret, {
    algorithms: ["HS256"],
  }) as jwt.JwtPayload;
  return Number(payload.sub);
}

test("registro: crea la cuenta y el jugador, y devuelve un token válido para el servidor de juego", async () => {
  const res = await t.post("/register", { dname: "Ana", password: "clave-segura" });
  assert.equal(res.statusCode, 201);
  const { id, dname, token } = res.json();
  assert.equal(id, 1);
  assert.equal(dname, "Ana");
  assert.equal(gameServerVerify(token), 1);

  // Jugador con el formato que espera el servidor de juego (docs/CUENTAS.md)
  const user = await t.db.collection("users").findOne({ id: 1 });
  assert.equal(user?.dname, "Ana");
  assert.equal(user?.gold, 1000);
  assert.ok(user?.ownedPets[user.currentPet], "currentPet tiene que existir en ownedPets");
  assert.equal(user?.password, undefined);

  // La contraseña solo está como hash, en accounts
  const account = await t.db.collection("accounts").findOne({ userId: 1 });
  assert.match(account?.passwordHash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test("registro: ids consecutivos y nombres únicos sin importar mayúsculas", async () => {
  assert.equal(
    (await t.post("/register", { dname: "Beto", password: "clave-segura" })).json().id,
    2,
  );

  const dup = await t.post("/register", { dname: "ana", password: "otra-clave-123" });
  assert.equal(dup.statusCode, 409);
  assert.deepEqual(dup.json(), { error: "Ese nombre ya existe" });
});

test("registro: datos inválidos dan 400 con un mensaje para mostrar", async () => {
  const short = await t.post("/register", { dname: "Caro", password: "corta" });
  assert.equal(short.statusCode, 400);
  assert.deepEqual(short.json(), { error: "La contraseña debe tener al menos 8 caracteres" });

  assert.equal(
    (await t.post("/register", { dname: "a", password: "clave-segura" })).statusCode,
    400,
  );
  assert.equal(
    (await t.post("/register", { dname: "con espacio", password: "clave-segura" })).statusCode,
    400,
  );
  assert.equal((await t.post("/register", {})).statusCode, 400);
});

test("login: correcto devuelve token; nombre o clave incorrectos dan el mismo error", async () => {
  const ok = await t.post("/login", { dname: "ana", password: "clave-segura" }); // mayúsculas no importan
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().dname, "Ana");
  assert.equal(gameServerVerify(ok.json().token), 1);

  const wrongPassword = await t.post("/login", { dname: "Ana", password: "clave-mala-123" });
  const unknownUser = await t.post("/login", { dname: "Nadie", password: "clave-segura" });
  assert.equal(wrongPassword.statusCode, 401);
  assert.deepEqual(wrongPassword.json(), unknownUser.json());
});

test("límite de intentos por IP", async () => {
  const limited = await startTestApp({ requestsPerMinute: 2 });
  const codes = [];
  for (let i = 0; i < 3; i++)
    codes.push((await limited.post("/login", { dname: "Ana", password: "x" })).statusCode);
  await limited.stop();
  assert.deepEqual(codes, [400, 400, 429]);
});
