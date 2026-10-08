// Lo que recibe cada módulo al registrarse en app.ts
import type { Db } from "mongodb";
import type { Config } from "../config/env";

export type ModuleDeps = { db: Db; config: Config };
