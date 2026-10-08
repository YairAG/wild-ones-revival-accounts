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

Organizado **por funcionalidad**: cada carpeta de `src/modules/` tiene todo lo de una función (rutas,
lógica, acceso a Mongo y tipos). Para entender el registro basta con abrir `register.ts`.

```
src/
  server.ts            punto de entrada: lee el .env, conecta a Mongo, abre el puerto
  app.ts               arma la app: CORS, límite de intentos, errores y módulos
  config/env.ts        lee y valida el .env (si falta algo obligatorio, no arranca)
  db/                  conexión, índices e ids numéricos consecutivos
  shared/              errores (AppError), validación con zod, tipo ModuleDeps
  modules/
    auth/              registrarse y entrar
      index.ts           registra las rutas del módulo
      register.ts        POST /register, de principio a fin
      login.ts           POST /login, de principio a fin
      accounts.ts        colección accounts (credenciales)
      password.ts        hash de contraseñas (scrypt)
      token.ts           JWT para el servidor de juego
      schemas.ts         validación del body
      types.ts           Account, Session
    players/           el jugador del juego
      new-player.ts      jugador inicial: los valores iniciales se ajustan aquí
      players.ts         colección users
      types.ts           Player, Pet
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
