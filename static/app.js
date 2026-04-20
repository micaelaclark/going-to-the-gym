let state = { strength: [], running: [] };
let strengthChart = null;
let runningChart = null;
let selectedBubbleId = null;

const COLORS = ['#f06292', '#2196f3', '#4caf50', '#9c27b0', '#ff5722', '#00bcd4', '#ff9800', '#607d8b'];

// ── Init ─────────────────────────────────────────────────────────────────────

async function fetchData() {
  const res = await fetch('/api/workouts');
  state = await res.json();
  renderAll();
}

function renderAll() {
  renderStrengthBubbles();
  renderRunningTable();
  renderRunningChart();
  renderJournalEntries();
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

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteEntry(type, id) {
  await fetch(`/api/workouts/${type}/${id}`, { method: 'DELETE' });
  await fetchData();
}

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
      <div class="bubble-exercise">${e.exercise}</div>
      <div class="bubble-date">${fmt(e.date)}</div>
      <div class="bubble-stats">${e.sets} sets · ${e.weight} lbs</div>
      <div class="rep-chips">
        ${e.rep1 != null ? `<span class="rep-chip">${e.rep1}</span>` : ''}
        ${e.rep2 != null ? `<span class="rep-chip">${e.rep2}</span>` : ''}
        ${e.rep3 != null ? `<span class="rep-chip">${e.rep3}</span>` : ''}
      </div>
    </div>
  `).join('');
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
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No runs yet — log your first run above.</td></tr>';
    return;
  }
  tbody.innerHTML = sorted.map(e => `
    <tr>
      <td>${fmt(e.date)}</td>
      <td>${e.distance}</td>
      <td>${e.speed}</td>
      <td><button class="delete-btn" onclick="deleteEntry('running','${e.id}')" title="Delete">✕</button></td>
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
  const sorted = [...state.running].sort((a, b) => a.date.localeCompare(b.date));

  if (runningChart) { runningChart.destroy(); runningChart = null; }

  if (!sorted.length) {
    canvas.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  canvas.classList.remove('hidden');
  empty.classList.add('hidden');

  const labels = sorted.map(e => fmt(e.date));

  runningChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Distance (mi)',
          data: sorted.map(e => e.distance),
          backgroundColor: hexAlpha('#f06292', 0.75),
          borderColor: '#f06292',
          borderWidth: 1,
          yAxisID: 'yDist'
        },
        {
          label: 'Speed (mph)',
          data: sorted.map(e => e.speed),
          type: 'line',
          borderColor: '#2196f3',
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7,
          yAxisID: 'ySpeed'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } } },
      scales: {
        x: { title: { display: true, text: 'Date', font: { size: 11 } } },
        yDist: {
          title: { display: true, text: 'Distance (mi)', font: { size: 11 } },
          beginAtZero: true
        },
        ySpeed: {
          title: { display: true, text: 'Speed (mph)', font: { size: 11 } },
          position: 'right',
          beginAtZero: false,
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
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
      <button class="delete-btn" onclick="deleteEntry('journal','${e.id}')" title="Delete">✕</button>
    </div>
  `).join('');
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
