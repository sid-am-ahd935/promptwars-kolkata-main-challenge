import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Preflight check
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.body;
  const cleanUsername = typeof username === 'string' ? username.trim() : '';

  if (!cleanUsername) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // Lazily create table
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL
      );
    `;

    const result = await sql`
      INSERT INTO user_profiles (username)
      VALUES (${cleanUsername})
      ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
      RETURNING id, username;
    `;

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('User resolution error:', error);
    return res.status(500).json({ error: 'Database operation failed', details: error.message });
  }
}
