// Módulo friends: lista de amigos y solicitudes de amistad. Todas las rutas piden sesión (JWT).
import type { FastifyInstance } from "fastify";
import type { ModuleDeps } from "../../shared/module";
import { listRoute } from "./list";
import { removeRoute } from "./remove";
import { requestsRoutes } from "./requests";

export function friendsModule(app: FastifyInstance, deps: ModuleDeps): void {
  listRoute(app, deps);
  requestsRoutes(app, deps);
  removeRoute(app, deps);
}
