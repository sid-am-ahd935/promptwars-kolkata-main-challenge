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

  const { text, userId, username } = req.body;

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

    if (!resolvedUserId) {
      return res.status(400).json({ error: 'Valid userId or username is required' });
    }

    // Call the Unified Multidimensional AI Insight Engine via Gemini
    const apiKey = process.env.VITE_GEMINI_API_KEY || (import.meta.env as any)?.VITE_GEMINI_API_KEY;
    let insight = {
      isCrisis: false,
      sentimentScore: 5,
      extractedTrigger: 'general',
      suggestedCategory: 'Mindfulness',
      agentResponseText: 'Thank you for sharing your reflection today. Let\'s continue tracking your wellness.',
    };

    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
          systemInstruction:
            'Analyze the user\'s reflection text.\n' +
            '1. Assess semantic psychological intent for crisis/self-harm. If present, set isCrisis to true, sentimentScore to 1, suggestedCategory to \'Coping\', extractedTrigger to \'crisis\', and agentResponseText to an immediate warm grounding statement.\n' +
            '2. Otherwise, accurately calculate a sentiment score (1-10), extract the core environmental or academic trigger phrase (e.g. "exam", "family", "sleep", "social", "work", "health" or "general"), select the therapeutic category, and compose a personalized, two-sentence empathetic coping strategy under agentResponseText.',
        });

        const prompt = `Process this journal entry reflection text: "${text}".\nOutput MUST match this JSON schema exactly:\n{\n  "isCrisis": boolean,\n  "sentimentScore": number,\n  "extractedTrigger": "string",\n  "suggestedCategory": "Coping" | "Mindfulness" | "Encouragement",\n  "agentResponseText": "string"\n}`;
        const result = await model.generateContent(prompt);
        const data = JSON.parse(result.response.text());

        insight = {
          isCrisis: data.isCrisis === true,
          sentimentScore: typeof data.sentimentScore === 'number' ? Math.max(1, Math.min(10, Math.round(data.sentimentScore))) : 5,
          extractedTrigger: typeof data.extractedTrigger === 'string' ? data.extractedTrigger.trim().toLowerCase() : 'general',
          suggestedCategory:
            data.suggestedCategory === 'Coping' ||
            data.suggestedCategory === 'Mindfulness' ||
            data.suggestedCategory === 'Encouragement'
              ? data.suggestedCategory
              : 'Mindfulness',
          agentResponseText: typeof data.agentResponseText === 'string' ? data.agentResponseText.trim() : 'We are here to support your reflection journey.',
        };
      } catch (err) {
        console.warn('Gemini Unified Insight Engine failed, using local fallback:', err);
        // Simple local extraction fallback logic on backend
        const clean = text.toLowerCase();
        const isCrisisLocal =
          clean.includes('suicide') ||
          clean.includes('self-harm') ||
          clean.includes('kill myself') ||
          clean.includes('end my life') ||
          clean.includes('want to die');

        if (isCrisisLocal) {
          insight = {
            isCrisis: true,
            sentimentScore: 1,
            extractedTrigger: 'crisis',
            suggestedCategory: 'Coping',
            agentResponseText: 'Immediate crisis support helpline options are available below. Please take care of yourself.',
          };
        }
      }
    } else {
      // Local check if no API key is present
      const clean = text.toLowerCase();
      const isCrisisLocal =
        clean.includes('suicide') ||
        clean.includes('self-harm') ||
        clean.includes('kill myself') ||
        clean.includes('end my life') ||
        clean.includes('want to die');

      if (isCrisisLocal) {
        insight = {
          isCrisis: true,
          sentimentScore: 1,
          extractedTrigger: 'crisis',
          suggestedCategory: 'Coping',
          agentResponseText: 'Immediate crisis support helpline options are available below. Please take care of yourself.',
        };
      }
    }

    // Execute ONE clean SQL insert into Postgres user_journal_events
    const insertRes = await sql`
      INSERT INTO user_journal_events (user_id, raw_text, sentiment_score, trigger_label, suggested_category)
      VALUES (${resolvedUserId}, ${text}, ${insight.sentimentScore}, ${insight.extractedTrigger}, ${insight.suggestedCategory})
      RETURNING id, timestamp;
    `;

    const createdRecord = insertRes.rows[0];

    // Return the full JSON payload back to the frontend client
    return res.status(200).json({
      success: true,
      isCrisis: insight.isCrisis,
      data: {
        id: createdRecord.id,
        timestamp: createdRecord.timestamp,
        isCrisis: insight.isCrisis,
        sentimentScore: insight.sentimentScore,
        extractedTrigger: insight.extractedTrigger,
        suggestedCategory: insight.suggestedCategory,
        agentResponseText: insight.agentResponseText,
        userId: resolvedUserId,
      },
    });
  } catch (error: any) {
    console.error('Unified Insight Engine error:', error);
    return res.status(500).json({ error: 'Insight engine transaction failed', details: error.message });
  }
}
