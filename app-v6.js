'use strict';

const VERSION = '2.4';
const STORAGE_KEY = 'sam-phenologie-v2.4';
const WEATHER_CACHE_KEY = 'sam-phenologie-weather-v2.4';
const STATION = { name: 'Marsillargues', latitude: 43.6343, longitude: 4.1706, altitude: 2 };
const DEFAULT_BASE_TEMP = 5;
const FALLBACK_START = '-03-01';

const STAGES = [
  { id: 'C', label: 'C — éclatement des bourgeons', bbch: 'BBCH 53', gdd: 0 },
  { id: 'C3', label: 'C3 — oreille de souris', bbch: 'BBCH 54', gdd: 30 },
  { id: 'D', label: 'D — bouton vert', bbch: 'BBCH 56', gdd: 70 },
  { id: 'E', label: 'E — bouton rose', bbch: 'BBCH 57', gdd: 110 },
  { id: 'E2', label: 'E2 — ballonnets', bbch: 'BBCH 59', gdd: 145 },
  { id: 'F', label: 'F — début floraison', bbch: 'BBCH 61', gdd: 185 },
  { id: 'F2', label: 'F2 — pleine floraison', bbch: 'BBCH 65', gdd: 225 },
  { id: 'G', label: 'G — floraison déclinante', bbch: 'BBCH 67', gdd: 265 },
  { id: 'H', label: 'H — fin floraison', bbch: 'BBCH 69', gdd: 305 },
  { id: 'I', label: 'I — nouaison', bbch: 'BBCH 71', gdd: 355 },
  { id: 'J', label: 'J — taille noisette', bbch: 'BBCH 72', gdd: 425 }
];
const LAST_STAGE = STAGES[STAGES.length - 1];
const VARIETIES = [
  { id: 'gala', label: 'Gala' },
  { id: 'golden', label: 'Golden Delicious' },
  { id: 'pinklady', label: 'Cripps Pink / Pink Lady' },
  { id: 'joya', label: 'Joya' },
  { id: 'reine', label: 'Reine des reinettes' },
  { id: 'granny', label: 'Granny Smith' },
  { id: 'ariane', label: 'Ariane' },
  { id: 'dalinette', label: 'Dalinette' },
  { id: 'opale', label: 'Opale' },
  { id: 'other', label: 'Autre variété' }
];

const els = {};
let state = loadState();
let activeWeather = null;
let latestAnalysis = null;
let deferredPrompt = null;

window.addEventListener('DOMContentLoaded', init);

function init() {
  bindElements();
  populateVarieties();
  populateStages();
  bindEvents();
  renderParcelSelect();
  loadParcelIntoForm();
  registerServiceWorker();
  loadCachedWeather();
  if (state.parcels.length) refreshWeather(false);
}

function bindElements() {
  [
    'parcelSelect','activeExploit','activeParcelName','activeVariety','activeStart',
    'dashboardTabBtn','historyTabBtn','dashboardView','historyView',
    'exploitation','parcelName','variety','stageCDate','baseTemp','weatherLastUpdate',
    'saveParcelBtn','newParcelBtn','deleteParcelBtn',
    'stageMain','stageBbch','gddTotal','nextStage','nextDate','calibrationNotice',
    'alertsSection','alertsList','observationDate','observationStage','addObservationBtn','observationsList',
    'refreshBtn','weatherStatus','forecastTableWrap','forecastBody',
    'stageHistoryStatus','stageHistoryWrap','stageHistoryBody',
    'chartCurrentGdd','chartNextThreshold','chartForecastEnd','gddChartStatus','gddChart',
    'installBtn','toast', 'importStagesBtn','importStagesBtnTop','importStagesInput'
  ].forEach(id => els[id] = document.getElementById(id));
}

