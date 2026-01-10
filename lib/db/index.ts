import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/drizzle/schema';

// Supabase requires SSL for pooled connections
const client = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
});

export const db = drizzle(client, { schema });

// Re-export schema for convenience
export * from '@/drizzle/schema';
