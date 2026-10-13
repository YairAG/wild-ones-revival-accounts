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
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(body.code, 201);
  assert.equal(body.message, "Cuenta creada");
  const { id, dname, token } = body.data;
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
    (await t.post("/register", { dname: "Beto", password: "clave-segura" })).json().data.id,
    2,
  );

  const dup = await t.post("/register", { dname: "ana", password: "otra-clave-123" });
  assert.equal(dup.statusCode, 409);
  assert.deepEqual(dup.json(), {
    ok: false,
    code: 409,
    message: "Ese nombre ya existe",
    error: "NAME_TAKEN",
  });
});

test("registro: datos inválidos dan 400 con un mensaje para mostrar", async () => {
  const short = await t.post("/register", { dname: "Caro", password: "corta" });
  assert.equal(short.statusCode, 400);
  assert.deepEqual(short.json(), {
    ok: false,
    code: 400,
    message: "La contraseña debe tener al menos 8 caracteres",
    error: "INVALID_DATA",
  });

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
  assert.equal(ok.json().message, "Sesión iniciada");
  assert.equal(ok.json().data.dname, "Ana");
  assert.equal(gameServerVerify(ok.json().data.token), 1);

  const wrongPassword = await t.post("/login", { dname: "Ana", password: "clave-mala-123" });
  const unknownUser = await t.post("/login", { dname: "Nadie", password: "clave-segura" });
  assert.equal(wrongPassword.statusCode, 401);
  assert.deepEqual(wrongPassword.json(), unknownUser.json());
  assert.equal(wrongPassword.json().error, "WRONG_CREDENTIALS");
});

test("rutas que no existen y JSON mal escrito también usan el formato de error", async () => {
  const missing = await t.call("GET", "/no-existe");
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.json(), {
    ok: false,
    code: 404,
    message: "Esa ruta no existe",
    error: "NOT_FOUND",
  });
  const broken = await t.app.inject({
    method: "POST",
    url: "/login",
    payload: "{no es json",
    headers: { "content-type": "application/json" },
  });
  assert.equal(broken.statusCode, 400);
  assert.equal(broken.json().error, "INVALID_DATA");
});

test("límite de intentos por IP", async () => {
  const limited = await startTestApp({ requestsPerMinute: 2 });
  const responses = [];
  for (let i = 0; i < 3; i++)
    responses.push(await limited.post("/login", { dname: "Ana", password: "x" }));
  await limited.stop();
  assert.deepEqual(
    responses.map((r) => r.statusCode),
    [400, 400, 429],
  );
  assert.deepEqual(responses[2].json(), {
    ok: false,
    code: 429,
    message: "Demasiados intentos, espera un minuto",
    error: "TOO_MANY_REQUESTS",
  });
});
