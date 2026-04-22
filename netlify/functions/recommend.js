exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 503, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  const { strength = [], oura = null, today } = JSON.parse(event.body || '{}');

  const ALL_MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'quads', 'hamstrings', 'glutes', 'calves', 'forearms'];

  // Compute muscle recovery status
  const lastTrained = {};
  for (const e of strength) {
    for (const m of (e.muscles || [])) {
      if (!lastTrained[m] || e.date > lastTrained[m]) lastTrained[m] = e.date;
    }
  }

  const muscleStatus = {};
  for (const m of ALL_MUSCLES) {
    const last = lastTrained[m];
    if (!last) {
      muscleStatus[m] = 'untrained — suggest beginner weight';
    } else {
      const days = Math.floor((new Date(today) - new Date(last + 'T00:00:00')) / (1000 * 60 * 60 * 24));
      if (days < 2)  muscleStatus[m] = 'recovering — skip today';
      else if (days >= 3) muscleStatus[m] = `focus — ${days}d since last trained`;
      else               muscleStatus[m] = `ready — ${days}d rest`;
    }
  }

  // Recent history for progression logic
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - 60);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const history = strength
    .filter(e => e.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => {
      const reps = [e.rep1, e.rep2, e.rep3].filter(r => r != null).join('/');
      return `  ${e.date}: ${e.exercise} — ${e.sets} sets × ${reps} reps @ ${e.weight || '?'} lbs`;
    });

  const ouraSection = oura ? `
TODAY'S OURA STATS:
  Sleep score:     ${oura.sleep?.score     ?? 'unavailable'}/100
  Readiness score: ${oura.readiness?.score ?? 'unavailable'}/100
  Stress:          ${oura.stress?.day_summary ?? 'unavailable'}
Adjust intensity: if readiness or sleep < 70, keep it lighter. If both >= 85, push harder.` : '';

  const prompt = `You are a personal trainer generating a daily workout recommendation for ${today}.

MUSCLE RECOVERY STATUS:
${Object.entries(muscleStatus).map(([m, s]) => `  ${m}: ${s}`).join('\n')}
${ouraSection}

RECENT WORKOUT HISTORY (last 60 days, newest first):
${history.length ? history.join('\n') : '  No history — suggest beginner-friendly weights for everything'}

RULES:
- Choose 4–5 exercises targeting only "ready", "focus", or "untrained" muscles. Never "recovering".
- Mix 2–3 familiar exercises from history with 1–2 exercises not in the recent history (mark isNew: true).
- Weight progression: if last session hit all reps cleanly → suggest +5 lbs. If reps dropped → hold same weight. New exercise → conservative starting weight.
- Reps as a range string e.g. "8–12" or "3×15".
- Keep notes short (one sentence max).

Respond with ONLY valid JSON, no other text:
{
  "intensity": "light" | "moderate" | "strong",
  "focus": "one sentence describing today's focus",
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": 3,
      "reps": "10–12",
      "weight": "45 lbs",
      "muscles": ["muscle1"],
      "note": "optional short tip",
      "isNew": false
    }
  ]
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { statusCode: 502, body: JSON.stringify({ error: err }) };
    }

    const data = await resp.json();
    const recommendation = JSON.parse(data.content[0].text);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recommendation),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
