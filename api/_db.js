import { neon } from '@neondatabase/serverless';

// Files starting with "_" are not exposed as routes by Vercel.
export const sql = neon(process.env.DATABASE_URL);
