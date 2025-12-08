import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { users } from '../shared/schema';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const db = drizzle(client);

  const demoUsers = [
    { username: 'admin@txokoa.eus', password: 'demo' },
    { username: 'diruzaina@txokoa.eus', password: 'demo' },
    { username: 'sotolaria@txokoa.eus', password: 'demo' },
    { username: 'bazkidea@txokoa.eus', password: 'demo' },
    { username: 'laguna@txokoa.eus', password: 'demo' },
  ];

  console.log('Seeding demo users...');

  for (const user of demoUsers) {
    await db.insert(users)
      .values(user)
      .onConflictDoNothing({ target: users.username });
  }

  console.log('Done.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
