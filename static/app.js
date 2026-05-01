let state = { strength: [], running: [], barre: [], yoga: [] };
let strengthChart = null;
let selectedBubbleId = null;
let runningSelected = false;
let bodyFilter = 'all';
let runningDays = 'all';
let runningMetric = 'both';

const UPPER_MUSCLES = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']);
const LOWER_MUSCLES = new Set(['quads', 'hamstrings', 'glutes', 'adductors', 'core']);

function setBodyFilter(filter) {
  bodyFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderStrengthBubbles();
}

function setRunningDays(days) {
  runningDays = days;
  document.querySelectorAll('[data-days]').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.days) === String(days));
  });
  renderRunningChart();
}

function setRunningMetric(metric) {
  runningMetric = metric;
  document.querySelectorAll('[data-metric]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.metric === metric);
  });
  renderRunningChart();
}

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
  const res = await fetch('./data/workouts.json?t=' + Date.now());
  state = await res.json();
  renderAll();
}

function renderAll() {
  renderStrengthBubbles();
  renderInsights();
  if (selectedBubbleId) {
    const entry = state.strength.find(e => e.id === selectedBubbleId);
    if (entry) renderStrengthChart(entry.exercise);
    else closeChart();
  }
}

// ── Bubbles ───────────────────────────────────────────────────────────────────

function fmtTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderStrengthBubbles() {
  const container = document.getElementById('strength-bubbles');
  const searchQ = (document.getElementById('exercise-search')?.value || '').trim().toLowerCase();

  let sorted = [...state.strength].sort((a, b) => b.date.localeCompare(a.date));

  if (searchQ) {
    sorted = sorted.filter(e => e.exercise.toLowerCase().includes(searchQ));
  }

  if (bodyFilter === 'upper') {
    sorted = sorted.filter(e => (e.muscles || []).some(m => UPPER_MUSCLES.has(m)));
  } else if (bodyFilter === 'lower') {
    sorted = sorted.filter(e => (e.muscles || []).some(m => LOWER_MUSCLES.has(m)));
  }

  const barreCount = (state.barre || []).length;
  const barreBubble = `
    <div class="bubble barre-bubble">
      <div class="bubble-exercise">Barre Class</div>
      <div class="barre-tally">${barreCount}</div>
      <div class="bubble-stats">classes total</div>
    </div>`;

  const yogaCount = (state.yoga || []).length;
  const yogaBubble = `
    <div class="bubble yoga-bubble">
      <div class="bubble-exercise">Yoga</div>
      <div class="yoga-tally">${yogaCount}</div>
      <div class="bubble-stats">sessions total</div>
    </div>`;

  const totalMiles = (state.running || []).reduce((sum, r) => sum + r.distance, 0);
  const runBubble = `
    <div class="bubble running-bubble ${runningSelected ? 'selected' : ''}"
         onclick="selectRunningBubble()">
      <div class="bubble-exercise">Total Miles</div>
      <div class="barre-tally">${totalMiles % 1 === 0 ? totalMiles : totalMiles.toFixed(1)}</div>
      <div class="bubble-stats">miles run</div>
    </div>`;

  if (!sorted.length) {
    container.innerHTML = barreBubble + yogaBubble + runBubble;
    return;
  }
  container.innerHTML = barreBubble + yogaBubble + runBubble + sorted.map(e => `
    <div class="bubble ${e.id === selectedBubbleId ? 'selected' : ''}"
         onclick="selectBubble('${e.id}', '${e.exercise}')">
      <div class="bubble-exercise">${e.exercise}${e.starred ? ' ⭐' : ''}</div>
      <div class="bubble-date">${fmt(e.date)}</div>
      <div class="bubble-stats">${e.timed ? `${e.sets} hold` : `${e.sets} sets${e.weight ? ' · ' + e.weight + ' lbs' : ''}`}</div>
      <div class="rep-chips">
        ${e.timed
          ? (e.rep1 != null ? `<span class="rep-chip">${fmtTime(e.rep1)}</span>` : '')
          : `${e.rep1 != null ? `<span class="rep-chip">${e.rep1}</span>` : ''}
             ${e.rep2 != null ? `<span class="rep-chip">${e.rep2}</span>` : ''}
             ${e.rep3 != null ? `<span class="rep-chip">${e.rep3}</span>` : ''}`
        }
      </div>
      ${(e.muscles && e.muscles.length) ? `
        <div class="muscle-tags">
          ${e.muscles.map(m => `<span class="muscle-tag ${m}">${m}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

const ALL_MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'quads', 'hamstrings', 'glutes', 'adductors'];

function daysSince(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function renderInsights() {
  const panel = document.getElementById('insights');
  if (!state.strength.length && !(state.barre || []).length) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');

  const lastTrained = {};
  for (const e of state.strength) {
    for (const m of (e.muscles || [])) {
      if (!lastTrained[m] || e.date > lastTrained[m]) lastTrained[m] = e.date;
    }
  }
  // Barre + yoga = full body, counts for all muscles
  for (const b of [...(state.barre || []), ...(state.yoga || [])]) {
    for (const m of ALL_MUSCLES) {
      if (!lastTrained[m] || b.date > lastTrained[m]) lastTrained[m] = b.date;
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
  runningSelected = false;
  selectedBubbleId = id;
  document.getElementById('running-chart-controls').classList.add('hidden');
  document.getElementById('chart-panel-title').textContent = exercise + ' — Progress Over Time';
  document.getElementById('strength-chart-panel').classList.remove('hidden');
  renderStrengthChart(exercise);
  renderStrengthBubbles();
}

function selectRunningBubble() {
  if (runningSelected) {
    closeChart();
    return;
  }
  selectedBubbleId = null;
  runningSelected = true;
  document.getElementById('running-chart-controls').classList.remove('hidden');
  document.getElementById('chart-panel-title').textContent = 'Running — Performance Over Time';
  document.getElementById('strength-chart-panel').classList.remove('hidden');
  renderRunningChart();
  renderStrengthBubbles();
}

function closeChart() {
  selectedBubbleId = null;
  runningSelected = false;
  document.getElementById('running-chart-controls').classList.add('hidden');
  document.getElementById('strength-chart-panel').classList.add('hidden');
  if (strengthChart) { strengthChart.destroy(); strengthChart = null; }
  renderStrengthBubbles();
}

// ── Strength chart ────────────────────────────────────────────────────────────

function renderStrengthChart(exercise) {
  const canvas = document.getElementById('strength-chart');
  const data = [...state.strength]
    .filter(e => e.exercise === exercise)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (strengthChart) { strengthChart.destroy(); strengthChart = null; }
  if (!data.length) return;

  const isTimed = data[0]?.timed;

  const repsData = data.map(e => {
    if (isTimed) return e.rep1 ?? null;
    return (e.rep1 ?? 0) + (e.rep2 ?? 0) + (e.rep3 ?? 0);
  });
  const repsLabel = isTimed ? 'Hold Time (s)' : 'Total Reps';

  strengthChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: data.map(e => fmt(e.date)),
      datasets: [
        {
          label: 'Weight (lbs)',
          data: data.map(e => e.weight),
          borderColor: '#f06292',
          backgroundColor: hexAlpha('#f06292', 0.1),
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8,
          yAxisID: 'y'
        },
        {
          label: repsLabel,
          data: repsData,
          borderColor: '#2196f3',
          backgroundColor: hexAlpha('#2196f3', 0.08),
          fill: false,
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8,
          borderDash: [5, 3],
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { boxWidth: 14, font: { size: 11 } }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Date', font: { size: 11 } } },
        y: {
          title: { display: true, text: 'Weight (lbs)', font: { size: 11 } },
          beginAtZero: false,
          position: 'left'
        },
        y1: {
          title: { display: true, text: repsLabel, font: { size: 11 } },
          beginAtZero: true,
          position: 'right',
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// ── Running chart ─────────────────────────────────────────────────────────────

function renderRunningChart() {
  const canvas = document.getElementById('strength-chart');
  if (strengthChart) { strengthChart.destroy(); strengthChart = null; }

  let data = [...state.running].sort((a, b) => a.date.localeCompare(b.date));

  if (runningDays !== 'all') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(runningDays));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    data = data.filter(r => r.date >= cutoffStr);
  }

  if (!data.length) return;

  const labels = data.map(r => fmt(r.date));
  const showDist = runningMetric === 'distance' || runningMetric === 'both';
  const showSpeed = runningMetric === 'speed' || runningMetric === 'both';
  const dual = runningMetric === 'both';

  const datasets = [];
  if (showDist) {
    datasets.push({
      type: 'bar',
      label: 'Distance (mi)',
      data: data.map(r => r.distance),
      backgroundColor: hexAlpha('#f06292', 0.75),
      borderColor: '#f06292',
      borderWidth: 1,
      borderRadius: 4,
      yAxisID: 'y',
    });
  }
  if (showSpeed) {
    datasets.push({
      type: 'line',
      label: 'Speed (mph)',
      data: data.map(r => r.speed),
      borderColor: '#2196f3',
      backgroundColor: hexAlpha('#2196f3', 0.08),
      fill: false,
      tension: 0.3,
      pointRadius: 6,
      pointHoverRadius: 8,
      borderDash: dual ? [5, 3] : [],
      yAxisID: dual ? 'y1' : 'y',
    });
  }

  const scales = { x: { grid: { display: false } } };
  if (showDist) {
    scales.y = {
      beginAtZero: true,
      position: 'left',
      title: { display: true, text: 'Distance (mi)', font: { size: 11 } },
      ticks: { stepSize: 0.5 },
    };
  }
  if (showSpeed) {
    scales[dual ? 'y1' : 'y'] = {
      beginAtZero: false,
      position: dual ? 'right' : 'left',
      title: { display: true, text: 'Speed (mph)', font: { size: 11 } },
      grid: { drawOnChartArea: !showDist },
    };
  }

  strengthChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: dual, labels: { boxWidth: 14, font: { size: 11 } } },
      },
      scales,
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────
fetchData();
