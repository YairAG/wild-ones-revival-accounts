// Perfil de jugador: estadísticas, mascotas, amigos en común y tu relación con él. Datos inventados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, type TestApp } from "./helpers/setup";

let t: TestApp;
const token: Record<string, string> = {};
const id: Record<string, number> = {};

before(async () => {
  t = await startTestApp();
  for (const dname of ["Ana", "Beto", "Caro", "Dani"]) {
    const session = (await t.post("/register", { dname, password: "clave-segura" })).json().data;
    token[dname] = session.token;
    id[dname] = session.id;
  }
  // Ana es amiga de Beto y de Caro; Beto también de Caro (amiga en común). Dani le mandó solicitud a Ana
  const befriend = async (a: string, b: string) => {
    await t.call("POST", "/friends/requests", token[a], { dname: b });
    await t.call("POST", `/friends/requests/${id[a]}/accept`, token[b]);
  };
  await befriend("Ana", "Beto");
  await befriend("Ana", "Caro");
  await befriend("Beto", "Caro");
  await t.call("POST", "/friends/requests", token.Dani, { dname: "Ana" });
  await t.db.collection("users").updateOne({ id: id.Beto }, { $set: { wins: 7, gamecount: 12 } });
});
after(() => t?.stop());

const profile = async (viewer: string, of: string) =>
  (await t.call("GET", `/players/${id[of]}`, token[viewer])).json();

test("perfil con estadísticas, mascotas y amigos en común", async () => {
  const res = await profile("Ana", "Beto");
  assert.equal(res.message, "Perfil de Beto");
  assert.deepEqual(res.data, {
    id: id.Beto,
    dname: "Beto",
    level: 0,
    wins: 7,
    losses: 0,
    gamecount: 12,
    presence: "offline",
    pets: [{ name: "Beto", type: res.data.pets[0].type }], // la mascota inicial lleva su nombre
    mutualFriends: 1, // Caro
    relation: "friends",
    blocked: false,
  });
});

test("la relación se ve desde quien mira", async () => {
  assert.equal((await profile("Ana", "Dani")).data.relation, "incoming");
  assert.equal((await profile("Dani", "Ana")).data.relation, "outgoing");
  assert.equal((await profile("Dani", "Beto")).data.relation, "none");
  assert.equal((await profile("Ana", "Ana")).data.relation, "self");

  await t.call("POST", `/blocks/${id.Dani}`, token.Ana);
  assert.equal((await profile("Ana", "Dani")).data.blocked, true);
  assert.equal((await profile("Dani", "Ana")).data.blocked, false); // no sabe que lo bloquearon
});

test("un jugador que no existe da 404; sin sesión, 401", async () => {
  const missing = await t.call("GET", "/players/9999", token.Ana);
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error, "PLAYER_NOT_FOUND");
  assert.equal((await t.call("GET", `/players/${id.Ana}`)).statusCode, 401);
});
