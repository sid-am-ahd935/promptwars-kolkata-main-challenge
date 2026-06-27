import { sql } from '@vercel/postgres';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Lazily create table on startup
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
      SELECT * FROM journal_events ORDER BY timestamp DESC;
    `;

    const entries = result.rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      text: row.raw_text,
      sentimentScore: row.sentiment_score,
      trigger: row.trigger_label,
      suggestedCategory: row.suggested_category,
    }));

    return res.status(200).json(entries);
  } catch (error: any) {
    console.error('Database fetch error:', error);
    return res.status(500).json({ error: 'Database fetch failed', details: error.message });
  }
}
