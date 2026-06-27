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

  const { text, sentimentScore, trigger, suggestedCategory } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text field is required' });
  }

  try {
    // Lazily create table
    await sql`
      CREATE TABLE IF NOT EXISTS journal_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        raw_text TEXT NOT NULL,
        sentiment_score INTEGER NOT NULL,
        trigger_label TEXT NOT NULL,
        suggested_category TEXT NOT NULL
      );
    `;

    const result = await sql`
      INSERT INTO journal_events (raw_text, sentiment_score, trigger_label, suggested_category)
      VALUES (${text}, ${sentimentScore || 5}, ${trigger || 'general'}, ${suggestedCategory || 'Mindfulness'})
      RETURNING id, timestamp;
    `;

    const createdRecord = result.rows[0];
    return res.status(200).json({
      id: createdRecord.id,
      timestamp: createdRecord.timestamp,
    });
  } catch (error: any) {
    console.error('Database insertion error:', error);
    return res.status(500).json({ error: 'Database operation failed', details: error.message });
  }
}
