# wildones-accounts

Backend de cuentas de Wild Ones Revival. Registra jugadores, verifica contraseñas y entrega el JWT
con el que el frontend entra al [servidor de juego](https://github.com/YairAG/Wild-Ones-Revival). Cumple el
contrato de [docs/CUENTAS.md](https://github.com/YairAG/Wild-Ones-Revival/blob/develop/docs/CUENTAS.md).

## Arrancar

    pnpm install
    cp .env.example .env   # MONGO_URL y JWT_SECRET iguales a los del servidor de juego
    pnpm dev               # http://localhost:3000, reinicia al guardar
    pnpm test              # no necesita Mongo instalado

## Formato de las respuestas

Todas las respuestas (y los avisos y errores del chat) tienen la misma forma:

```json
{ "ok": true,  "code": 201, "message": "Cuenta creada", "data": { "id": 1, "dname": "Ana", "token": "..." } }
{ "ok": false, "code": 409, "message": "Ese nombre ya existe", "error": "NAME_TAKEN" }
```

- `ok`: si salió bien. `code`: el código HTTP (también va en la respuesta). `message`: texto para el jugador.
- `data`: lo que devuelve la ruta, solo si hay algo que devolver. En las tablas de abajo se indica como `data`.
- `error`: identificador fijo para que el frontend decida qué hacer (no cambia si se reescribe el mensaje). La
  lista completa está en `src/shared/response.ts`. Generales: `INVALID_DATA` (400), `SESSION_EXPIRED` (401),
  `NOT_FOUND` (404, la ruta no existe), `TOO_MANY_REQUESTS` (429) y `SERVER_ERROR` (500).

## Rutas

| Ruta | Body | Respuesta |
|---|---|---|
| `POST /register` | `{ "dname": "Ana", "password": "..." }` | `201` data `{ id, dname, token }` · `400` · `409 NAME_TAKEN` |
| `POST /login` | `{ "dname": "Ana", "password": "..." }` | `200` data `{ id, dname, token }` · `401 WRONG_CREDENTIALS` (nombre o contraseña) |

- `dname`: 3 a 16 letras, números o `_`. Único sin importar mayúsculas ("Ana" = "ana").
- `password`: mínimo 8 caracteres.
- Límite (solo en estas dos rutas): `REQUESTS_PER_MINUTE` intentos por minuto y por IP (`429` si se pasa).
- El `token` se manda al servidor de juego: `{"command":"logIn","token":"<token>"}`.

### Amigos

Piden sesión: el mismo `token`, en `Authorization: Bearer <token>` (`401` si falta o expiró).

| Ruta | Body | Respuesta |
|---|---|---|
| `GET /friends` | | `200` data `{ friends, incoming, outgoing }` |
| `POST /friends/requests` | `{ "dname": "Beto" }` | `201` data `{ status: "pending" }` · `200` data `{ status: "accepted" }` si Beto ya te había enviado una · `404 PLAYER_NOT_FOUND` · `400 SELF_REQUEST` · `409 ALREADY_FRIENDS` / `ALREADY_REQUESTED` |
| `POST /friends/requests/:id/accept` | | `200` data `{ status: "accepted" }` · `404 REQUEST_NOT_FOUND` |
| `DELETE /friends/requests/:id` | | `200` (rechazar una recibida o cancelar una enviada) · `404 REQUEST_NOT_FOUND` |
| `DELETE /friends/:id` | | `200` (deja de ser amigo para los dos) · `404 NOT_FRIENDS` |

- `friends`: `[{ id, dname, level, presence }]`, en línea primero. `presence` (`"playing"`, `"lobby"` u
  `"offline"`) la escribe el servidor de juego en `users`.
- `incoming` / `outgoing`: `[{ id, dname }]`, solicitudes recibidas y enviadas.

### Chat global

WebSocket en `GET /chat` (`ws://localhost:3000/chat`). Cada mensaje es un JSON. El primero que manda el
cliente es el token (no va en la URL para que no quede en los logs):

| Cliente → servidor | Para qué |
|---|---|
| `{ "type": "auth", "token": "..." }` | Entrar. Responde `history`, o `error` y cierra si el token no sirve |
| `{ "type": "send", "text": "hola" }` | Escribir: 1 a 200 caracteres, uno cada 2 s por jugador |
| `{ "type": "delete", "id": "..." }` | Moderadores: borrar un mensaje |
| `{ "type": "mute", "userId": 3, "minutes": 60, "reason": "spam" }` | Moderadores: silenciar a un jugador (máximo una semana; `reason` opcional) |

| Servidor → cliente | Cuándo |
|---|---|
| `{ "type": "history", "messages": [...], "mod": false }` | Al entrar: los últimos 50 mensajes y si puedes moderar |
| `{ "type": "message", "message": { id, userId, dname, text, at } }` | Alguien escribió (le llega a todos) |
| `{ "type": "deleted", "id": "..." }` | Un moderador borró un mensaje (a todos) |
| `{ "type": "notice", "ok": true, "code", "message" }` | Aviso solo para ti (p. ej. al silenciar) |
| `{ "type": "error", "ok": false, "code", "message", "error" }` | Algo que mandaste no se pudo: `LOGIN_REQUIRED`, `TOO_FAST`, `MUTED`, `NOT_MOD`... |

- Las groserías de la lista de `src/modules/chat/filter.ts` se reemplazan por `***`. Si el texto cambió, se
  guarda también el original, que solo reciben los moderadores (campo `original` del mensaje).
- Los mensajes se guardan en la colección `chat_messages`.
- Cada borrado, silencio y quitar silencio queda en la colección `moderation_log`.
- Hacer moderador a alguien (en `mongosh`): `db.accounts.updateOne({ dname: "Ana" }, { $set: { role: "mod" } })`.
  Toma efecto la próxima vez que entre al chat.

#### Panel de moderación

Solo moderadores, con el `token` en `Authorization` (`401 SESSION_EXPIRED` sin sesión, `403 NOT_MOD` si no eres moderador).

| Ruta | Respuesta |
|---|---|
| `GET /chat/moderation` | `200` data `{ muted, log }` |
| `DELETE /chat/mutes/:id` | `200` (le quita el silencio) · `404 NOT_MUTED` |

- `muted`: `[{ id, dname, until }]`, los silenciados ahora (el que termina antes primero).
- `log`: las últimas 50 acciones, la más nueva primero: `{ at, mod, action, target, text?, minutes?, reason? }`.
  `action` es `"delete"`, `"mute"` o `"unmute"`; `mod` y `target` son `{ id, dname }`; `text` es el mensaje borrado.

## Estructura

Organizado **por funcionalidad**: cada carpeta de `src/modules/` tiene todo lo de una función (rutas,
lógica, acceso a Mongo y tipos). Para entender el registro basta con abrir `register.ts`.

```
src/
  server.ts            punto de entrada: lee el .env, conecta a Mongo, abre el puerto
  app.ts               arma la app: CORS, límite de intentos (por ruta), errores y módulos
  config/env.ts        lee y valida el .env (si falta algo obligatorio, no arranca)
  db/                  conexión, índices e ids numéricos consecutivos
  shared/              formato de respuestas, errores (AppError), validación con zod, tipo ModuleDeps
  modules/
    auth/              registrarse y entrar
      index.ts           registra las rutas del módulo
      register.ts        POST /register, de principio a fin
      login.ts           POST /login, de principio a fin
      accounts.ts        colección accounts (credenciales)
      password.ts        hash de contraseñas (scrypt)
      token.ts           JWT para el servidor de juego (firmar y verificar)
      require-user.ts    para rutas con sesión: id del jugador desde el token, o 401
      attempts-limit.ts  límite de intentos de /login y /register
      schemas.ts         validación del body
      types.ts           Account, Session
    players/           el jugador del juego
      new-player.ts      jugador inicial: los valores iniciales se ajustan aquí
      players.ts         colección users
      types.ts           Player, Pet, Presence
    friends/           amigos y solicitudes
      index.ts           registra las rutas del módulo
      list.ts            GET /friends
      requests.ts        enviar, aceptar y rechazar solicitudes
      remove.ts          DELETE /friends/:id
      friendships.ts     colección friendships
      schemas.ts         validación del body y del :id
      types.ts           Friendship, Friend, FriendsList
    chat/              chat global por WebSocket
      index.ts           GET /chat: entrar, escribir, moderar y repartir los mensajes
      messages.ts        colección chat_messages
      moderation.ts      rutas del panel de moderación
      moderation-log.ts  colección moderation_log
      filter.ts          filtro de groserías
      schemas.ts         validación de lo que manda el cliente
      types.ts           ChatMessage, ChatServerEvent
test/                  tests (helpers/setup.ts arranca la app con un Mongo temporal)
```

**Para agregar algo nuevo:**
- A una función que ya existe (p. ej. cambiar contraseña): `modules/auth/change-password.ts`, registrada en
  `modules/auth/index.ts`, más su test.
- Una función nueva (p. ej. ranking): carpeta `modules/ranking/` con su `index.ts`, y una línea en `app.ts`.

## Datos en Mongo

La misma base que el servidor de juego:

- `accounts`: `{ userId, dname, passwordHash, createdAt }`. Solo la usa este backend. La contraseña nunca se
  guarda: solo `salt:hash` de scrypt.
- `users`: el jugador, con el formato que espera el servidor de juego. Este backend solo lo crea; después lo
  modifica el servidor de juego.
- `counters`: contador para que los ids sean 1, 2, 3…
- `friendships`: `{ pair, from, to, status, createdAt }`, una por pareja de jugadores (`pair` = "menor-mayor"
  de los dos ids, con índice único). `status`: `"pending"` (solicitud de `from` a `to`) o `"accepted"`.
