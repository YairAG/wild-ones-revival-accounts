// Reportes: un jugador reporta a otro, con el mensaje del chat adjunto; los moderadores los ven y los resuelven.
// Datos inventados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, type TestApp } from "./helpers/setup";

let t: TestApp;
const token: Record<string, string> = {};
const id: Record<string, number> = {};
let messageId: string; // un mensaje de Beto en el chat (filtrado: el original va al reporte)

before(async () => {
  t = await startTestApp();
  for (const dname of ["Ana", "Beto", "Moni"]) {
    const session = (await t.post("/register", { dname, password: "clave-segura" })).json().data;
    token[dname] = session.token;
    id[dname] = session.id;
  }
  await t.db.collection("accounts").updateOne({ dname: "Moni" }, { $set: { role: "mod" } });
  const { insertedId } = await t.db.collection("chat_messages").insertOne({
    userId: id.Beto,
    dname: "Beto",
    text: "eres un ***",
    original: "eres un pendejo",
    createdAt: new Date(),
  });
  messageId = String(insertedId);
});
after(() => t?.stop());

const report = (from: string, body: object) => t.call("POST", "/reports", token[from], body);
const summary = async () => (await t.call("GET", "/chat/moderation", token.Moni)).json().data;

test("reportar con el mensaje adjunto: los moderadores lo ven con el texto original", async () => {
  const res = await report("Ana", {
    targetId: id.Beto,
    reason: "harassment",
    details: "  me insulta seguido  ",
    messageId,
  });
  assert.deepEqual(res.json(), {
    ok: true,
    code: 201,
    message: "Reporte enviado. Moderación lo revisará",
  });

  const [open] = (await summary()).reports;
  assert.deepEqual(open.from, { id: id.Ana, dname: "Ana" });
  assert.deepEqual(open.target, { id: id.Beto, dname: "Beto" });
  assert.equal(open.reason, "harassment");
  assert.equal(open.details, "me insulta seguido");
  assert.equal(open.message.text, "eres un pendejo");
});

test("un reporte abierto por jugador; no a ti mismo; el mensaje tiene que ser del reportado", async () => {
  const again = await report("Ana", { targetId: id.Beto, reason: "spam" });
  assert.equal(again.statusCode, 409);
  assert.equal(again.json().error, "ALREADY_REPORTED");

  assert.equal(
    (await report("Ana", { targetId: id.Ana, reason: "spam" })).json().error,
    "SELF_REPORT",
  );
  assert.equal(
    (await report("Ana", { targetId: 9999, reason: "spam" })).json().error,
    "PLAYER_NOT_FOUND",
  );
  assert.equal(
    (await report("Beto", { targetId: id.Ana, reason: "spam", messageId })).json().error,
    "MESSAGE_NOT_FOUND", // el mensaje es de Beto, no de Ana
  );
  assert.equal((await report("Ana", { targetId: id.Beto, reason: "otra" })).statusCode, 400);
});

test("un moderador lo resuelve: sale de los abiertos y queda en el registro", async () => {
  const [open] = (await summary()).reports;
  assert.equal((await t.call("POST", `/reports/${open.id}/resolve`, token.Ana)).statusCode, 403);

  const res = await t.call("POST", `/reports/${open.id}/resolve`, token.Moni);
  assert.deepEqual(res.json(), { ok: true, code: 200, message: "Reporte resuelto" });
  const after = await summary();
  assert.deepEqual(after.reports, []);
  assert.equal(after.log[0].action, "resolve_report");
  assert.deepEqual(after.log[0].target, { id: id.Beto, dname: "Beto" });

  const twice = await t.call("POST", `/reports/${open.id}/resolve`, token.Moni);
  assert.equal(twice.json().error, "REPORT_NOT_FOUND");
  // Resuelto, ya se puede volver a reportar
  assert.equal((await report("Ana", { targetId: id.Beto, reason: "spam" })).statusCode, 201);
});
