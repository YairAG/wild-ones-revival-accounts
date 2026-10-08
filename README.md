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

## Estructura

Arquitectura en capas, organizada por módulos. Cada capa solo habla con la de abajo:

```
rutas (HTTP)  →  servicio (lógica)  →  repositorios (Mongo)
```

| Archivo | Qué hace |
|---|---|
| `src/server.ts` | Punto de entrada: lee el `.env`, conecta a Mongo, abre el puerto |
| `src/app.ts` | Arma la app: CORS, límite de intentos, manejo de errores y módulos |
| `src/config/env.ts` | Lee y valida el `.env` (si falta algo obligatorio, no arranca) |
| `src/db/mongo.ts` | Conexión a Mongo e índices |
| `src/db/counters.ts` | Ids numéricos consecutivos |
| `src/modules/auth/auth.routes.ts` | Capa HTTP: `/register` y `/login` |
| `src/modules/auth/auth.service.ts` | Lógica de registro y login (no sabe de HTTP) |
| `src/modules/auth/auth.schemas.ts` | Validación del body (zod) |
| `src/modules/accounts/accounts.repository.ts` | Colección `accounts` |
| `src/modules/players/players.repository.ts` | Colección `users` |
| `src/modules/players/new-player.ts` | Jugador inicial (oro, mascota, armas…). **Los valores iniciales se ajustan aquí** |
| `src/shared/` | Piezas comunes: errores (`AppError`), contraseñas (scrypt), tokens (JWT), validación |
| `src/types/` | Tipos compartidos, uno por tema: config, cuenta, jugador, sesión |
| `test/` | Tests (`helpers/setup.ts` arranca la app con un Mongo temporal) |

**Para agregar algo nuevo** (p. ej. cambiar contraseña): el esquema va en `auth.schemas.ts`, la lógica en
`auth.service.ts`, la ruta en `auth.routes.ts`, y se agrega su test. Un módulo nuevo va en
`src/modules/<nombre>/` con esos mismos tres archivos, y se registra en `app.ts`.

## Datos en Mongo

La misma base que el servidor de juego:

- `accounts`: `{ userId, dname, passwordHash, createdAt }`. Solo la usa este backend. La contraseña nunca se
  guarda: solo `salt:hash` de scrypt.
- `users`: el jugador, con el formato que espera el servidor de juego. Este backend solo lo crea; después lo
  modifica el servidor de juego.
- `counters`: contador para que los ids sean 1, 2, 3…
