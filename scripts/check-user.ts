import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as schema from '../drizzle/schema';

dotenv.config({ path: '.env.local' });

async function checkUser() {
  const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
  const db = drizzle(client, { schema });

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, 'me@me.com'),
  });

  if (!user) {
    console.log('User not found!');
  } else {
    console.log('User found:');
    console.log('  id:', user.id);
    console.log('  email:', user.email);
    console.log('  role:', user.role);
    console.log('  tenantId:', user.tenantId);
    console.log('  isPlatformAdmin:', user.isPlatformAdmin);
    console.log('  adminRole:', user.adminRole);
    console.log('  passwordHash exists:', !!user.passwordHash);
    console.log('  emailVerified:', user.emailVerified);
  }

  await client.end();
}

checkUser().catch(console.error);
