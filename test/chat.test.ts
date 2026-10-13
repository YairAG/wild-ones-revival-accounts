// Chat global por WebSocket: entrar con el token, historial, enviar, filtro y límites. Datos inventados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { WebSocket } from "ws";
import { filterText } from "../src/modules/chat/filter";
import type { ChatMessage } from "../src/modules/chat/types";
import { startTestApp, type TestApp, signup } from "./helpers/setup";

let t: TestApp;
const token: Record<string, string> = {};

before(async () => {
  t = await startTestApp();
  await t.app.ready();
  for (const dname of ["Ana", "Beto", "Moni", "Dani"]) {
    token[dname] = (
      await t.post("/register", { ...signup, dname, password: "clave-segura" })
    ).json().data.token;
  }
  await t.db.collection("accounts").updateOne({ dname: "Moni" }, { $set: { role: "mod" } });
});
after(() => t?.stop());

// Cualquier evento del servidor, con todos sus campos opcionales para leerlos fácil en los tests
type AnyEvent = {
  type: string;
  error?: string;
  message?: ChatMessage;
  messages?: ChatMessage[];
  mod?: boolean;
};

// Evento de error con el formato de todas las respuestas
const fail = (code: number, error: string, message: string) => ({
  type: "error",
  ok: false,
  code,
  message,
  error,
});

// Conexión de prueba: guarda lo que llega y deja esperar el siguiente evento
async function connect() {
  const ws: WebSocket = await t.app.injectWS("/chat");
  const received: AnyEvent[] = [];
  const waiting: ((event: AnyEvent) => void)[] = [];
  ws.on("message", (raw) => {
    const event = JSON.parse(String(raw));
    const resolve = waiting.shift();
    if (resolve) resolve(event);
    else received.push(event);
  });
  return {
    ws,
    send: (message: object) => ws.send(JSON.stringify(message)),
    next: () =>
      new Promise<AnyEvent>((resolve) => {
        const event = received.shift();
        if (event) resolve(event);
        else waiting.push(resolve);
      }),
  };
}

async function enter(dname: string) {
  const client = await connect();
  client.send({ type: "auth", token: token[dname] });
  return { ...client, history: (await client.next()).messages };
}

test("sin token válido responde con error y cierra", async () => {
  const client = await connect();
  const closed = new Promise((resolve) => client.ws.on("close", resolve));
  client.send({ type: "auth", token: "no-es-un-jwt" });
  assert.deepEqual(
    await client.next(),
    fail(401, "SESSION_EXPIRED", "Tu sesión expiró, vuelve a entrar"),
  );
  await closed;
});

test("escribir antes de entrar no se permite", async () => {
  const client = await connect();
  client.send({ type: "send", text: "hola" });
  assert.deepEqual(await client.next(), fail(401, "LOGIN_REQUIRED", "Primero entra con tu sesión"));
  client.ws.terminate();
});

test("un mensaje llega a todos y queda en el historial", async () => {
  const ana = await enter("Ana");
  const beto = await enter("Beto");
  assert.deepEqual(ana.history, []);

  ana.send({ type: "send", text: "  hola a todos  " });
  const forAna = await ana.next();
  const forBeto = await beto.next();
  assert.equal(forAna.type, "message");
  assert.deepEqual(forBeto, forAna);
  assert.equal(forAna.message?.dname, "Ana");
  assert.equal(forAna.message?.text, "hola a todos"); // sin espacios de más
  assert.equal(forAna.message?.original, undefined); // sin groserías no hay original
  assert.ok(!Number.isNaN(Date.parse(forAna.message?.at)));

  const later = await enter("Beto"); // una conexión nueva ya ve el mensaje
  assert.deepEqual(later.history, [forAna.message]);
  for (const c of [ana, beto, later]) c.ws.terminate();
});

test("un mensaje cada 2 s, no vacío y de 200 caracteres como máximo", async () => {
  const beto = await enter("Beto");
  beto.send({ type: "send", text: "   " });
  assert.deepEqual(await beto.next(), fail(400, "INVALID_DATA", "Escribe un mensaje"));
  beto.send({ type: "send", text: "x".repeat(201) });
  assert.deepEqual(await beto.next(), fail(400, "INVALID_DATA", "Máximo 200 caracteres"));

  // El primero pasa; el segundo, enviado enseguida, no
  beto.send({ type: "send", text: "uno" });
  assert.equal((await beto.next()).type, "message");
  beto.send({ type: "send", text: "dos" });
  assert.deepEqual(
    await beto.next(),
    fail(429, "TOO_FAST", "Espera un momento antes de mandar otro mensaje"),
  );
  beto.ws.terminate();
});

test("el filtro tapa groserías completas, también en plural y con mayúsculas", () => {
  assert.equal(filterText("eres un Pendejo"), "eres un ***");
  assert.equal(filterText("PUTOS todos"), "*** todos");
  assert.equal(filterText("ya está pendiente"), "ya está pendiente"); // no es palabra completa
  assert.equal(filterText("computo"), "computo");
});

