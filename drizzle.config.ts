import { defineConfig } from "drizzle-kit";

const url = process.env.DB_URL ?? "file:local.db";
const remote = !url.startsWith("file:");

export default remote
  ? defineConfig({
      schema: "./src/server/db/schema.ts",
      out: "./drizzle",
      dialect: "turso",
      dbCredentials: { url, authToken: process.env.DB_AUTH_TOKEN },
    })
  : defineConfig({
      schema: "./src/server/db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: { url },
    });
