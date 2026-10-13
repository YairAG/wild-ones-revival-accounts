// Sesión con refresh token en cookie httpOnly: /login la abre, /refresh la renueva (rota) y /logout la cierra.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, testConfig, type TestApp, signup } from "./helpers/setup";

let t: TestApp;
before(async () => {
  t = await startTestApp();
  await t.post("/register", { ...signup, dname: "Ana", password: "clave-segura" });
});
after(() => t?.stop());

const sessionCookie = (res: { cookies: { name: string; value: string }[] }) =>
  res.cookies.find((c) => c.name === "wr_refresh");
const refresh = (token?: string) =>
  t.app.inject({
    method: "POST",
    url: "/refresh",
    cookies: token ? { wr_refresh: token } : {},
  });

async function login() {
  const res = await t.post("/login", { dname: "Ana", password: "clave-segura" });
  return sessionCookie(res)!.value;
}

test("login pone el refresh token en una cookie httpOnly y en Mongo solo queda su hash", async () => {
  const res = await t.post("/login", { dname: "Ana", password: "clave-segura" });
  const cookie = sessionCookie(res);
  assert.ok(cookie);
  assert.equal((cookie as { httpOnly?: boolean }).httpOnly, true);
  assert.equal((cookie as { sameSite?: string }).sameSite, "Strict");
  assert.equal((cookie as { maxAge?: number }).maxAge, 30 * 24 * 60 * 60);
  assert.equal(res.json().data.token.split(".").length, 3); // el de acceso sigue en el body (JWT)

  assert.equal(await t.db.collection("sessions").countDocuments({ tokenHash: cookie.value }), 0);
  assert.equal(await t.db.collection("sessions").countDocuments({ userId: 1 }), 2); // registro y login
});

test("refresh da un token de acceso nuevo y rota la cookie", async () => {
  const first = await login();
  const res = await refresh(first);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().message, "Sesión renovada");
  assert.equal(res.json().data.dname, "Ana");
  const { sub } = jwt.verify(res.json().data.token, testConfig.jwtSecret) as jwt.JwtPayload;
  assert.equal(sub, "1");

  const second = sessionCookie(res)!.value;
  assert.notEqual(second, first);
  assert.equal((await refresh(second)).statusCode, 200);
});

test("dos pestañas: el token recién rotado sirve unos segundos, sin cambiar la cookie; después ya no", async () => {
  const old = await login();
  await refresh(old); // la primera pestaña lo rota
  const other = await refresh(old); // la segunda llega con el viejo
  assert.equal(other.statusCode, 200);
  assert.equal(sessionCookie(other), undefined);

  // Pasada la gracia, el viejo ya no sirve
  await t.db.collection("sessions").updateMany({}, { $set: { rotatedAt: new Date(0) } });
  const late = await refresh(old);
  assert.equal(late.statusCode, 401);
  assert.equal(late.json().error, "SESSION_EXPIRED");
});

test("sin cookie, con una inventada o vencida: 401 y la cookie se borra", async () => {
  assert.equal((await refresh()).json().error, "SESSION_EXPIRED");
  const fake = await refresh("no-existe");
  assert.equal(fake.statusCode, 401);
  assert.equal(sessionCookie(fake)?.value, ""); // borrada

  const expired = await login();
  await t.db.collection("sessions").updateMany({}, { $set: { expiresAt: new Date(0) } });
  assert.equal((await refresh(expired)).statusCode, 401);
});

test("logout cierra la sesión: la cookie se borra y ya no se puede renovar", async () => {
  const token = await login();
  const res = await t.app.inject({
    method: "POST",
    url: "/logout",
    cookies: { wr_refresh: token },
  });
  assert.deepEqual(res.json(), { ok: true, code: 200, message: "Sesión cerrada" });
  assert.equal(sessionCookie(res)?.value, "");
  assert.equal((await refresh(token)).statusCode, 401);
});
