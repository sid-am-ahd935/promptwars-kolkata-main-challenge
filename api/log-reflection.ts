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

  const { text, sentimentScore, trigger, suggestedCategory, userId, username, updateId } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text field is required' });
  }

  try {
    // Lazily create core tables
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_journal_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        raw_text TEXT NOT NULL,
        sentiment_score INTEGER NOT NULL,
        trigger_label TEXT NOT NULL,
        suggested_category TEXT NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS crisis_dictionary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phrase TEXT UNIQUE NOT NULL
      );
    `;

    // Seed crisis dictionary if empty
    const countRes = await sql`SELECT count(*) FROM crisis_dictionary;`;
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      const crisisPhrases = [
        'self-harm',
        'suicide',
        'kill myself',
        'end my life',
        'want to die',
        'severe clinical depression',
        'help me die',
        'no reason to live',
        'hopeless',
        "can't go on",
        'cannot go on',
        'hurt myself',
        'ending it all',
        'not worth living',
      ];
      for (const phrase of crisisPhrases) {
        await sql`INSERT INTO crisis_dictionary (phrase) VALUES (${phrase}) ON CONFLICT DO NOTHING;`;
      }
    }

    // Resolve user ID if username is provided
    let resolvedUserId = userId;
    if (username) {
      const userRes = await sql`
        INSERT INTO user_profiles (username)
        VALUES (${username.trim()})
        ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
        RETURNING id;
      `;
      resolvedUserId = userRes.rows[0].id;
    }

    // Handle updates to existing reflections
    if (updateId) {
      await sql`
        UPDATE user_journal_events
        SET sentiment_score = ${sentimentScore},
            trigger_label = ${trigger},
            suggested_category = ${suggestedCategory}
        WHERE id = ${updateId};
      `;
      return res.status(200).json({ success: true });
    }

    if (!resolvedUserId) {
      return res.status(400).json({ error: 'Valid userId or username is required' });
    }

    // Perform database-driven Full-Text Search safety router check
    const checkRes = await sql`
      SELECT EXISTS (
        SELECT 1 FROM crisis_dictionary
        WHERE to_tsvector('english', ${text}) @@ plainto_tsquery('english', phrase)
      ) AS is_crisis;
    `;
    const isCrisis = checkRes.rows[0]?.is_crisis === true;

    if (isCrisis) {
      // Bypasses the LLM pipeline on the backend. Programmatically insert the crisis event.
      const insertRes = await sql`
        INSERT INTO user_journal_events (user_id, raw_text, sentiment_score, trigger_label, suggested_category)
        VALUES (${resolvedUserId}, ${text}, 1, 'Immediate Crisis Support', 'Coping')
        RETURNING id, timestamp;
      `;
      return res.status(200).json({
        success: true,
        isCrisis: true,
        data: {
          id: insertRes.rows[0].id,
          timestamp: insertRes.rows[0].timestamp,
          sentimentScore: 1,
          trigger: 'Immediate Crisis Support',
          suggestedCategory: 'Coping',
        },
      });
    }

    // Normal non-crisis insert
    const result = await sql`
      INSERT INTO user_journal_events (user_id, raw_text, sentiment_score, trigger_label, suggested_category)
      VALUES (${resolvedUserId}, ${text}, ${sentimentScore || 5}, ${trigger || 'general'}, ${suggestedCategory || 'Mindfulness'})
      RETURNING id, timestamp;
    `;

    const createdRecord = result.rows[0];
    return res.status(200).json({
      success: true,
      isCrisis: false,
      data: {
        id: createdRecord.id,
        timestamp: createdRecord.timestamp,
        userId: resolvedUserId,
      },
    });
  } catch (error: any) {
    console.error('Database operation error:', error);
    return res.status(500).json({ error: 'Database operation failed', details: error.message });
  }
}
