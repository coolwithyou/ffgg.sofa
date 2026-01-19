// scripts/migrate-audit-logs.ts
import postgres from 'postgres';
import { config } from 'dotenv';

// Load .env.local first, then fallback to .env
config({ path: '.env.local' });
config({ path: '.env' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  try {
    console.log('Starting migration...');

    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS validation_audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        session_id uuid NOT NULL,
        user_id uuid NOT NULL,
        action text NOT NULL,
        target_type text,
        target_id text,
        previous_value text,
        new_value text,
        metadata jsonb,
        ip_address text,
        user_agent text,
        created_at timestamp with time zone DEFAULT now()
      )
    `;
    console.log('✓ Table created');

    // Add FK constraints (ignore if already exists)
    try {
      await sql`
        ALTER TABLE validation_audit_logs
        ADD CONSTRAINT validation_audit_logs_session_id_validation_sessions_id_fk
        FOREIGN KEY (session_id) REFERENCES validation_sessions(id) ON DELETE cascade ON UPDATE no action
      `;
      console.log('✓ Session FK added');
    } catch (e) {
      console.log('  Session FK already exists');
    }

    try {
      await sql`
        ALTER TABLE validation_audit_logs
        ADD CONSTRAINT validation_audit_logs_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade ON UPDATE no action
      `;
      console.log('✓ User FK added');
    } catch (e) {
      console.log('  User FK already exists');
    }

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON validation_audit_logs USING btree (session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON validation_audit_logs USING btree (user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON validation_audit_logs USING btree (action)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON validation_audit_logs USING btree (created_at)`;
    console.log('✓ Indexes created');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
