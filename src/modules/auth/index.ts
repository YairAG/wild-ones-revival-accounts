// Módulo auth: registro, login y la sesión (refresh token en cookie httpOnly).
import type { FastifyInstance } from "fastify";
import type { ModuleDeps } from "../../shared/module";
import { loginRoute } from "./login";
import { refreshRoutes } from "./refresh";
import { registerRoute } from "./register";

export function authModule(app: FastifyInstance, deps: ModuleDeps): void {
  registerRoute(app, deps);
  loginRoute(app, deps);
  refreshRoutes(app, deps);
}