function bindEvents() {
  els.parcelSelect.addEventListener('change', () => {
    state.activeParcelId = els.parcelSelect.value;
    persistState();
    loadParcelIntoForm();
    refreshWeather(false);
  });
  els.saveParcelBtn.addEventListener('click', saveParcelFromForm);
  els.newParcelBtn.addEventListener('click', newParcel);
  els.deleteParcelBtn.addEventListener('click', deleteParcel);
  els.addObservationBtn.addEventListener('click', addObservation);
  els.refreshBtn.addEventListener('click', () => refreshWeather(true));
  els.dashboardTabBtn.addEventListener('click', () => switchTab('dashboard'));
  els.historyTabBtn.addEventListener('click', () => switchTab('history'));
  [...document.querySelectorAll('.info-btn')].forEach(btn => btn.addEventListener('click', () => toggleInfo(btn.dataset.info)));
  els.importStagesBtn.addEventListener('click', () => els.importStagesInput.click());
  els.importStagesBtnTop.addEventListener('click', () => els.importStagesInput.click());
  els.importStagesInput.addEventListener('change', handleImportFile);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.classList.add('hidden');
  });
  window.addEventListener('resize', () => drawChart());
}

function toggleInfo(id) {
  const box = document.getElementById(id);
  if (box) box.classList.toggle('hidden');
}

function populateVarieties() {
  els.variety.innerHTML = VARIETIES.map(v => `<option value="${v.id}">${v.label}</option>`).join('');
}

function populateStages() {
  els.observationStage.innerHTML = STAGES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
}