test("moderación: solo un moderador borra mensajes (para todos) y silencia jugadores", async () => {
  const moni = await enter("Moni");
  const dani = await enter("Dani");

  dani.send({ type: "send", text: "spam" });
  const { message } = await moni.next();
  await dani.next();
  assert.ok(message);

  // Dani no es moderador
  dani.send({ type: "delete", id: message.id });
  assert.deepEqual(
    await dani.next(),
    fail(403, "NOT_MOD", "Solo los moderadores pueden hacer eso"),
  );

  moni.send({ type: "delete", id: message.id });
  assert.deepEqual(await moni.next(), { type: "deleted", id: message.id });
  assert.deepEqual(await dani.next(), { type: "deleted", id: message.id });
  moni.send({ type: "delete", id: message.id });
  assert.deepEqual(await moni.next(), fail(404, "MESSAGE_NOT_FOUND", "Ese mensaje ya no existe"));

  // Silenciar aplica aunque Dani ya esté conectado
  moni.send({ type: "mute", userId: message.userId, minutes: 60, reason: "spam repetido" });
  assert.deepEqual(await moni.next(), {
    type: "notice",
    ok: true,
    code: 200,
    message: "Dani silenciado 1 h",
  });
  await new Promise((resolve) => setTimeout(resolve, 2_000)); // el límite de 1 mensaje cada 2 s
  dani.send({ type: "send", text: "sigo aquí" });
  assert.deepEqual(await dani.next(), fail(403, "MUTED", "Estás silenciado 60 min más"));

  moni.send({ type: "mute", userId: 9999, minutes: 5 });
  assert.deepEqual(await moni.next(), fail(404, "PLAYER_NOT_FOUND", "No existe ese jugador"));
  for (const c of [moni, dani]) c.ws.terminate();
});

test("el historial dice si puedes moderar", async () => {
  const [moni, ana] = [await connect(), await connect()];
  moni.send({ type: "auth", token: token.Moni });
  ana.send({ type: "auth", token: token.Ana });
  assert.equal((await moni.next()).mod, true);
  assert.equal((await ana.next()).mod, false);
  for (const c of [moni, ana]) c.ws.terminate();
});

test("si el filtro cambia el texto, solo los moderadores reciben el original", async () => {
  const moni = await enter("Moni");
  const ana = await enter("Ana");
  ana.send({ type: "send", text: "eres un pendejo" });

  const forMod = (await moni.next()).message;
  const forAna = (await ana.next()).message;
  assert.equal(forMod?.text, "eres un ***");
  assert.equal(forMod?.original, "eres un pendejo");
  assert.equal(forAna?.text, "eres un ***");
  assert.equal(forAna?.original, undefined);

  // También en el historial
  const [later, mod] = [await enter("Beto"), await enter("Moni")];
  assert.equal(later.history?.at(-1)?.original, undefined);
  assert.equal(mod.history?.at(-1)?.original, "eres un pendejo");
  for (const c of [moni, ana, later, mod]) c.ws.terminate();
});

test("panel de moderación: silenciados, registro y quitar silencio (solo moderadores)", async () => {
  // Viene del test de moderación: Moni borró el "spam" de Dani y lo silenció 1 h
  const dani = (await t.db.collection("accounts").findOne({ dname: "Dani" }))!.userId;
  assert.equal((await t.call("GET", "/chat/moderation")).statusCode, 401);
  const notMod = await t.call("GET", "/chat/moderation", token.Ana);
  assert.equal(notMod.statusCode, 403);
  assert.deepEqual(notMod.json(), {
    ok: false,
    code: 403,
    message: "Solo los moderadores pueden hacer eso",
    error: "NOT_MOD",
  });

  const summary = (await t.call("GET", "/chat/moderation", token.Moni)).json().data;
  assert.deepEqual(
    summary.muted.map((m: { dname: string }) => m.dname),
    ["Dani"],
  );
  const [mute, del] = summary.log; // la más nueva primero
  assert.equal(mute.action, "mute");
  assert.equal(mute.mod.dname, "Moni");
  assert.deepEqual(mute.target, { id: dani, dname: "Dani" });
  assert.equal(mute.minutes, 60);
  assert.equal(mute.reason, "spam repetido");
  assert.equal(del.action, "delete");
  assert.equal(del.text, "spam");
  assert.equal(del.minutes, undefined);

  assert.equal((await t.call("DELETE", `/chat/mutes/${dani}`, token.Ana)).statusCode, 403);
  const unmuted = await t.call("DELETE", `/chat/mutes/${dani}`, token.Moni);
  assert.deepEqual(unmuted.json(), { ok: true, code: 200, message: "Dani ya puede escribir" });
  const again = await t.call("DELETE", `/chat/mutes/${dani}`, token.Moni);
  assert.equal(again.statusCode, 404);
  assert.equal(again.json().error, "NOT_MUTED");

  const after = (await t.call("GET", "/chat/moderation", token.Moni)).json().data;
  assert.deepEqual(after.muted, []);
  assert.equal(after.log[0].action, "unmute");
});
