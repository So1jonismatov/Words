import fs from "node:fs";

/** Loads .env.local then .env (already-set variables win), like Next.js does. */
for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
