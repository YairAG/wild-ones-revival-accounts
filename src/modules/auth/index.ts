// Módulo auth: registro, login, la sesión (refresh token en cookie httpOnly) y tu cuenta.
import type { FastifyInstance } from "fastify";
import type { ModuleDeps } from "../../shared/module";
import { accountRoutes } from "./account";
import { loginRoute } from "./login";
import { refreshRoutes } from "./refresh";
import { registerRoute } from "./register";

export function authModule(app: FastifyInstance, deps: ModuleDeps): void {
  registerRoute(app, deps);
  loginRoute(app, deps);
  refreshRoutes(app, deps);
  accountRoutes(app, deps);
}
