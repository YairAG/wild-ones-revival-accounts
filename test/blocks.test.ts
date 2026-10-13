// Bloquear: quita la amistad y las solicitudes, impide solicitudes nuevas en los dos sentidos. Datos inventados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, type TestApp, signup } from "./helpers/setup";

let t: TestApp;
const token: Record<string, string> = {};
const id: Record<string, number> = {};

before(async () => {
  t = await startTestApp();
  for (const dname of ["Ana", "Beto", "Caro"]) {
    const session = (
      await t.post("/register", { ...signup, dname, password: "clave-segura" })
    ).json().data;
    token[dname] = session.token;
    id[dname] = session.id;
  }
  // Ana y Beto son amigos; Caro le mandó solicitud a Ana
  await t.call("POST", "/friends/requests", token.Ana, { dname: "Beto" });
  await t.call("POST", `/friends/requests/${id.Ana}/accept`, token.Beto);
  await t.call("POST", "/friends/requests", token.Caro, { dname: "Ana" });
});
after(() => t?.stop());

const friendsOf = async (dname: string) =>
  (await t.call("GET", "/friends", token[dname])).json().data;
const request = (from: string, to: string) =>
  t.call("POST", "/friends/requests", token[from], { dname: to });

test("bloquear quita la amistad y las solicitudes, y aparece en tu lista de bloqueados", async () => {
  const res = await t.call("POST", `/blocks/${id.Beto}`, token.Ana);
  assert.deepEqual(res.json(), { ok: true, code: 200, message: "Bloqueaste a Beto" });
  await t.call("POST", `/blocks/${id.Caro}`, token.Ana);

  const ana = await friendsOf("Ana");
  assert.deepEqual(ana.friends, []);
  assert.deepEqual(ana.incoming, []);
  assert.deepEqual(ana.blocked.map((p: { dname: string }) => p.dname).sort(), ["Beto", "Caro"]);
  assert.deepEqual((await friendsOf("Beto")).friends, []);
  assert.deepEqual((await friendsOf("Caro")).outgoing, []);
  assert.deepEqual((await friendsOf("Beto")).blocked, []); // Beto no bloqueó a nadie
});

test("mientras dure, nadie de los dos puede mandarle solicitud al otro", async () => {
  for (const [from, to] of [
    ["Beto", "Ana"],
    ["Ana", "Beto"],
  ]) {
    assert.deepEqual((await request(from, to)).json(), {
      ok: false,
      code: 403,
      message: "No puedes enviarle una solicitud a ese jugador",
      error: "BLOCKED",
    });
  }
});

test("errores al bloquear", async () => {
  assert.equal((await t.call("POST", `/blocks/${id.Ana}`, token.Ana)).json().error, "SELF_BLOCK");
  assert.equal((await t.call("POST", "/blocks/9999", token.Ana)).json().error, "PLAYER_NOT_FOUND");
  assert.equal((await t.call("POST", `/blocks/${id.Beto}`)).statusCode, 401);
});

test("desbloquear permite volver a mandar solicitudes", async () => {
  const res = await t.call("DELETE", `/blocks/${id.Beto}`, token.Ana);
  assert.equal(res.json().message, "Desbloqueaste a Beto");
  assert.equal((await request("Beto", "Ana")).statusCode, 201);

  const again = await t.call("DELETE", `/blocks/${id.Beto}`, token.Ana);
  assert.equal(again.statusCode, 404);
  assert.equal(again.json().error, "NOT_BLOCKED");
});
