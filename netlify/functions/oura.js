const BASE = "https://api.ouraring.com/v2/usercollection";

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

  try {
    const [sleepRes, readinessRes, stressRes] = await Promise.all([
      fetch(`${BASE}/daily_sleep${qs}`, { headers }),
      fetch(`${BASE}/daily_readiness${qs}`, { headers }),
      fetch(`${BASE}/daily_stress${qs}`, { headers }),
    ]);

    const [sleep, readiness, stress] = await Promise.all([
      sleepRes.json(),
      readinessRes.json(),
      stressRes.json(),
    ]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sleep:     sleep.data?.[0]     ?? null,
        readiness: readiness.data?.[0] ?? null,
        stress:    stress.data?.[0]    ?? null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
