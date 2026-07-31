import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { serverEnv } from "~/env/server";
import * as schema from "./schema";

function createDbClient(): Client {
  if (serverEnv.DB_URL.startsWith("file:")) {
    return createClient({ url: serverEnv.DB_URL });
  }

  return createClient({
    url: serverEnv.DB_URL,
    authToken: serverEnv.DB_AUTH_TOKEN,
  });
}

const client = createDbClient();

export const db = drizzle(client, { schema });
