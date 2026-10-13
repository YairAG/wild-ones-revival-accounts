// Chat global por WebSocket: entrar con el token, historial, enviar, filtro y límites. Datos inventados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { WebSocket } from "ws";
import { filterText } from "../src/modules/chat/filter";
import type { ChatMessage } from "../src/modules/chat/types";
import { startTestApp, type TestApp } from "./helpers/setup";

let t: TestApp;
const token: Record<string, string> = {};

before(async () => {
  t = await startTestApp();
  await t.app.ready();
  for (const dname of ["Ana", "Beto"]) {
    token[dname] = (await t.post("/register", { dname, password: "clave-segura" })).json().token;
  }
});
after(() => t?.stop());

// Cualquier evento del servidor, con todos sus campos opcionales para leerlos fácil en los tests
type AnyEvent = { type: string; error?: string; message?: ChatMessage; messages?: ChatMessage[] };

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
  assert.deepEqual(await client.next(), {
    type: "error",
    error: "Tu sesión expiró, vuelve a entrar",
  });
  await closed;
});

test("escribir antes de entrar no se permite", async () => {
  const client = await connect();
  client.send({ type: "send", text: "hola" });
  assert.deepEqual(await client.next(), { type: "error", error: "Primero entra con tu sesión" });
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
  assert.ok(!Number.isNaN(Date.parse(forAna.message?.at)));

  const later = await enter("Beto"); // una conexión nueva ya ve el mensaje
  assert.deepEqual(later.history, [forAna.message]);
  for (const c of [ana, beto, later]) c.ws.terminate();
});

test("un mensaje cada 2 s, no vacío y de 200 caracteres como máximo", async () => {
  const beto = await enter("Beto");
  beto.send({ type: "send", text: "   " });
  assert.deepEqual(await beto.next(), { type: "error", error: "Escribe un mensaje" });
  beto.send({ type: "send", text: "x".repeat(201) });
  assert.deepEqual(await beto.next(), { type: "error", error: "Máximo 200 caracteres" });

  // El primero pasa; el segundo, enviado enseguida, no
  beto.send({ type: "send", text: "uno" });
  assert.equal((await beto.next()).type, "message");
  beto.send({ type: "send", text: "dos" });
  assert.deepEqual(await beto.next(), {
    type: "error",
    error: "Espera un momento antes de mandar otro mensaje",
  });
  beto.ws.terminate();
});

test("el filtro tapa groserías completas, también en plural y con mayúsculas", () => {
  assert.equal(filterText("eres un Pendejo"), "eres un ***");
  assert.equal(filterText("PUTOS todos"), "*** todos");
  assert.equal(filterText("ya está pendiente"), "ya está pendiente"); // no es palabra completa
  assert.equal(filterText("computo"), "computo");
});