function createDefaultParcel() {
  return {
    id: uid(),
    exploitation: 'SudExpé Marsillargues',
    name: 'Parcelle 1',
    variety: 'gala',
    stageCDate: '',
    baseTemp: DEFAULT_BASE_TEMP,
    observations: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const p = createDefaultParcel();
      return { parcels: [p], activeParcelId: p.id };
    }
    const parsed = JSON.parse(raw);
    parsed.parcels = Array.isArray(parsed.parcels) && parsed.parcels.length ? parsed.parcels : [createDefaultParcel()];
    if (!parsed.activeParcelId || !parsed.parcels.some(p => p.id === parsed.activeParcelId)) parsed.activeParcelId = parsed.parcels[0].id;
    parsed.parcels.forEach(p => {
      p.observations = Array.isArray(p.observations) ? p.observations : [];
      if (typeof p.baseTemp !== 'number') p.baseTemp = DEFAULT_BASE_TEMP;
      if (!p.exploitation) p.exploitation = '';
      if (!p.name) p.name = 'Parcelle';
      if (!p.variety) p.variety = 'other';
      if (!('stageCDate' in p)) p.stageCDate = '';
    });
    return parsed;
  } catch (e) {
    console.error(e);
    const p = createDefaultParcel();
    return { parcels: [p], activeParcelId: p.id };
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeParcel() {
  return state.parcels.find(p => p.id === state.activeParcelId) || state.parcels[0];
}

function renderParcelSelect() {
  els.parcelSelect.innerHTML = state.parcels.map(p => `<option value="${p.id}">${escapeHtml(p.exploitation || '—')} · ${escapeHtml(p.name)}</option>`).join('');
  els.parcelSelect.value = state.activeParcelId;
}

function loadParcelIntoForm() {
  const p = activeParcel();
  if (!p) return;
  els.exploitation.value = p.exploitation || '';
  els.parcelName.value = p.name || '';
  els.variety.value = p.variety || 'other';
  els.stageCDate.value = p.stageCDate || '';
  els.baseTemp.value = p.baseTemp ?? DEFAULT_BASE_TEMP;
  updateActiveSummary();
  renderObservations();
  renderPhenology();
}

function updateActiveSummary() {
  const p = activeParcel();
  const variety = VARIETIES.find(v => v.id === p.variety)?.label || '—';
  els.activeExploit.textContent = p.exploitation || '—';
  els.activeParcelName.textContent = p.name || '—';
  els.activeVariety.textContent = variety;
  els.activeStart.textContent = p.stageCDate ? `Stade C observé le ${formatDate(p.stageCDate)}` : 'Stade C non renseigné';
}

function saveParcelFromForm() {
  const p = activeParcel();
  p.exploitation = els.exploitation.value.trim();
  p.name = els.parcelName.value.trim() || 'Parcelle';
  p.variety = els.variety.value;
  p.stageCDate = els.stageCDate.value;
  p.baseTemp = clampNumber(parseFloat(els.baseTemp.value), 0, 15, DEFAULT_BASE_TEMP);
  persistState();
  renderParcelSelect();
  loadParcelIntoForm();
  refreshWeather(true);
  toast('Parcelle enregistrée.');
}

function newParcel() {
  const p = createDefaultParcel();
  state.parcels.push(p);
  state.activeParcelId = p.id;
  persistState();
  renderParcelSelect();
  loadParcelIntoForm();
  toast('Nouvelle parcelle créée.');
}

function deleteParcel() {
  if (state.parcels.length === 1) return toast('Impossible de supprimer la dernière parcelle.');
  const id = state.activeParcelId;
  state.parcels = state.parcels.filter(p => p.id !== id);
  state.activeParcelId = state.parcels[0].id;
  persistState();
  renderParcelSelect();
  loadParcelIntoForm();
  refreshWeather(false);
  toast('Parcelle supprimée.');
}

function addObservation() {
  const p = activeParcel();
  const date = els.observationDate.value;
  const stage = els.observationStage.value;
  if (!date) return toast('Choisissez une date.');
  p.observations = p.observations.filter(o => o.date !== date);
  p.observations.push({ date, stage });
  p.observations.sort((a, b) => a.date.localeCompare(b.date));
  if (stage === 'C') p.stageCDate = date;
  persistState();
  loadParcelIntoForm();
  toast('Observation ajoutée.');
}

function removeObservation(date) {
  const p = activeParcel();
  p.observations = p.observations.filter(o => o.date !== date);
  persistState();
  renderObservations();
  renderPhenology();
}

function renderObservations() {
  const p = activeParcel();
  const obs = [...(p.observations || [])].sort((a, b) => b.date.localeCompare(a.date));
  els.observationsList.innerHTML = obs.length ? obs.map(o => {
    const s = stageById(o.stage);
    return `<div class="observation-row"><span>${formatDate(o.date)}</span><strong>${s ? s.label : escapeHtml(o.stage)}</strong><button type="button" data-date="${o.date}" aria-label="Supprimer">✕</button></div>`;
  }).join('') : '<p class="hint">Aucune observation enregistrée.</p>';
  els.observationsList.querySelectorAll('button[data-date]').forEach(btn => btn.addEventListener('click', () => removeObservation(btn.dataset.date)));
}

async function refreshWeather(force) {
  const p = activeParcel();
  if (!p) return;
  if (!navigator.onLine && activeWeather) {
    els.weatherStatus.textContent = 'Hors connexion : dernières données enregistrées.';
    renderPhenology();
    return;
  }
  if (!navigator.onLine) {
    els.weatherStatus.textContent = 'Hors connexion et aucune donnée météo enregistrée.';
    return;
  }

  const currentYear = new Date().getFullYear();
  const start = p.stageCDate || `${currentYear}${FALLBACK_START}`;
  const historyEnd = isoDate(addDays(new Date(), -1));
  const today = isoDate(new Date());
  els.weatherStatus.textContent = 'Chargement des données Open-Meteo…';
  els.forecastTableWrap.classList.add('hidden');

  const params = `latitude=${STATION.latitude}&longitude=${STATION.longitude}&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis`;
  const histUrl = `https://archive-api.open-meteo.com/v1/archive?${params}&start_date=${start}&end_date=${historyEnd}`;
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?${params}&forecast_days=16`;

  try {
    const [histRes, forecastRes] = await Promise.all([
      start <= historyEnd ? fetch(histUrl) : Promise.resolve(null),
      fetch(forecastUrl)
    ]);
    if (histRes && !histRes.ok) throw new Error('Historique indisponible');
    if (!forecastRes.ok) throw new Error('Prévisions indisponibles');
    const history = histRes ? await histRes.json() : { daily: { time: [], temperature_2m_min: [], temperature_2m_max: [] } };
    const forecast = await forecastRes.json();
    activeWeather = mergeWeather(history.daily, forecast.daily, today);
    saveWeatherCache(activeWeather);
    const stamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    localStorage.setItem(`${WEATHER_CACHE_KEY}-updated`, stamp);
    els.weatherStatus.textContent = `Données actualisées le ${stamp}.`;
    els.weatherLastUpdate.value = stamp;
    renderPhenology();
  } catch (error) {
    console.error(error);
    loadCachedWeather();
    els.weatherStatus.textContent = activeWeather ? 'Open-Meteo indisponible : affichage des dernières données enregistrées.' : 'Impossible de charger les données météo.';
    renderPhenology();
  }
}

function mergeWeather(history, forecast, today) {
  const map = new Map();
  const add = (daily, type) => {
    (daily.time || []).forEach((date, i) => {
      const item = {
        date,
        min: daily.temperature_2m_min?.[i],
        max: daily.temperature_2m_max?.[i],
        type: date < today ? 'history' : 'forecast'
      };
      map.set(date, item);
    });
  };
  add(history, 'history');
  add(forecast, 'forecast');
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function renderPhenology() {
  const p = activeParcel();
  updateActiveSummary();
  els.weatherLastUpdate.value = localStorage.getItem(`${WEATHER_CACHE_KEY}-updated`) || 'Aucune donnée chargée';

  if (!p) return;
  if (!activeWeather || !activeWeather.length) {
    latestAnalysis = null;
    resetDashboard('Chargement météo nécessaire');
    renderStageHistory(null);
    drawChart();
    return;
  }

  const analysis = analyzeParcel(p, activeWeather);
  latestAnalysis = analysis;

  const currentEntry = analysis.currentEntry;
  const currentStage = currentEntry ? stageForGdd(currentEntry.cumulative) : STAGES[0];
  els.stageMain.textContent = currentStage ? currentStage.label : '—';
  els.stageBbch.textContent = currentStage ? currentStage.bbch : '—';
  els.gddTotal.textContent = currentEntry ? `${round1(currentEntry.cumulative)} DJ` : '—';
  els.nextStage.textContent = analysis.nextStage ? analysis.nextStage.label : 'Cycle terminé';
  els.nextDate.textContent = analysis.nextStageDate ? formatDate(analysis.nextStageDate) : (analysis.finalReachedDate ? 'Atteint' : 'Au-delà de la période prévisionnelle');
  els.calibrationNotice.classList.toggle('hidden', !analysis.notice);
  els.calibrationNotice.textContent = analysis.notice || '';

  renderAlerts(analysis);
  renderForecast(analysis);
  renderStageHistory(analysis);
  drawChart();
}

function resetDashboard(bbchText) {
  els.stageMain.textContent = '—';
  els.stageBbch.textContent = bbchText || '—';
  els.gddTotal.textContent = '—';
  els.nextStage.textContent = '—';
  els.nextDate.textContent = '—';
  els.calibrationNotice.classList.add('hidden');
  els.alertsSection.classList.add('hidden');
  els.forecastTableWrap.classList.add('hidden');
  els.forecastBody.innerHTML = '';
  els.stageHistoryWrap.classList.add('hidden');
  els.stageHistoryStatus.textContent = 'Aucune donnée chargée.';
  els.chartCurrentGdd.textContent = '—';
  els.chartNextThreshold.textContent = '—';
  els.chartForecastEnd.textContent = '—';
  els.gddChartStatus.textContent = 'Aucune donnée chargée.';
}

function analyzeParcel(parcel, weather) {
  const start = parcel.stageCDate || `${new Date().getFullYear()}${FALLBACK_START}`;
  const baseTemp = clampNumber(Number(parcel.baseTemp), 0, 15, DEFAULT_BASE_TEMP);
  const filtered = weather.filter(w => w.date >= start);
  let cumulativeRaw = 0;
  const rawTimeline = filtered.map(day => {
    const gdd = computeGdd(day.min, day.max, baseTemp);
    cumulativeRaw += gdd;
    return { ...day, gdd, rawCumulative: cumulativeRaw };
  });

  const observations = [...(parcel.observations || [])]
    .filter(o => stageById(o.stage))
    .sort((a, b) => a.date.localeCompare(b.date));
  const effectiveStartObs = observations.find(o => o.stage === 'C') || null;
  const latestObs = observations.filter(o => rawTimeline.some(d => d.date === o.date)).slice(-1)[0] || null;

  let offset = 0;
  if (latestObs) {
    const stage = stageById(latestObs.stage);
    const rawAtObs = rawTimeline.find(d => d.date === latestObs.date)?.rawCumulative ?? 0;
    offset = stage.gdd - rawAtObs;
  }

  const timeline = rawTimeline.map(day => ({
    ...day,
    cumulative: Math.max(0, day.rawCumulative + offset)
  }));

  const observedFinalDate = observations.find(o => o.stage === LAST_STAGE.id)?.date || null;
  const estimatedFinalDate = timeline.find(d => d.cumulative >= LAST_STAGE.gdd)?.date || null;
  const finalReachedDate = [observedFinalDate, estimatedFinalDate].filter(Boolean).sort()[0] || null;
  const truncatedTimeline = finalReachedDate ? timeline.filter(d => d.date <= finalReachedDate) : timeline;

  const stageDates = {};
  STAGES.forEach(stage => {
    const observed = observations.find(o => o.stage === stage.id);
    if (observed) {
      stageDates[stage.id] = { date: observed.date, origin: 'Observée' };
      return;
    }
    const reached = truncatedTimeline.find(d => d.cumulative >= stage.gdd);
    if (reached) {
      stageDates[stage.id] = { date: reached.date, origin: 'Estimée' };
    } else {
      stageDates[stage.id] = null;
    }
  });

  const today = isoDate(new Date());
  const currentEntry = [...truncatedTimeline].reverse().find(d => d.date <= today) || truncatedTimeline[truncatedTimeline.length - 1] || null;
  const currentStage = currentEntry ? stageForGdd(currentEntry.cumulative) : STAGES[0];
  const nextStage = STAGES.find(stage => !stageDates[stage.id]) || null;
  const nextStageDate = nextStage ? truncatedTimeline.find(d => d.cumulative >= nextStage.gdd)?.date || null : null;
  const forecastEnd = truncatedTimeline[truncatedTimeline.length - 1]?.date || null;

  let notice = '';
  if (latestObs) {
    notice = `Estimation recalée sur l’observation du ${formatDate(latestObs.date)} (${stageById(latestObs.stage).label}).`;
  } else if (!effectiveStartObs && parcel.stageCDate) {
    notice = `Le calcul démarre au stade C observé le ${formatDate(parcel.stageCDate)}.`;
  } else if (!parcel.stageCDate) {
    notice = 'Aucune date au stade C renseignée : estimation indicative depuis le 1er mars.';
  }

  return {
    parcel,
    baseTemp,
    start,
    observations,
    timeline: truncatedTimeline,
    stageDates,
    currentEntry,
    currentStage,
    nextStage,
    nextStageDate,
    forecastEnd,
    finalReachedDate,
    notice
  };
}

function renderAlerts(analysis) {
  const alerts = [];
  if (analysis.nextStage && analysis.nextStageDate) {
    const days = diffDays(isoDate(new Date()), analysis.nextStageDate);
    if (days >= 0 && days <= 5) alerts.push({ type: 'stage', text: `${analysis.nextStage.label} attendu autour du ${formatDate(analysis.nextStageDate)}.` });
  }
  if (!analysis.finalReachedDate) {
    analysis.timeline.filter(d => d.type === 'forecast').slice(0, 7).forEach(day => {
      if (day.min <= 0) alerts.push({ type: 'frost', text: `Risque de gel le ${formatDate(day.date)} : Tmin prévue ${round1(day.min)} °C.` });
    });
  }
  els.alertsSection.classList.toggle('hidden', alerts.length === 0);
  els.alertsList.innerHTML = alerts.map(a => `<div class="alert ${a.type === 'frost' ? 'frost' : ''}">${a.text}</div>`).join('');
}

function renderForecast(analysis) {
  const rows = analysis.timeline.filter(d => d.type === 'forecast');
  if (!rows.length || analysis.finalReachedDate && rows[0].date > analysis.finalReachedDate) {
    els.forecastTableWrap.classList.add('hidden');
    els.weatherStatus.textContent = analysis.finalReachedDate ? `Le dernier stade a été atteint le ${formatDate(analysis.finalReachedDate)}. Les prévisions phénologiques sont arrêtées.` : els.weatherStatus.textContent;
    return;
  }
  els.forecastBody.innerHTML = rows.map(day => {
    const stage = stageForGdd(day.cumulative);
    return `<tr><td>${formatDate(day.date)}</td><td>${round1(day.min)} °C</td><td>${round1(day.max)} °C</td><td>${round1(day.gdd)}</td><td>${round1(day.cumulative)}</td><td>${stage.label}</td></tr>`;
  }).join('');
  els.forecastTableWrap.classList.remove('hidden');
}

function renderStageHistory(analysis) {
  if (!analysis) {
    els.stageHistoryWrap.classList.add('hidden');
    els.stageHistoryStatus.textContent = 'Aucune donnée chargée.';
    return;
  }
  els.stageHistoryBody.innerHTML = STAGES.map(stage => {
    const info = analysis.stageDates[stage.id];
    return `<tr><td>${stage.label}</td><td>${stage.bbch}</td><td>${info ? formatDate(info.date) : 'À venir'}</td><td>${info ? info.origin : '—'}</td></tr>`;
  }).join('');
  els.stageHistoryWrap.classList.remove('hidden');
  els.stageHistoryStatus.textContent = '';
  els.chartCurrentGdd.textContent = analysis.currentEntry ? `${round1(analysis.currentEntry.cumulative)} DJ` : '—';
  els.chartNextThreshold.textContent = analysis.nextStage ? `${analysis.nextStage.label} · ${analysis.nextStage.gdd} DJ` : 'Cycle terminé';
  els.chartForecastEnd.textContent = analysis.forecastEnd ? formatDate(analysis.forecastEnd) : '—';
  els.gddChartStatus.textContent = analysis.timeline.length ? '' : 'Aucune donnée chargée.';
}

function drawChart() {
  const canvas = els.gddChart;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(300, Math.round(rect.width || 900));
  const height = Math.max(260, Math.round(rect.height || 360));
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!latestAnalysis || !latestAnalysis.timeline.length) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.fillText('Aucune donnée à afficher.', 20, 30);
    return;
  }

  const data = latestAnalysis.timeline;
  const margin = { top: 18, right: 18, bottom: 42, left: 52 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxGdd = Math.max(LAST_STAGE.gdd, ...data.map(d => d.cumulative)) * 1.08;
  const startDate = new Date(data[0].date + 'T00:00:00');
  const endDate = new Date(data[data.length - 1].date + 'T00:00:00');
  const span = Math.max(1, endDate - startDate);
  const x = date => margin.left + ((new Date(date + 'T00:00:00') - startDate) / span) * chartW;
  const y = val => margin.top + chartH - (val / maxGdd) * chartH;

  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gv = (maxGdd / 4) * i;
    const yy = y(gv);
    ctx.beginPath(); ctx.moveTo(margin.left, yy); ctx.lineTo(width - margin.right, yy); ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.fillText(String(Math.round(gv)), 6, yy + 4);
  }

  STAGES.forEach(stage => {
    const yy = y(stage.gdd);
    ctx.strokeStyle = 'rgba(227, 8, 77, 0.18)';
    ctx.beginPath(); ctx.moveTo(margin.left, yy); ctx.lineTo(width - margin.right, yy); ctx.stroke();
    ctx.fillStyle = '#B4063C';
    ctx.font = '11px sans-serif';
    ctx.fillText(stage.id, width - margin.right - 18, yy - 4);
  });

  const hist = data.filter(d => d.type === 'history');
  const forecast = data.filter(d => d.type === 'forecast');
  drawLine(ctx, hist, x, y, '#E3084D', false);
  drawLine(ctx, forecast, x, y, '#978AA1', true, hist[hist.length - 1]);

  latestAnalysis.observations.forEach(obs => {
    const point = data.find(d => d.date === obs.date);
    const stage = stageById(obs.stage);
    if (!point || !stage) return;
    ctx.fillStyle = '#B4063C';
    ctx.beginPath(); ctx.arc(x(obs.date), y(stage.gdd), 4, 0, Math.PI * 2); ctx.fill();
  });

  const ticks = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]].filter(Boolean);
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ticks.forEach(t => {
    const xx = x(t.date);
    ctx.beginPath(); ctx.moveTo(xx, height - margin.bottom); ctx.lineTo(xx, height - margin.bottom + 6); ctx.strokeStyle = '#bdbdbd'; ctx.stroke();
    const txt = shortDate(t.date);
    ctx.fillText(txt, Math.max(margin.left, xx - 18), height - 12);
  });
  ctx.strokeStyle = '#999';
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top); ctx.lineTo(margin.left, height - margin.bottom); ctx.lineTo(width - margin.right, height - margin.bottom); ctx.stroke();
}

function drawLine(ctx, points, xFn, yFn, color, dashed, prepend) {
  const pts = prepend && points.length ? [prepend, ...points] : points;
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  if (dashed) ctx.setLineDash([7, 6]);
  ctx.beginPath();
  pts.forEach((p, i) => {
    const xx = xFn(p.date);
    const yy = yFn(p.cumulative);
    if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  });
  ctx.stroke();
  ctx.restore();
}

function switchTab(tab) {
  const dash = tab === 'dashboard';
  els.dashboardView.classList.toggle('hidden', !dash);
  els.historyView.classList.toggle('hidden', dash);
  els.dashboardTabBtn.classList.toggle('active', dash);
  els.historyTabBtn.classList.toggle('active', !dash);
  els.dashboardTabBtn.setAttribute('aria-selected', String(dash));
  els.historyTabBtn.setAttribute('aria-selected', String(!dash));
  if (!dash) setTimeout(drawChart, 50);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
}

function loadCachedWeather() {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return;
    activeWeather = JSON.parse(raw);
    els.weatherLastUpdate.value = localStorage.getItem(`${WEATHER_CACHE_KEY}-updated`) || 'Données locales';
  } catch (e) {
    console.error(e);
  }
}

function saveWeatherCache(data) {
  localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
}

async function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const imported = parseImportedStages(text);
  if (!imported.length) {
    toast('Aucune observation reconnue dans le fichier.');
    event.target.value = '';
    return;
  }
  const p = activeParcel();
  imported.forEach(obs => {
    p.observations = p.observations.filter(o => o.date !== obs.date);
    p.observations.push(obs);
    if (obs.stage === 'C' && !p.stageCDate) p.stageCDate = obs.date;
  });
  p.observations.sort((a, b) => a.date.localeCompare(b.date));
  persistState();
  loadParcelIntoForm();
  toast(`${imported.length} observation(s) importée(s).`);
  event.target.value = '';
}

function parseImportedStages(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const result = [];
  lines.forEach((line, index) => {
    const parts = line.split(/[;,\t]/).map(s => s.trim());
    if (parts.length < 2) return;
    if (index === 0 && /date/i.test(parts[0]) && /(stade|stage)/i.test(parts[1])) return;
    const date = normalizeDate(parts[0]);
    const stage = normalizeStage(parts[1]);
    if (date && stage) result.push({ date, stage });
  });
  return result;
}

function normalizeDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function normalizeStage(value) {
  if (!value) return null;
  const clean = value.toUpperCase().replace(/\s+/g, '').replace('—', '-');
  const found = STAGES.find(s => clean === s.id || clean.startsWith(s.id));
  return found ? found.id : null;
}

function stageById(id) { return STAGES.find(s => s.id === id); }
function stageForGdd(gdd) {
  let current = STAGES[0];
  for (const stage of STAGES) if (gdd >= stage.gdd) current = stage;
  return current;
}
function computeGdd(min, max, base) { return Math.max(0, (((Number(min) || 0) + (Number(max) || 0)) / 2) - base); }
function formatDate(dateStr) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR'); }
function shortDate(dateStr) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); }
function isoDate(date) { return date.toISOString().slice(0, 10); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function diffDays(date1, date2) { return Math.round((new Date(date2 + 'T00:00:00') - new Date(date1 + 'T00:00:00')) / 86400000); }
function round1(n) { return (Math.round((Number(n) + Number.EPSILON) * 10) / 10).toFixed(1); }
function clampNumber(value, min, max, fallback) { return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback; }
function uid() { return 'p_' + Math.random().toString(36).slice(2, 10); }
function escapeHtml(str) { return String(str).replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); }
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}
