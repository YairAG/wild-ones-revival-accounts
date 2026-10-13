// Tu cuenta: cambiar contraseña, cerrar las otras sesiones y eliminar la cuenta. Datos inventados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, type TestApp, signup } from "./helpers/setup";

let t: TestApp;
before(async () => (t = await startTestApp()));
after(() => t?.stop());

// Entra y devuelve el token de acceso y el refresh token (cookie) de ese "navegador"
async function login(dname: string, password: string) {
  const res = await t.post("/login", { dname, password });
  const cookie = res.cookies.find((c) => c.name === "wr_refresh")!.value;
  return { token: res.json().data.token as string, cookie };
}
const withCookie = (
  method: "POST" | "DELETE",
  url: string,
  token: string,
  cookie: string,
  payload?: object,
) =>
  t.app.inject({
    method,
    url,
    payload,
    cookies: { wr_refresh: cookie },
    headers: { authorization: `Bearer ${token}` },
  });
const refreshWorks = async (cookie: string) =>
  (await t.app.inject({ method: "POST", url: "/refresh", cookies: { wr_refresh: cookie } }))
    .statusCode === 200;

test("cambiar contraseña: pide la actual y cierra las otras sesiones (esta sigue)", async () => {
  await t.post("/register", { ...signup, dname: "Ana", password: "clave-vieja-1" });
  const here = await login("Ana", "clave-vieja-1");
  const other = await login("Ana", "clave-vieja-1");

  const wrong = await withCookie("POST", "/account/password", here.token, here.cookie, {
    current: "no-es",
    next: "clave-nueva-2",
  });
  assert.equal(wrong.statusCode, 403);
  assert.equal(wrong.json().error, "WRONG_PASSWORD");
  const short = await withCookie("POST", "/account/password", here.token, here.cookie, {
    current: "clave-vieja-1",
    next: "corta",
  });
  assert.equal(short.json().error, "INVALID_DATA");

  const res = await withCookie("POST", "/account/password", here.token, here.cookie, {
    current: "clave-vieja-1",
    next: "clave-nueva-2",
  });
  assert.equal(res.json().message, "Contraseña cambiada. Se cerraron tus otras sesiones");
  assert.equal(await refreshWorks(other.cookie), false);
  assert.equal(await refreshWorks(here.cookie), true);
  assert.equal(
    (await t.post("/login", { dname: "Ana", password: "clave-vieja-1" })).statusCode,
    401,
  );
  assert.equal(
    (await t.post("/login", { dname: "Ana", password: "clave-nueva-2" })).statusCode,
    200,
  );
});

test("cerrar sesión en otros equipos", async () => {
  await t.post("/register", { ...signup, dname: "Beto", password: "clave-segura" });
  const here = await login("Beto", "clave-segura");
  const other = await login("Beto", "clave-segura");
  const res = await withCookie("POST", "/account/logout-others", here.token, here.cookie);
  assert.equal(res.json().message, "Se cerraron 2 sesiones"); // la del registro y la otra
  assert.equal(await refreshWorks(other.cookie), false);

  const again = await withCookie("POST", "/account/logout-others", here.token, here.cookie);
  assert.equal(again.json().message, "No había otras sesiones");
  assert.equal(await refreshWorks(here.cookie), true); // la de este navegador sigue
});

test("eliminar cuenta: pide la contraseña y borra todo lo del jugador", async () => {
  const caro = (
    await t.post("/register", { ...signup, dname: "Caro", password: "clave-segura" })
  ).json().data;
  const dani = (
    await t.post("/register", { ...signup, dname: "Dani", password: "clave-segura" })
  ).json().data;
  await t.call("POST", "/friends/requests", caro.token, { dname: "Dani" });
  await t.call("POST", `/blocks/${caro.id}`, dani.token); // Dani bloqueó a Caro
  await t.db
    .collection("chat_messages")
    .insertOne({ userId: caro.id, dname: "Caro", text: "hola", createdAt: new Date() });
  const here = await login("Caro", "clave-segura");

  const wrong = await withCookie("DELETE", "/account", here.token, here.cookie, {
    password: "no-es",
  });
  assert.equal(wrong.json().error, "WRONG_PASSWORD");

  const res = await withCookie("DELETE", "/account", here.token, here.cookie, {
    password: "clave-segura",
  });
  assert.deepEqual(res.json(), { ok: true, code: 200, message: "Cuenta eliminada" });
  assert.equal(res.cookies.find((c) => c.name === "wr_refresh")?.value, ""); // cookie borrada

  for (const [collection, filter] of [
    ["accounts", { userId: caro.id }],
    ["users", { id: caro.id }],
    ["sessions", { userId: caro.id }],
    ["chat_messages", { userId: caro.id }],
    ["friendships", { from: caro.id }],
    ["blocks", { to: caro.id }],
  ] as const) {
    assert.equal(await t.db.collection(collection).countDocuments(filter), 0, collection);
  }
  assert.equal(
    (await t.post("/login", { dname: "Caro", password: "clave-segura" })).statusCode,
    401,
  );
  // El nombre queda libre
  assert.equal(
    (await t.post("/register", { ...signup, dname: "Caro", password: "otra-clave-1" })).statusCode,
    201,
  );
});
