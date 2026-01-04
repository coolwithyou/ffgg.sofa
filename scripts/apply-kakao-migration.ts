import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  try {
    // Check if column exists
    const check = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'kakao_id'
    `;

    if (check.length > 0) {
      console.log('✅ kakao_id column already exists');
      return;
    }

    // Add column
    await sql`ALTER TABLE "users" ADD COLUMN "kakao_id" text`;
    console.log('✅ Added kakao_id column');

    // Add unique constraint
    await sql`ALTER TABLE "users" ADD CONSTRAINT "users_kakao_id_unique" UNIQUE("kakao_id")`;
    console.log('✅ Added unique constraint');

    console.log('Migration complete!');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Migration error:', message);
    process.exit(1);
  }
}

run();
