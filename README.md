# wildones-accounts

Backend de cuentas de Wild Ones Revival (privado). Registra jugadores, verifica contraseñas y entrega el JWT
con el que el frontend entra al [servidor de juego](https://github.com/YairAG/Wild-Ones-Revival). Cumple el
contrato de [docs/CUENTAS.md](https://github.com/YairAG/Wild-Ones-Revival/blob/develop/docs/CUENTAS.md).

## Arrancar

    pnpm install
    cp .env.example .env   # MONGO_URL y JWT_SECRET iguales a los del servidor de juego
    pnpm dev               # http://localhost:3000, reinicia al guardar
    pnpm test              # no necesita Mongo instalado

## Rutas

| Ruta | Body | Respuesta |
|---|---|---|
| `POST /register` | `{ "dname": "Ana", "password": "..." }` | `201 { id, dname, token }` · `400` datos inválidos · `409` nombre ocupado |
| `POST /login` | `{ "dname": "Ana", "password": "..." }` | `200 { id, dname, token }` · `401` nombre o contraseña incorrectos |

- `dname`: 3 a 16 letras, números o `_`. Único sin importar mayúsculas ("Ana" = "ana").
- `password`: mínimo 8 caracteres.
- Errores: `{ "error": "mensaje para mostrar" }`.
- Límite: `REQUESTS_PER_MINUTE` intentos por minuto y por IP (`429` si se pasa).
- El `token` se manda al servidor de juego: `{"command":"logIn","token":"<token>"}`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `src/server.ts` | Punto de entrada: lee el `.env`, conecta a Mongo, abre el puerto |
| `src/app.ts` | Las dos rutas, validación, CORS y límite de intentos |
| `src/db.ts` | Conexión a Mongo, índices y el contador de ids |
| `src/password.ts` | Hash y verificación de contraseñas (scrypt, incluido en Node) |
| `src/player.ts` | Documento inicial del jugador (oro, mascota, armas…). **Los valores iniciales se ajustan aquí** |
| `test/auth.test.ts` | Tests con un Mongo temporal |

## Datos en Mongo

La misma base que el servidor de juego:

- `accounts`: `{ userId, dname, passwordHash, createdAt }`. Solo la usa este backend. La contraseña nunca se
  guarda: solo `salt:hash` de scrypt.
- `users`: el jugador, con el formato que espera el servidor de juego. Este backend solo lo crea; después lo
  modifica el servidor de juego.
- `counters`: contador para que los ids sean 1, 2, 3…
