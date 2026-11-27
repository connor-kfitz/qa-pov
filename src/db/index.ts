import * as schema from "./schema";

import { drizzle } from "drizzle-orm/node-postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");

export const db = drizzle(process.env.DATABASE_URL, { schema });
export { schema };
