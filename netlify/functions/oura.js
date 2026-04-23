const BASE = "https://api.ouraring.com/v2/usercollection";

async function safeFetch(url, headers) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0] ?? null;
  } catch {
    return null;
  }
}

exports.handler = async () => {
  const token = process.env.OURA_PERSONAL_TOKEN;
  if (!token) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: "OURA_PERSONAL_TOKEN not configured" }),
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const qs = `?start_date=${today}&end_date=${today}`;
  const headers = { Authorization: `Bearer ${token}` };

  const [sleep, readiness, stress] = await Promise.all([
    safeFetch(`${BASE}/daily_sleep${qs}`, { headers }),
    safeFetch(`${BASE}/daily_readiness${qs}`, { headers }),
    safeFetch(`${BASE}/daily_stress${qs}`, { headers }),
  ]);

  if (!sleep && !readiness && !stress) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "No data returned from Oura" }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sleep, readiness, stress }),
  };
};
