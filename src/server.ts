// Punto de entrada: lee el .env, conecta a Mongo y abre el puerto HTTP.
import { buildApp } from "./app";
import { connectDb } from "./db";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en el .env`);
  return value;
}

async function main() {
  const { db } = await connectDb(required("MONGO_URL"));
  const app = await buildApp(db, {
    jwtSecret: required("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "10m",
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
    requestsPerMinute: Number(process.env.REQUESTS_PER_MINUTE || 10),
  });
  await app.listen({ port: Number(process.env.PORT || 3000), host: "0.0.0.0" });
}

main();
