// Usage: npm run db:setup   (reads DATABASE_URL from .env.local)
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');

const statements = schema
  .split(';')
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter(Boolean);

for (const stmt of statements) {
  await sql.query(stmt);
}
console.log(`Done. Ran ${statements.length} statements.`);
