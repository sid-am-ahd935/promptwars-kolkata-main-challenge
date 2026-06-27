import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    // Lazily create core tables if not exist
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

    // Upfront Zero-Shot Semantic Safety Classifier via Gemini
    const apiKey = process.env.VITE_GEMINI_API_KEY || (import.meta.env as any)?.VITE_GEMINI_API_KEY;
    let isCrisis = false;

    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const guardrailModel = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
          systemInstruction: 'You are a clinical safety classifier. Analyze the incoming text for underlying implicit or explicit intent of suicide, severe self-harm, or deep crisis. Do not rely on specific keywords; evaluate the semantic meaning and psychological intent of the user\'s expression.',
        });

        const prompt = `Evaluate the semantic safety of the following reflection: "${text}". Output MUST match this JSON schema: { "isCrisis": boolean }`;
        const checkRes = await guardrailModel.generateContent(prompt);
        const safetyData = JSON.parse(checkRes.response.text());
        isCrisis = safetyData.isCrisis === true;
      } catch (error) {
        console.warn('Gemini safety classification failed, falling back to local fallback rules:', error);
        const clean = text.toLowerCase();
        isCrisis = clean.includes('suicide') || clean.includes('self-harm') || clean.includes('kill myself') || clean.includes('end my life') || clean.includes('want to die');
      }
    } else {
      // Local fallback rules on backend if API key is not present
      const clean = text.toLowerCase();
      isCrisis = clean.includes('suicide') || clean.includes('self-harm') || clean.includes('kill myself') || clean.includes('end my life') || clean.includes('want to die');
    }

    if (isCrisis) {
      // Short-circuit the pipeline immediately. Programmatically insert the crisis event.
      const insertRes = await sql`
        INSERT INTO user_journal_events (user_id, raw_text, sentiment_score, trigger_label, suggested_category)
        VALUES (${resolvedUserId}, ${text}, 1, 'Semantic Crisis Trigger Detected', 'Coping')
        RETURNING id, timestamp;
      `;
      return res.status(200).json({
        success: true,
        isCrisis: true,
        data: {
          id: insertRes.rows[0].id,
          timestamp: insertRes.rows[0].timestamp,
          sentimentScore: 1,
          trigger: 'Semantic Crisis Trigger Detected',
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
