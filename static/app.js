let state = { strength: [], running: [], barre: [], yoga: [], cycle: [] };
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

const COLORS = ['#f06292', '#2196f3', '#4caf50', '#9c27b0', '#ff5722', '#00bcd4', '#ff9800', '#607d8b'];

// ── Init ─────────────────────────────────────────────────────────────────────────────────

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

// ── Bubbles ────────────────────────────────────────────────────────────────────────────────

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

  // One bubble per exercise — most recent entry, chart shows full history
  const seen = new Set();
  sorted = sorted.filter(e => {
    if (seen.has(e.exercise)) return false;
    seen.add(e.exercise);
    return true;
  });

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
      <span class="intensity-badge ${calcIntensity(e)}">${calcIntensity(e)}</span>
    </div>
  `).join('');
}

const ALL_MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'quads', 'hamstrings', 'glutes', 'adductors'];

const RECOVERY_DAYS = { light: 1, moderate: 2, intense: 3 };

function calcIntensity(entry) {
  if (entry.timed) return 'moderate';
  const reps = [entry.rep1, entry.rep2, entry.rep3].filter(r => r != null);
  if (!reps.length) return 'moderate';
  const avg = reps.reduce((s, r) => s + r, 0) / reps.length;
  const dropOff = reps[0] > 0 ? (reps[0] - reps[reps.length - 1]) / reps[0] : 0;
  if (dropOff >= 0.4 || avg <= 7) return 'intense';
  if (dropOff < 0.2 && avg >= 12) return 'light';
  return 'moderate';
}

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
    const intensity = calcIntensity(e);
    for (const m of (e.muscles || [])) {
      if (!lastTrained[m] || e.date > lastTrained[m].date) {
        lastTrained[m] = { date: e.date, intensity };
      }
    }
  }
  // Barre + yoga = full body moderate intensity
  for (const b of [...(state.barre || []), ...(state.yoga || [])]) {
    for (const m of ALL_MUSCLES) {
      if (!lastTrained[m] || b.date > lastTrained[m].date) {
        lastTrained[m] = { date: b.date, intensity: 'moderate' };
      }
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
    const days = daysSince(last.date);
    const needed = RECOVERY_DAYS[last.intensity];
    if (days < needed) {
      const dayLabel = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
      recovering.push({ muscle: m, meta: `${dayLabel} · ${last.intensity}` });
    } else if (days === needed) {
      ready.push({ muscle: m, meta: `${days}d ago` });
    } else {
      focus.push({ muscle: m, meta: `${days}d ago` });
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

// ── Strength chart ────────────────────────────────────────────────────────────────────────

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

// ── Running chart ─────────────────────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────

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

// ── Cycle ─────────────────────────────────────────────────────────────────────────────────

const CYCLE_LENGTH = 29;

const PHASES = [
  {
    name: 'Menstrual',
    days: [1, 5],
    bg: '#fce4ec',
    color: '#c2185b',
    emoji: '🌑',
    desc: 'Rest & restore. Your body is working hard internally.',
    advice: 'Gentle movement: yoga, walking, light stretching. Skip heavy lifting.'
  },
  {
    name: 'Follicular',
    days: [6, 11],
    bg: '#e3f2fd',
    color: '#1565c0',
    emoji: '🌒',
    desc: 'Energy is rising. Estrogen is building — you feel stronger.',
    advice: 'Increase weights, try new exercises, push cardio. Great time to build.'
  },
  {
    name: 'Ovulation',
    days: [12, 16],
    bg: '#fff3e0',
    color: '#e65100',
    emoji: '🌕',
    desc: 'Peak energy & strength. Your best performance window.',
    advice: 'Heavy lifts, HIIT, max effort. Your body is primed for it.'
  },
  {
    name: 'Luteal',
    days: [17, 40],
    bg: '#f3e5f5',
    color: '#7b1fa2',
    emoji: '🌖',
    desc: 'Energy gradually decreases. Rest is productive toward the end.',
    advice: 'Barre, pilates, moderate weights. Be kind to yourself.'
  }
];

let calendarMonth = null;

function getPhaseForDay(cycleDay) {
  return PHASES.find(p => cycleDay >= p.days[0] && cycleDay <= p.days[1]) || PHASES[3];
}

function getAllPeriodDates() {
  const fromData = (state.cycle || []).map(c => c.date);
  const fromLocal = JSON.parse(localStorage.getItem('periodLogs') || '[]');
  return [...new Set([...fromData, ...fromLocal])].sort();
}

function getEffectivePeriodDates(throughDateStr) {
  const actual = getAllPeriodDates();
  if (!actual.length) return { all: [], predicted: new Set() };
  const extended = [...actual];
  const predicted = new Set();
  let last = new Date(extended[extended.length - 1] + 'T00:00:00');
  const limit = new Date(throughDateStr + 'T00:00:00');
  for (let i = 0; i < 24; i++) {
    const next = new Date(last);
    next.setDate(next.getDate() + CYCLE_LENGTH);
    if (next > limit) break;
    const s = next.toISOString().slice(0, 10);
    extended.push(s);
    predicted.add(s);
    last = next;
  }
  return { all: extended.sort(), predicted };
}

function getCycleDayForDate(dateStr, periodDates) {
  const past = periodDates.filter(d => d <= dateStr);
  if (!past.length) return null;
  const lastPeriod = new Date(past[past.length - 1] + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  return Math.floor((target - lastPeriod) / (1000 * 60 * 60 * 24)) + 1;
}

function showPage(page) {
  document.getElementById('training-page').classList.toggle('hidden', page !== 'training');
  document.getElementById('cycle-page').classList.toggle('hidden', page !== 'cycle');
  document.querySelectorAll('.page-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  if (page === 'cycle') renderCyclePage();
}

function logPeriod() {
  const today = new Date().toISOString().slice(0, 10);
  const logs = JSON.parse(localStorage.getItem('periodLogs') || '[]');
  if (!logs.includes(today)) {
    logs.push(today);
    localStorage.setItem('periodLogs', JSON.stringify(logs));
  }
  renderCyclePage();
}

function renderCyclePage() {
  const today = new Date().toISOString().slice(0, 10);
  const { all: effectivePeriods } = getEffectivePeriodDates(today);
  const cycleDay = getCycleDayForDate(today, effectivePeriods);
  const phase = cycleDay ? getPhaseForDay(cycleDay) : null;

  const banner = document.getElementById('cycle-phase-banner');
  if (cycleDay && phase) {
    banner.innerHTML = `
      <div class="cycle-day-label">Cycle Day ${cycleDay}</div>
      <div class="cycle-phase-name" style="color:${phase.color}">${phase.emoji} ${phase.name} Phase</div>
      <div class="cycle-phase-desc">${phase.desc}</div>
      <div class="cycle-phase-advice">💪 ${phase.advice}</div>
    `;
    banner.style.cssText = `border-left-color:${phase.color}; background:${phase.bg};`;
  } else {
    banner.innerHTML = `<div class="cycle-day-label">No period data — log your period start to get going.</div>`;
    banner.style.cssText = '';
  }

  const logBtn = document.getElementById('cycle-log-btn');
  const allLogged = [
    ...(state.cycle || []).map(c => c.date),
    ...JSON.parse(localStorage.getItem('periodLogs') || '[]')
  ];
  const alreadyLogged = allLogged.includes(today);
  logBtn.textContent = alreadyLogged ? '✓ Period logged today' : '🩸 Log Period Start Today';
  logBtn.disabled = alreadyLogged;
  logBtn.classList.toggle('logged', alreadyLogged);

  if (!calendarMonth) {
    const now = new Date();
    calendarMonth = { year: now.getFullYear(), month: now.getMonth() };
  }
  renderCalendar();
  renderPhaseLegend();
}

function renderCalendar() {
  const { year, month } = calendarMonth;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  document.getElementById('cal-month-label').textContent =
    new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const { all: effectivePeriods, predicted } = getEffectivePeriodDates(lastDay);
  const actualPeriods = new Set(getAllPeriodDates());

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = dayNames.map(d => `<div class="cal-header">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-cell empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cellDate = new Date(year, month, day);
    const isToday = cellDate.getTime() === todayDate.getTime();
    const isFuture = cellDate > todayDate;
    const isActualPeriod = actualPeriods.has(dateStr);
    const isPredictedPeriod = predicted.has(dateStr) && !isActualPeriod;

    const cycleDay = getCycleDayForDate(dateStr, effectivePeriods);
    const phase = cycleDay ? getPhaseForDay(cycleDay) : null;

    const hadWorkout = !isFuture && (
      (state.strength || []).some(e => e.date === dateStr) ||
      (state.running || []).some(e => e.date === dateStr) ||
      (state.barre || []).some(e => e.date === dateStr) ||
      (state.yoga || []).some(e => e.date === dateStr)
    );

    const classes = ['cal-cell', isToday ? 'today' : '', isFuture ? 'future' : '']
      .filter(Boolean).join(' ');
    const bgStyle = phase ? `background:${phase.bg};` : '';

    html += `
      <div class="${classes}" style="${bgStyle}">
        <span class="cal-day-num">${day}</span>
        ${isActualPeriod ? `<span class="cal-period-marker" title="Period start">●</span>` : ''}
        ${isPredictedPeriod ? `<span class="cal-period-predicted" title="Predicted period">○</span>` : ''}
        ${hadWorkout ? `<span class="cal-workout-dot">·</span>` : ''}
      </div>
    `;
  }

  document.getElementById('cal-grid').innerHTML = html;
}

function renderPhaseLegend() {
  document.getElementById('cycle-legend').innerHTML = PHASES.map(p => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${p.bg}; border:1.5px solid ${p.color};"></span>
      <span class="legend-label" style="color:${p.color}">${p.emoji} ${p.name}</span>
      <span class="legend-days">Days ${p.days[0]}–${p.days[1] > 30 ? '17+' : p.days[1]}</span>
    </div>
  `).join('');
}

function prevCalMonth() {
  if (calendarMonth.month === 0) {
    calendarMonth = { year: calendarMonth.year - 1, month: 11 };
  } else {
    calendarMonth = { ...calendarMonth, month: calendarMonth.month - 1 };
  }
  renderCalendar();
}

function nextCalMonth() {
  if (calendarMonth.month === 11) {
    calendarMonth = { year: calendarMonth.year + 1, month: 0 };
  } else {
    calendarMonth = { ...calendarMonth, month: calendarMonth.month + 1 };
  }
  renderCalendar();
}

// ── Boot ──────────────────────────────────────────────────────────────────────────────────
fetchData();
