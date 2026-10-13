// Amigos: solicitudes, aceptar/rechazar, lista con presencia y eliminar. Datos inventados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, type TestApp, signup } from "./helpers/setup";

let t: TestApp;
const token: Record<string, string> = {}; // sesión de cada jugador
const id: Record<string, number> = {};

before(async () => {
  t = await startTestApp();
  for (const dname of ["Ana", "Beto", "Caro", "Dani"]) {
    const session = (
      await t.post("/register", { ...signup, dname, password: "clave-segura" })
    ).json().data;
    token[dname] = session.token;
    id[dname] = session.id;
  }
});
after(() => t?.stop());

const friendsOf = async (dname: string) =>
  (await t.call("GET", "/friends", token[dname])).json().data;
const request = (from: string, to: string) =>
  t.call("POST", "/friends/requests", token[from], { dname: to });

test("sin sesión o con un token falso responde 401", async () => {
  assert.equal((await t.call("GET", "/friends")).statusCode, 401);
  const fake = await t.call("GET", "/friends", "no-es-un-jwt");
  assert.equal(fake.statusCode, 401);
  assert.deepEqual(fake.json(), {
    ok: false,
    code: 401,
    message: "Tu sesión expiró, vuelve a entrar",
    error: "SESSION_EXPIRED",
  });
});

test("enviar y aceptar una solicitud", async () => {
  const sent = await request("Ana", "beto"); // el nombre no distingue mayúsculas
  assert.equal(sent.statusCode, 201);
  assert.deepEqual(sent.json(), {
    ok: true,
    code: 201,
    message: "Solicitud enviada a Beto",
    data: { status: "pending" },
  });

  assert.deepEqual((await friendsOf("Ana")).outgoing, [{ id: id.Beto, dname: "Beto" }]);
  assert.deepEqual((await friendsOf("Beto")).incoming, [{ id: id.Ana, dname: "Ana" }]);

  const accepted = await t.call("POST", `/friends/requests/${id.Ana}/accept`, token.Beto);
  assert.equal(accepted.json().message, "Solicitud aceptada");
  assert.deepEqual(accepted.json().data, { status: "accepted" });

  // Los dos se ven como amigos; sin presence (nunca se conectaron) cuenta como offline
  assert.deepEqual((await friendsOf("Ana")).friends, [
    { id: id.Beto, dname: "Beto", level: 0, presence: "offline" },
  ]);
  const beto = await friendsOf("Beto");
  assert.deepEqual(
    beto.friends.map((f: { dname: string }) => f.dname),
    ["Ana"],
  );
  assert.deepEqual(beto.incoming, []);
});

test("errores al enviar", async () => {
  const cases: [string, string, number, string, string][] = [
    ["Ana", "Nadie", 404, "PLAYER_NOT_FOUND", "No existe un jugador con ese nombre"],
    ["Ana", "Ana", 400, "SELF_REQUEST", "No puedes agregarte a ti mismo"],
    ["Ana", "Beto", 409, "ALREADY_FRIENDS", "Ya son amigos"],
  ];
  for (const [from, to, code, error, message] of cases) {
    const res = await request(from, to);
    assert.equal(res.statusCode, code, `${from} → ${to}`);
    assert.deepEqual(res.json(), { ok: false, code, message, error });
  }

  await request("Ana", "Caro");
  assert.deepEqual((await request("Ana", "Caro")).json(), {
    ok: false,
    code: 409,
    message: "Ya le enviaste una solicitud",
    error: "ALREADY_REQUESTED",
  });
});

test("si el otro ya te había enviado una, enviar la tuya los hace amigos", async () => {
  // Ana → Caro quedó pendiente en el test anterior
  const accepted = (await request("Caro", "Ana")).json();
  assert.equal(accepted.message, "Ahora eres amigo de Ana");
  assert.deepEqual(accepted.data, { status: "accepted" });
  assert.deepEqual(
    (await friendsOf("Caro")).friends.map((f: { dname: string }) => f.dname),
    ["Ana"],
  );
});

test("aceptar solo funciona con una solicitud que te enviaron", async () => {
  await request("Dani", "Beto");
  // Dani no puede aceptar su propia solicitud
  const own = await t.call("POST", `/friends/requests/${id.Beto}/accept`, token.Dani);
  assert.equal(own.statusCode, 404);
  assert.equal(own.json().error, "REQUEST_NOT_FOUND");
  // Y un id que no es número no llega a Mongo
  assert.equal((await t.call("POST", "/friends/requests/abc/accept", token.Beto)).statusCode, 400);
});

test("rechazar o cancelar una solicitud", async () => {
  // Beto rechaza la de Dani (enviada en el test anterior)
  const rejected = await t.call("DELETE", `/friends/requests/${id.Dani}`, token.Beto);
  assert.deepEqual(rejected.json(), { ok: true, code: 200, message: "Solicitud eliminada" });
  assert.deepEqual((await friendsOf("Dani")).outgoing, []);
  // Ya no hay nada que rechazar
  assert.equal(
    (await t.call("DELETE", `/friends/requests/${id.Dani}`, token.Beto)).statusCode,
    404,
  );
  // Una amistad no se borra por esta ruta
  assert.equal((await t.call("DELETE", `/friends/requests/${id.Beto}`, token.Ana)).statusCode, 404);
});

test("la lista ordena por presencia (en partida, en lobby, desconectado) y luego por nombre", async () => {
  // presence la escribe el servidor de juego en "users"
  await t.db.collection("users").updateOne({ id: id.Caro }, { $set: { presence: "playing" } });
  await t.db.collection("users").updateOne({ id: id.Beto }, { $set: { presence: "lobby" } });
  const friends = (await friendsOf("Ana")).friends;
  assert.deepEqual(
    friends.map((f: { dname: string; presence: string }) => [f.dname, f.presence]),
    [
      ["Caro", "playing"],
      ["Beto", "lobby"],
    ],
  );
});

test("eliminar un amigo lo quita para los dos", async () => {
  const removed = await t.call("DELETE", `/friends/${id.Beto}`, token.Ana);
  assert.deepEqual(removed.json(), { ok: true, code: 200, message: "Amigo eliminado" });
  assert.deepEqual(
    (await friendsOf("Beto")).friends.map((f: { dname: string }) => f.dname),
    [],
  );
  const again = await t.call("DELETE", `/friends/${id.Beto}`, token.Ana);
  assert.deepEqual(again.json(), {
    ok: false,
    code: 404,
    message: "Ese jugador no es tu amigo",
    error: "NOT_FRIENDS",
  });
});

test("las rutas de amigos no tienen el límite de intentos del login", async () => {
  const limited = await startTestApp({ requestsPerMinute: 2 });
  const { token: ana } = (
    await limited.post("/register", { ...signup, dname: "Ana", password: "clave-segura" })
  ).json().data;
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await limited.call("GET", "/friends", ana)).statusCode);
  assert.deepEqual(codes, [200, 200, 200, 200, 200]);
  await limited.stop();
});
