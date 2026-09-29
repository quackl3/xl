import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Check if DATABASE_URL is set, but don't throw immediately
if (!process.env.DATABASE_URL) {
  console.warn(
    "\n⚠️  WARNING: DATABASE_URL is not set in environment variables.",
    "\n   Database features will not work until you set DATABASE_URL.",
    "\n   Please create a .env file in the project root with:",
    "\n   DATABASE_URL=postgresql://user:password@host/database?sslmode=require",
    "\n"
  );
}

// Initialize database connection - will throw error only when actually used
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Please create a .env file with your DATABASE_URL.\n" +
      "Example: DATABASE_URL=postgresql://user:password@host/database?sslmode=require"
    );
  }
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

function getDb() {
  if (!_db) {
    const pool = getPool();
    _db = drizzle({ client: pool, schema });
  }
  return _db;
}

// Helper function to safely get pool (returns null if not available)
export function getPoolSafe(): Pool | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  try {
    return getPool();
  } catch {
    return null;
  }
}

// Create a proxy that initializes on first access
export const pool = new Proxy({} as Pool, {
  get(target, prop) {
    const poolInstance = getPool();
    const value = poolInstance[prop as keyof Pool];
    // If it's a function, bind it to the pool instance
    if (typeof value === 'function') {
      return value.bind(poolInstance);
    }
    return value;
  }
}) as Pool;

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    const dbInstance = getDb();
    const value = dbInstance[prop as keyof ReturnType<typeof drizzle>];
    // If it's a function, bind it to the db instance
    if (typeof value === 'function') {
      return value.bind(dbInstance);
    }
    return value;
  }
}) as ReturnType<typeof drizzle>;
