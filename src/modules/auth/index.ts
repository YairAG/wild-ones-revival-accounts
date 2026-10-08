// Módulo auth: registro y login.
import type { FastifyInstance } from "fastify";
import type { ModuleDeps } from "../../shared/module";
import { loginRoute } from "./login";
import { registerRoute } from "./register";

export function authModule(app: FastifyInstance, deps: ModuleDeps): void {
  registerRoute(app, deps);
  loginRoute(app, deps);
}
