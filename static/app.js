let state = { strength: [], running: [] };
let ouraState = null;
let strengthChart = null;
let runningChart = null;
let selectedBubbleId = null;

// ── Daily quote ───────────────────────────────────────────────────────────────

const QUOTES = [
  { text: "We are what we repeatedly do. Excellence is not an act, but a habit.", author: "Aristotle" },
  { text: "He who has a why to live for can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "You are the universe experiencing itself.", author: "Alan Watts" },
  { text: "The unexamined life is not worth living.", author: "Socrates" },
  { text: "Man is nothing else but what he makes of himself.", author: "Jean-Paul Sartre" },
  { text: "One must imagine Sisyphus happy.", author: "Albert Camus" },
  { text: "The privilege of a lifetime is being who you are.", author: "Joseph Campbell" },
  { text: "Between stimulus and response, there is a space. In that space is our power to choose.", author: "Viktor Frankl" },
  { text: "The only way out is through.", author: "Robert Frost" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "The mind is everything. What you think, you become.", author: "Buddha" },
  { text: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi" },
  { text: "Pain is inevitable. Suffering is optional.", author: "Haruki Murakami" },
  { text: "The body achieves what the mind believes.", author: "Napoleon Hill" },
  { text: "The cave you fear to enter holds the treasure you seek.", author: "Joseph Campbell" },
  { text: "The obstacle is the way.", author: "Marcus Aurelius" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { text: "There is no passion to be found playing small.", author: "Nelson Mandela" },
  { text: "What would you do if you weren't afraid?", author: "Sheryl Sandberg" },
  { text: "Your body can stand almost anything. It's your mind you have to convince." },
  { text: "Discipline is choosing between what you want now and what you want most." },
  { text: "Small progress is still progress." },
  { text: "Motivation gets you going. Habit keeps you going." },
  { text: "The expert in anything was once a beginner." },
  { text: "You are allowed to be both a masterpiece and a work in progress, simultaneously." },
  { text: "Show up. Even when it's hard. Especially when it's hard." },
  { text: "Your future self is watching you right now." },
  { text: "The pain you feel today is the strength you feel tomorrow." },
  { text: "Rest if you must, but don't quit." },
  { text: "Amor fati — love of fate." },
  { text: "Every day is a new chance to get stronger." },
  { text: "One rep at a time. One day at a time." },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Done is better than perfect." },
  { text: "Be stubborn about your goals, flexible about your methods." },
  { text: "Trust the process." },
  { text: "The only bad workout is the one that didn't happen." },
  { text: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
  { text: "She believed she could, so she did." }
];

function renderDailyQuote() {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const quote = QUOTES[seed % QUOTES.length];
  const el = document.getElementById('daily-quote');
  el.innerHTML = `"${quote.text}"${quote.author ? `<span class="quote-author">— ${quote.author}</span>` : ''}`;
}

renderDailyQuote();

const COLORS = ['#f06292', '#2196f3', '#4caf50', '#9c27b0', '#ff5722', '#00bcd4', '#ff9800', '#607d8b'];

// ── Init ─────────────────────────────────────────────────────────────────────

async function fetchData() {
  // Cache-bust so fresh deploys show up immediately
  const res = await fetch('./data/workouts.json?t=' + Date.now());
  state = await res.json();
  renderAll();
}

function renderAll() {
  renderStrengthBubbles();
  renderInsights();
  renderRunningTable();
  renderRunningChart();
  renderJournalEntries();
  renderActivityTimeline();
  if (selectedBubbleId) {
    const entry = state.strength.find(e => e.id === selectedBubbleId);
    if (entry) renderStrengthChart(entry.exercise);
    else closeChart();
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-tab`).classList.remove('hidden');
  });
});

// ── Strength bubbles ──────────────────────────────────────────────────────────

function renderStrengthBubbles() {
  const container = document.getElementById('strength-bubbles');
  const sorted = [...state.strength].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    container.innerHTML = '<p class="empty-state">No workouts yet.</p>';
    return;
  }
  container.innerHTML = sorted.map(e => `
    <div class="bubble ${e.id === selectedBubbleId ? 'selected' : ''}"
         onclick="selectBubble('${e.id}', '${e.exercise}')">
      <div class="bubble-exercise">${e.exercise}${e.starred ? ' ⭐' : ''}</div>
      <div class="bubble-date">${fmt(e.date)}</div>
      <div class="bubble-stats">${e.sets} sets${e.weight ? ' · ' + e.weight + ' lbs' : ''}</div>
      <div class="rep-chips">
        ${e.rep1 != null ? `<span class="rep-chip">${e.rep1}</span>` : ''}
        ${e.rep2 != null ? `<span class="rep-chip">${e.rep2}</span>` : ''}
        ${e.rep3 != null ? `<span class="rep-chip">${e.rep3}</span>` : ''}
      </div>
      ${(e.muscles && e.muscles.length) ? `
        <div class="muscle-tags">
          ${e.muscles.map(m => `<span class="muscle-tag ${m}">${m}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

const ALL_MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'quads', 'hamstrings', 'glutes', 'calves', 'forearms'];

function daysSince(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function renderInsights() {
  const panel = document.getElementById('insights');
  if (!state.strength.length) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');

  // Find most recent training date per muscle
  const lastTrained = {};
  for (const e of state.strength) {
    for (const m of (e.muscles || [])) {
      if (!lastTrained[m] || e.date > lastTrained[m]) lastTrained[m] = e.date;
    }
  }

  const recovering = [];
  const ready = [];
  const focus = [];

  for (const m of ALL_MUSCLES) {
    const last = lastTrained[m];
    if (!last) {
      focus.push({ muscle: m, meta: 'untrained' });
      continue;
    }
    const days = daysSince(last);
    if (days < 2) {
      const label = days === 0 ? 'today' : 'yesterday';
      recovering.push({ muscle: m, meta: label });
    } else if (days >= 3) {
      focus.push({ muscle: m, meta: `${days}d ago` });
    } else {
      ready.push({ muscle: m, meta: `${days}d ago` });
    }
  }

  fillInsightsSection('insights-focus', focus);
  fillInsightsSection('insights-recovering', recovering);
  fillInsightsSection('insights-ready', ready);
}

function fillInsightsSection(sectionId, items) {
  const section = document.getElementById(sectionId);
  const pills = section.querySelector('.insights-pills');
  if (!items.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  pills.innerHTML = items.map(({ muscle, meta }) =>
    `<span class="insights-pill muscle-tag ${muscle}">${muscle}<span class="insights-pill-meta">${meta}</span></span>`
  ).join('');
}

function selectBubble(id, exercise) {
  if (selectedBubbleId === id) {
    closeChart();
    return;
  }
  selectedBubbleId = id;
  document.getElementById('chart-panel-title').textContent = exercise + ' — Weight Over Time';
  document.getElementById('strength-chart-panel').classList.remove('hidden');
  renderStrengthChart(exercise);
  renderStrengthBubbles();
}

function closeChart() {
  selectedBubbleId = null;
  document.getElementById('strength-chart-panel').classList.add('hidden');
  if (strengthChart) { strengthChart.destroy(); strengthChart = null; }
  renderStrengthBubbles();
}

// ── Running table ─────────────────────────────────────────────────────────────

function renderRunningTable() {
  const tbody = document.querySelector('#running-table tbody');
  const sorted = [...state.running].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="3">No runs yet.</td></tr>';
    return;
  }
  tbody.innerHTML = sorted.map(e => `
    <tr>
      <td>${fmt(e.date)}</td>
      <td>${e.distance}</td>
      <td>${e.speed}</td>
    </tr>
  `).join('');
}

// ── Strength chart ────────────────────────────────────────────────────────────

function renderStrengthChart(exercise) {
  const canvas = document.getElementById('strength-chart');
  const data = [...state.strength]
    .filter(e => e.exercise === exercise)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (strengthChart) { strengthChart.destroy(); strengthChart = null; }
  if (!data.length) return;

  strengthChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: data.map(e => fmt(e.date)),
      datasets: [{
        label: 'Weight (lbs)',
        data: data.map(e => e.weight),
        borderColor: '#f06292',
        backgroundColor: hexAlpha('#f06292', 0.1),
        fill: true,
        tension: 0.3,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Date', font: { size: 11 } } },
        y: { title: { display: true, text: 'Weight (lbs)', font: { size: 11 } }, beginAtZero: false }
      }
    }
  });
}

// ── Running chart ─────────────────────────────────────────────────────────────

function renderRunningChart() {
  const canvas = document.getElementById('running-chart');
  const empty = document.getElementById('running-empty');

  if (runningChart) { runningChart.destroy(); runningChart = null; }

  if (!state.running.length) {
    canvas.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  canvas.classList.remove('hidden');
  empty.classList.add('hidden');

  // Trailing 7 days, gaps filled with null
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const byDate = {};
  for (const r of state.running) byDate[r.date] = r;

  runningChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: days.map(d => fmt(d)),
      datasets: [{
        label: 'Distance (mi)',
        data: days.map(d => byDate[d]?.distance ?? null),
        backgroundColor: hexAlpha('#f06292', 0.75),
        borderColor: '#f06292',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const date = days[ctx.dataIndex];
              const run = byDate[date];
              return run ? `Speed: ${run.speed} mph` : '';
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Distance (mi)', font: { size: 11 } },
          ticks: { stepSize: 0.5 }
        }
      }
    }
  });
}

// ── Activity timeline ─────────────────────────────────────────────────────────

function renderActivityTimeline() {
  const container = document.getElementById('activity-timeline');
  const items = [];

  for (const e of (state.strength || [])) {
    const reps = [e.rep1, e.rep2, e.rep3].filter(r => r != null).join('/');
    items.push({
      date: e.date,
      icon: '💪',
      label: `${e.exercise}${e.starred ? ' ⭐' : ''}`,
      meta: `${e.sets} sets${e.weight ? ' · ' + e.weight + ' lbs' : ''}${reps ? ' · ' + reps : ''}`
    });
  }
  for (const e of (state.running || [])) {
    items.push({
      date: e.date,
      icon: '🏃‍♀️',
      label: `Run — ${e.distance} mi`,
      meta: `${e.speed} mph`
    });
  }
  for (const e of (state.journal || [])) {
    items.push({
      date: e.date,
      icon: '📝',
      label: 'Journal',
      meta: e.text
    });
  }

  if (!items.length) {
    container.innerHTML = '<p class="empty-state">No activity logged yet.</p>';
    return;
  }

  // Group by date (newest first)
  const byDate = {};
  for (const it of items) (byDate[it.date] ||= []).push(it);
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  container.innerHTML = dates.map(date => `
    <div class="timeline-day">
      <div class="timeline-date">${fmtLong(date)}</div>
      <div class="timeline-items">
        ${byDate[date].map(it => `
          <div class="timeline-item">
            <div class="timeline-icon">${it.icon}</div>
            <div class="timeline-body">
              <div class="timeline-label">${it.label}</div>
              <div class="timeline-meta">${it.meta}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ── Journal ───────────────────────────────────────────────────────────────────

function renderJournalEntries() {
  const container = document.getElementById('journal-entries');
  const sorted = [...(state.journal || [])].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    container.innerHTML = '<p class="empty-state">No journal entries yet.</p>';
    return;
  }
  container.innerHTML = sorted.map(e => `
    <div class="journal-card">
      <div class="journal-body">
        <div class="journal-date">${fmt(e.date)}</div>
        <div class="journal-text">${e.text}</div>
      </div>
    </div>
  `).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function fmtLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Oura status ───────────────────────────────────────────────────────────────

async function fetchOuraStatus() {
  try {
    const res = await fetch('/.netlify/functions/oura');
    if (!res.ok) return;
    const data = await res.json();
    ouraState = data;
    renderOuraStatus(data.sleep, data.readiness);
  } catch {
    // Oura not configured — bar stays hidden
  }
}

function scoreClass(n) {
  if (n >= 85) return 'good';
  if (n >= 70) return 'ok';
  return 'poor';
}

function renderOuraStatus(sleep, readiness) {
  let hasData = false;

  if (sleep?.score != null) {
    const el = document.getElementById('oura-sleep');
    el.textContent = sleep.score;
    el.className = `oura-score ${scoreClass(sleep.score)}`;
    hasData = true;
  }

  if (readiness?.score != null) {
    const el = document.getElementById('oura-readiness');
    el.textContent = readiness.score;
    el.className = `oura-score ${scoreClass(readiness.score)}`;
    hasData = true;
  }

  if (hasData) document.getElementById('oura-bar').classList.remove('hidden');
}

// ── Workout recommendation ────────────────────────────────────────────────────

const REC_TRIGGER_HOUR = 8;     // 8 AM
const REC_TRIGGER_MINUTE = 30;  // :30
const REC_TRIGGER_TZ = 'America/New_York';  // anchor to EST regardless of user's local time

function todayKey() {
  // Use EST date so the cache rolls over at midnight EST, not UTC
  const nyDate = new Date().toLocaleDateString('en-CA', { timeZone: REC_TRIGGER_TZ });
  return 'rec-' + nyDate;
}

function minutesUntilTrigger() {
  // Extract current hour/minute as observed in New York timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REC_TRIGGER_TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const triggerMins = REC_TRIGGER_HOUR * 60 + REC_TRIGGER_MINUTE;
  const nowMins = h * 60 + m;
  return triggerMins - nowMins;
}

async function initRecommendation() {
  const cached = localStorage.getItem(todayKey());
  if (cached) {
    renderRecommendation(JSON.parse(cached));
    return;
  }
  const minsLeft = minutesUntilTrigger();
  if (minsLeft > 0) {
    showRecCountdown(minsLeft);
  } else {
    await generateRecommendation();
  }
}

function showRecCountdown(initialMins) {
  const el = document.getElementById('rec-countdown');
  el.classList.remove('hidden');

  let mins = initialMins;
  function tick() {
    if (mins <= 0) {
      el.classList.add('hidden');
      generateRecommendation();
      return;
    }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    el.textContent = h > 0
      ? `Generates in ${h}h ${m}m at 8:30 AM EST`
      : `Generates in ${m} minute${m !== 1 ? 's' : ''} at 8:30 AM EST`;
    mins--;
  }
  tick();
  setInterval(tick, 60000);
}

async function generateRecommendation() {
  const loadEl = document.getElementById('rec-loading');
  loadEl.classList.remove('hidden');

  try {
    const resp = await fetch('/.netlify/functions/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strength: state.strength,
        oura: ouraState,
        today: new Date().toISOString().slice(0, 10),
      }),
    });

    loadEl.classList.add('hidden');

    if (!resp.ok) throw new Error('Function error');
    const rec = await resp.json();
    localStorage.setItem(todayKey(), JSON.stringify(rec));
    renderRecommendation(rec);
  } catch {
    loadEl.classList.add('hidden');
    const errEl = document.getElementById('rec-error');
    errEl.textContent = 'Could not generate recommendation — check that ANTHROPIC_API_KEY is set in Netlify.';
    errEl.classList.remove('hidden');
  }
}

function renderRecommendation(rec) {
  const badge = document.getElementById('rec-badge');
  badge.textContent = rec.intensity.charAt(0).toUpperCase() + rec.intensity.slice(1);
  badge.className = `rec-badge ${rec.intensity}`;
  badge.classList.remove('hidden');

  document.getElementById('rec-focus').textContent = rec.focus;

  document.getElementById('rec-exercises').innerHTML = `
    <div class="rec-exercise-list">
      ${rec.exercises.map(ex => `
        <div class="rec-exercise">
          <div class="rec-ex-top">
            <span class="rec-ex-name">${ex.name}</span>
            ${ex.isNew ? '<span class="rec-new-badge">New</span>' : ''}
          </div>
          <div class="rec-ex-meta">
            ${ex.sets} sets × ${ex.reps}
            <span class="rec-ex-weight">@ ${ex.weight}</span>
            ${(ex.muscles || []).map(m => `<span class="muscle-tag ${m}">${m}</span>`).join('')}
          </div>
          ${ex.note ? `<div class="rec-ex-note">${ex.note}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('rec-body').classList.remove('hidden');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
Promise.all([fetchData(), fetchOuraStatus()]).then(() => initRecommendation());
