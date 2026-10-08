// Punto de entrada: lee el .env, conecta a Mongo y abre el puerto HTTP.
import { buildApp } from "./app";
import { loadConfig } from "./config/env";
import { connectMongo } from "./db/mongo";

async function main() {
  const config = loadConfig();
  const { db } = await connectMongo(config.mongoUrl);
  const app = await buildApp(db, config);
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main();
