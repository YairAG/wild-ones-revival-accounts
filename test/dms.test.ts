// Mensajes privados: se mandan por el WebSocket del chat y se leen por HTTP. Quién puede escribir lo decide el
// ajuste de quien recibe (por defecto, solo amigos). Datos inventados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { WebSocket } from "ws";
import { startTestApp, type TestApp, signup } from "./helpers/setup";

let t: TestApp;
const token: Record<string, string> = {};
const id: Record<string, number> = {};
const client: Record<string, Awaited<ReturnType<typeof enter>>> = {};

// Evento del servidor, con sus campos opcionales para leerlos fácil
type AnyEvent = {
  type: string;
  error?: string;
  message?: { id: string; from: { dname: string }; to: { dname: string }; text: string };
};

// Conexión al chat ya con sesión: guarda lo que llega y deja esperar el siguiente evento
async function enter(dname: string) {
  const ws: WebSocket = await t.app.injectWS("/chat");
  const received: AnyEvent[] = [];
  const waiting: ((event: AnyEvent) => void)[] = [];
  ws.on("message", (raw) => {
    const event = JSON.parse(String(raw));
    const resolve = waiting.shift();
    if (resolve) resolve(event);
    else received.push(event);
  });
  const next = () =>
    new Promise<AnyEvent>((resolve) => {
      const event = received.shift();
      if (event) resolve(event);
      else waiting.push(resolve);
    });
  ws.send(JSON.stringify({ type: "auth", token: token[dname] }));
  await next(); // history
  return {
    ws,
    next,
    dm: (to: string, text: string) => ws.send(JSON.stringify({ type: "dm", to: id[to], text })),
  };
}
const wait2s = () => new Promise((resolve) => setTimeout(resolve, 2_000)); // un mensaje cada 2 s por jugador
const get = async (dname: string, url: string) => (await t.call("GET", url, token[dname])).json();

before(async () => {
  t = await startTestApp();
  await t.app.ready();
  for (const dname of ["Ana", "Beto", "Caro"]) {
    const session = (
      await t.post("/register", { ...signup, dname, password: "clave-segura" })
    ).json().data;
    token[dname] = session.token;
    id[dname] = session.id;
  }
  // Ana y Beto son amigos; Caro no es amiga de nadie
  await t.call("POST", "/friends/requests", token.Ana, { dname: "Beto" });
  await t.call("POST", `/friends/requests/${id.Ana}/accept`, token.Beto);
  for (const dname of ["Ana", "Beto", "Caro"]) client[dname] = await enter(dname);
});
after(async () => {
  for (const c of Object.values(client)) c.ws.terminate();
  await t?.stop();
});

let fromAna: string; // id del privado de Ana a Beto

test("un privado entre amigos llega a los dos y queda en sus conversaciones", async () => {
  client.Ana.dm("Beto", "hola Beto, pendejo");
  const forBeto = await client.Beto.next();
  const forAna = await client.Ana.next();
  assert.equal(forBeto.type, "dm");
  assert.deepEqual(forAna, forBeto);
  assert.equal(forBeto.message?.text, "hola Beto, ***"); // también se filtra
  assert.equal(forBeto.message?.from.dname, "Ana");
  fromAna = forBeto.message!.id;

  const [conversation] = (await get("Beto", "/dms")).data;
  assert.deepEqual(conversation.with, { id: id.Ana, dname: "Ana" });
  assert.equal(conversation.unread, 1);
  assert.equal(conversation.last.fromMe, false);

  const thread = (await get("Beto", `/dms/${id.Ana}`)).data;
  assert.deepEqual(
    thread.messages.map((m: { text: string }) => m.text),
    ["hola Beto, ***"],
  );
  assert.equal((await get("Beto", "/dms")).data[0].unread, 0); // abrirla la marca como leída
  assert.equal((await get("Ana", "/dms")).data[0].last.fromMe, true);
});

test("por defecto solo amigos; con 'everyone' cualquiera; con 'nobody' nadie", async () => {
  assert.equal((await get("Ana", "/account")).data.dmPolicy, "friends");
  client.Caro.dm("Ana", "hola");
  const refused = await client.Caro.next();
  assert.equal(refused.error, "DM_NOT_ALLOWED");

  await t.call("POST", "/account/privacy", token.Ana, { dmPolicy: "everyone" });
  await wait2s();
  client.Caro.dm("Ana", "hola Ana");
  assert.equal((await client.Ana.next()).message?.text, "hola Ana");
  await client.Caro.next();

  await t.call("POST", "/account/privacy", token.Ana, { dmPolicy: "nobody" });
  await wait2s();
  client.Beto.dm("Ana", "¿sigues ahí?"); // aunque sea su amigo
  assert.equal((await client.Beto.next()).error, "DM_NOT_ALLOWED");
  assert.equal(
    (await t.call("POST", "/account/privacy", token.Ana, { dmPolicy: "todos" })).statusCode,
    400,
  );
  await t.call("POST", "/account/privacy", token.Ana, { dmPolicy: "everyone" });
});

test("con un bloqueo de por medio no se puede escribir", async () => {
  await t.call("POST", `/blocks/${id.Caro}`, token.Ana);
  await wait2s();
  client.Caro.dm("Ana", "¿me bloqueaste?");
  assert.equal((await client.Caro.next()).error, "BLOCKED");
});

test("se puede reportar un privado que te mandaron, pero no uno ajeno", async () => {
  const own = await t.call("POST", "/reports", token.Beto, {
    targetId: id.Ana,
    reason: "harassment",
    messageId: fromAna,
  });
  assert.equal(own.statusCode, 201);
  const notYours = await t.call("POST", "/reports", token.Caro, {
    targetId: id.Ana,
    reason: "harassment",
    messageId: fromAna,
  });
  assert.equal(notYours.json().error, "MESSAGE_NOT_FOUND");
});
