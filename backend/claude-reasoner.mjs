/**
 * FORENSIGHT — Claude Forensic Reasoning Engine (Phase 2)
 * 
 * Claude acts strictly as the analytical reasoning and explanation layer.
 * Receives the structured EvidenceBundle and outputs strictly validated JSON.
 * NEVER invents metadata, artifacts, or scores.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

export async function reasonWithClaude(evidenceBundle, apiKey = process.env.ANTHROPIC_API_KEY) {
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_anthropic_api_key_here')) {
    return {
      available: false,
      reason: 'ANTHROPIC_API_KEY is not configured in environment.',
      code: 'API_KEY_UNAVAILABLE',
    };
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const systemPrompt = `You are FORENSIGHT, an elite digital forensics reasoning system.
Your role is to reason over an empirical EvidenceBundle computed from measurable image properties and produce an explainable forensic verdict.

STRICT OPERATIONAL RULES:
1. Reason ONLY over the explicit evidence, measurements, and signals provided in the EvidenceBundle.
2. YOU MUST NEVER INVENT or assume metadata (e.g. camera make/model, timestamps), compression artifacts, localization regions, or model outputs not present in the bundle.
3. If analyzing an official document, award, or certificate, note that media forensics assesses pixel/container authenticity only, NOT credential validity or issuer authority.
4. If signals conflict, or if evidence is insufficient, you MUST set verdict to "INCONCLUSIVE".
5. Return ONLY a single raw valid JSON object. Do not include markdown codeblocks, backticks, or preamble.

REQUIRED JSON SCHEMA:
{
  "verdict": "AUTHENTICITY_LIKELY" | "MANIPULATION_LIKELY" | "INCONCLUSIVE",
  "confidence": <number between 0.0 and 1.0>,
  "strongest_evidence": [<string>, ...],
  "contradictory_evidence": [<string>, ...],
  "explanation": "<concise analytical forensic explanation>",
  "limitations": [<string>, ...],
  "recommended_action": "<actionable forensic recommendation>"
}`;

  const userPrompt = `Analyze this empirical EvidenceBundle and provide a forensic verdict:

${JSON.stringify(evidenceBundle, null, 2)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      return {
        available: false,
        reason: `Claude API returned status ${response.status}: ${errText.slice(0, 200)}`,
        code: 'API_ERROR',
      };
    }

    const data = await response.json();
    const rawContent = data.content?.[0]?.text;

    if (!rawContent) {
      return {
        available: false,
        reason: 'Empty response received from Claude API.',
        code: 'EMPTY_RESPONSE',
      };
    }

    // Clean potential markdown code formatting
    let cleanJson = rawContent.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7);
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3);
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3);
    }
    cleanJson = cleanJson.trim();

    const parsed = JSON.parse(cleanJson);

    // Validate schema
    const validVerdicts = ['AUTHENTICITY_LIKELY', 'MANIPULATION_LIKELY', 'INCONCLUSIVE'];
    if (!validVerdicts.includes(parsed.verdict)) {
      parsed.verdict = 'INCONCLUSIVE';
    }

    if (typeof parsed.confidence !== 'number' || isNaN(parsed.confidence)) {
      parsed.confidence = 0.5;
    } else {
      parsed.confidence = Math.max(0.0, Math.min(1.0, Number(parsed.confidence.toFixed(2))));
    }

    parsed.strongest_evidence = Array.isArray(parsed.strongest_evidence) ? parsed.strongest_evidence : [];
    parsed.contradictory_evidence = Array.isArray(parsed.contradictory_evidence) ? parsed.contradictory_evidence : [];
    parsed.limitations = Array.isArray(parsed.limitations) ? parsed.limitations : [];
    parsed.explanation = typeof parsed.explanation === 'string' ? parsed.explanation : 'Analysis completed.';
    parsed.recommended_action = typeof parsed.recommended_action === 'string' ? parsed.recommended_action : '';

    return {
      available: true,
      result: parsed,
      modelUsed: model,
    };
  } catch (err) {
    return {
      available: false,
      reason: `Claude request failed: ${err.message}`,
      code: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
    };
  }
}
