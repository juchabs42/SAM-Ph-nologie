'use strict';

const STORAGE_KEY = 'sam-phenologie-v1';
const WEATHER_CACHE_KEY = 'sam-phenologie-weather-cache-v1';

// Modèle générique de travail, exprimé en DJ base 5 °C à partir du stade B.
// Les seuils sont volontairement recalables par une observation terrain.
const STAGES = [
  { id: 'B', label: 'B — bourgeon gonflé', bbch: 'BBCH 51', gdd: 0 },
  { id: 'C', label: 'C — éclatement des bourgeons', bbch: 'BBCH 53', gdd: 35 },
  { id: 'C3', label: 'C3 — oreille de souris', bbch: 'BBCH 54', gdd: 65 },
  { id: 'D', label: 'D — bouton vert', bbch: 'BBCH 56', gdd: 105 },
  { id: 'E', label: 'E — bouton rose', bbch: 'BBCH 57', gdd: 145 },
  { id: 'E2', label: 'E2 — ballonnets', bbch: 'BBCH 59', gdd: 180 },
  { id: 'F', label: 'F — début floraison', bbch: 'BBCH 61', gdd: 220 },
  { id: 'F2', label: 'F2 — pleine floraison', bbch: 'BBCH 65', gdd: 260 },
  { id: 'G', label: 'G — floraison déclinante', bbch: 'BBCH 67', gdd: 300 },
  { id: 'H', label: 'H — fin floraison', bbch: 'BBCH 69', gdd: 340 },
  { id: 'I', label: 'I — nouaison', bbch: 'BBCH 71', gdd: 390 },
  { id: 'J', label: 'J — taille noisette', bbch: 'BBCH 72', gdd: 520 }
];

const els = {};
let state = loadState();
let activeWeather = null;
let deferredInstallPrompt = null;

window.addEventListener('DOMContentLoaded', init);

function init() {
  cacheElements();
  populateStageSelect();
  bindEvents();
  ensureInitialParcel();
  renderParcelSelect();
  loadParcelIntoForm();
  renderObservations();
  document.getElementById('observationDate').value = isoDate(new Date());
  registerServiceWorker();
  loadCachedWeather();
  refreshWeather(false);
}

function cacheElements() {
  ['parcelSelect','parcelName','variety','latitude','longitude','stageBDate','baseTemp','gpsBtn','saveParcelBtn','newParcelBtn','deleteParcelBtn','stageMain','stageBbch','gddTotal','nextStage','nextDate','calibrationNotice','alertsSection','alertsList','observationDate','observationStage','addObservationBtn','observationsList','refreshBtn','weatherStatus','forecastTableWrap','forecastBody','toast','installBtn'].forEach(id => els[id] = document.getElementById(id));
}

function bindEvents() {
  els.parcelSelect.addEventListener('change', () => {
    state.activeParcelId = els.parcelSelect.value;
    persistState();
    loadParcelIntoForm();
    renderObservations();
    activeWeather = null;
    loadCachedWeather();
    refreshWeather(false);
  });
  els.saveParcelBtn.addEventListener('click', saveParcelFromForm);
  els.newParcelBtn.addEventListener('click', newParcel);
  els.deleteParcelBtn.addEventListener('click', deleteParcel);
  els.gpsBtn.addEventListener('click', useGPS);
  els.addObservationBtn.addEventListener('click', addObservation);
  els.refreshBtn.addEventListener('click', () => refreshWeather(true));
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', installApp);
}

function ensureInitialParcel() {
  if (!state.parcels.length) {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    state.parcels.push({ id, name: 'Ma parcelle', variety: 'generic', latitude: '', longitude: '', stageBDate: '', baseTemp: 5, observations: [] });
    state.activeParcelId = id;
    persistState();
  }
}

function populateStageSelect() {
  els.observationStage.innerHTML = STAGES.map(s => `<option value="${s.id}">${s.label} · ${s.bbch}</option>`).join('');
}

function activeParcel() { return state.parcels.find(p => p.id === state.activeParcelId) || state.parcels[0]; }

function renderParcelSelect() {
  els.parcelSelect.innerHTML = state.parcels.map(p => `<option value="${p.id}">${escapeHtml(p.name || 'Sans nom')}</option>`).join('');
  els.parcelSelect.value = state.activeParcelId;
}

function loadParcelIntoForm() {
  const p = activeParcel();
  if (!p) return;
  els.parcelName.value = p.name || '';
  els.variety.value = p.variety || 'generic';
  els.latitude.value = p.latitude ?? '';
  els.longitude.value = p.longitude ?? '';
  els.stageBDate.value = p.stageBDate || '';
  els.baseTemp.value = p.baseTemp ?? 5;
  renderPhenology();
}

function saveParcelFromForm() {
  const p = activeParcel();
  const lat = Number(els.latitude.value);
  const lon = Number(els.longitude.value);
  if (els.latitude.value && (lat < 41 || lat > 52)) return toast('Latitude hors France métropolitaine.');
  if (els.longitude.value && (lon < -6 || lon > 10)) return toast('Longitude hors France métropolitaine.');
  Object.assign(p, {
    name: els.parcelName.value.trim() || 'Parcelle sans nom',
    variety: els.variety.value,
    latitude: els.latitude.value === '' ? '' : lat,
    longitude: els.longitude.value === '' ? '' : lon,
    stageBDate: els.stageBDate.value,
    baseTemp: Number(els.baseTemp.value) || 5
  });
  persistState();
  renderParcelSelect();
  toast('Parcelle enregistrée.');
  refreshWeather(true);
}

function newParcel() {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  state.parcels.push({ id, name: `Parcelle ${state.parcels.length + 1}`, variety: 'generic', latitude: '', longitude: '', stageBDate: '', baseTemp: 5, observations: [] });
  state.activeParcelId = id;
  persistState();
  renderParcelSelect();
  loadParcelIntoForm();
  renderObservations();
}

function deleteParcel() {
  if (state.parcels.length === 1) return toast('Conservez au moins une parcelle.');
  const p = activeParcel();
  if (!confirm(`Supprimer « ${p.name} » et ses observations ?`)) return;
  state.parcels = state.parcels.filter(x => x.id !== p.id);
  state.activeParcelId = state.parcels[0].id;
  persistState();
  renderParcelSelect();
  loadParcelIntoForm();
  renderObservations();
  activeWeather = null;
}

function useGPS() {
  if (!navigator.geolocation) return toast('Géolocalisation non disponible.');
  els.gpsBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(pos => {
    els.latitude.value = pos.coords.latitude.toFixed(5);
    els.longitude.value = pos.coords.longitude.toFixed(5);
    els.gpsBtn.disabled = false;
    toast('Position récupérée. Enregistrez la parcelle.');
  }, err => {
    els.gpsBtn.disabled = false;
    toast(err.code === 1 ? 'Autorisation GPS refusée.' : 'Position GPS indisponible.');
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 });
}

function addObservation() {
  const p = activeParcel();
  const date = els.observationDate.value;
  const stage = els.observationStage.value;
  if (!date) return toast('Choisissez une date.');
  p.observations = p.observations || [];
  p.observations = p.observations.filter(o => o.date !== date);
  p.observations.push({ date, stage });
  p.observations.sort((a,b) => a.date.localeCompare(b.date));
  if (stage === 'B') p.stageBDate = date;
  persistState();
  loadParcelIntoForm();
  renderObservations();
  renderPhenology();
  toast('Observation ajoutée.');
}

function removeObservation(date) {
  const p = activeParcel();
  p.observations = (p.observations || []).filter(o => o.date !== date);
  persistState();
  renderObservations();
  renderPhenology();
}

function renderObservations() {
  const p = activeParcel();
  const obs = [...(p.observations || [])].sort((a,b) => b.date.localeCompare(a.date));
  els.observationsList.innerHTML = obs.length ? obs.map(o => {
    const s = STAGES.find(x => x.id === o.stage);
    return `<div class="observation-row"><span>${formatDate(o.date)}</span><strong>${s ? s.label : o.stage}</strong><button type="button" data-date="${o.date}" aria-label="Supprimer">✕</button></div>`;
  }).join('') : '<p class="hint">Aucune observation enregistrée.</p>';
  els.observationsList.querySelectorAll('button[data-date]').forEach(btn => btn.addEventListener('click', () => removeObservation(btn.dataset.date)));
}

async function refreshWeather(force) {
  const p = activeParcel();
  if (p.latitude === '' || p.longitude === '') {
    els.weatherStatus.textContent = 'Renseignez puis enregistrez les coordonnées GPS.';
    renderPhenology();
    return;
  }
  if (!navigator.onLine && activeWeather) {
    els.weatherStatus.textContent = 'Hors connexion : dernières données enregistrées.';
    renderPhenology();
    return;
  }
  if (!navigator.onLine) {
    els.weatherStatus.textContent = 'Hors connexion et aucune donnée météo enregistrée.';
    return;
  }

  els.weatherStatus.textContent = 'Chargement des données Open‑Meteo…';
  els.forecastTableWrap.classList.add('hidden');
  try {
    const today = isoDate(new Date());
    const start = p.stageBDate || `${new Date().getFullYear()}-03-01`;
    const historyEnd = isoDate(addDays(new Date(), -1));
    const historicalUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${p.latitude}&longitude=${p.longitude}&start_date=${start}&end_date=${historyEnd}&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis`;
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=16`;

    const [historyRes, forecastRes] = await Promise.all([
      start <= historyEnd ? fetch(historicalUrl) : Promise.resolve(null),
      fetch(forecastUrl)
    ]);
    if (historyRes && !historyRes.ok) throw new Error('Historique indisponible');
    if (!forecastRes.ok) throw new Error('Prévisions indisponibles');
    const history = historyRes ? await historyRes.json() : { daily: { time: [], temperature_2m_min: [], temperature_2m_max: [] } };
    const forecast = await forecastRes.json();
    activeWeather = mergeWeather(history.daily, forecast.daily, today);
    saveWeatherCache(p.id, activeWeather);
    els.weatherStatus.textContent = `Données actualisées le ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}.`;
    renderPhenology();
  } catch (error) {
    console.error(error);
    loadCachedWeather();
    els.weatherStatus.textContent = activeWeather ? 'Open‑Meteo indisponible : affichage des dernières données enregistrées.' : 'Impossible de charger les données météo.';
    renderPhenology();
  }
}

function mergeWeather(history, forecast, today) {
  const map = new Map();
  const add = (daily, type) => {
    (daily.time || []).forEach((date, i) => map.set(date, { date, min: daily.temperature_2m_min[i], max: daily.temperature_2m_max[i], type }));
  };
  add(history, 'history');
  add(forecast, 'forecast');
  return [...map.values()].sort((a,b) => a.date.localeCompare(b.date));
}

function renderPhenology() {
  const p = activeParcel();
  if (!p || !activeWeather) {
    els.stageMain.textContent = '—';
    els.stageBbch.textContent = p && p.latitude !== '' ? 'Chargement météo nécessaire' : 'Renseignez les coordonnées GPS';
    els.gddTotal.textContent = '—';
    els.nextStage.textContent = '—';
    els.nextDate.textContent = '—';
    return;
  }
  const base = Number(p.baseTemp) || 5;
  const startDate = p.stageBDate || `${new Date().getFullYear()}-03-01`;
  const series = computeSeries(activeWeather, startDate, base, p.observations || []);
  const todayIso = isoDate(new Date());
  const current = [...series].reverse().find(d => d.date <= todayIso) || series[0];
  if (!current) return;
  const currentStage = stageForGdd(current.adjustedGdd);
  const next = STAGES.find(s => s.gdd > current.adjustedGdd);
  const predicted = next ? series.find(d => d.date >= todayIso && d.adjustedGdd >= next.gdd) : null;

  els.stageMain.textContent = currentStage.label;
  els.stageBbch.textContent = currentStage.bbch;
  els.gddTotal.textContent = `${Math.round(current.adjustedGdd)} °C·j`;
  els.nextStage.textContent = next ? next.label : 'Cycle suivi terminé';
  els.nextDate.textContent = next ? (predicted ? formatDate(predicted.date) : 'Au-delà de la période prévisionnelle') : '—';

  const latestObs = latestObservationBefore(p.observations || [], todayIso);
  els.calibrationNotice.classList.remove('hidden');
  if (latestObs) {
    const s = STAGES.find(x => x.id === latestObs.stage);
    els.calibrationNotice.textContent = `Estimation recalée sur l’observation ${s.label} du ${formatDate(latestObs.date)}.`;
  } else if (p.stageBDate) {
    els.calibrationNotice.textContent = `Cumul démarré au stade B observé le ${formatDate(p.stageBDate)}.`;
  } else {
    els.calibrationNotice.textContent = 'Estimation indicative depuis le 1er mars : saisissez le stade B observé pour calibrer la parcelle.';
  }
  renderAlerts(series, current, currentStage, next, predicted);
  renderForecastTable(series, todayIso);
}

function computeSeries(weather, startDate, base, observations) {
  let raw = 0;
  let offset = 0;
  const sortedObs = [...observations].sort((a,b) => a.date.localeCompare(b.date));
  return weather.filter(d => d.date >= startDate).map(day => {
    const gdd = Math.max(0, (((Number(day.min) + Number(day.max)) / 2) - base));
    raw += Number.isFinite(gdd) ? gdd : 0;
    const obs = sortedObs.find(o => o.date === day.date);
    if (obs) {
      const stage = STAGES.find(s => s.id === obs.stage);
      if (stage) offset = stage.gdd - raw;
    }
    return { ...day, gdd, rawGdd: raw, adjustedGdd: Math.max(0, raw + offset) };
  });
}

function stageForGdd(gdd) {
  return [...STAGES].reverse().find(s => gdd >= s.gdd) || STAGES[0];
}

function latestObservationBefore(observations, date) {
  return [...observations].filter(o => o.date <= date).sort((a,b) => b.date.localeCompare(a.date))[0] || null;
}

function renderAlerts(series, current, currentStage, next, predicted) {
  const alerts = [];
  const today = isoDate(new Date());
  if (predicted) {
    const days = dateDiffDays(today, predicted.date);
    if (days >= 0 && days <= 5) alerts.push({ type: 'phenology', text: `${next.label} attendu dans environ ${days === 0 ? 'moins d’un jour' : `${days} jour${days > 1 ? 's' : ''}`}.` });
  }
  const sensitive = ['D','E','E2','F','F2','G','H','I'].includes(currentStage.id);
  const frostDays = series.filter(d => d.date >= today && d.type === 'forecast' && Number(d.min) <= 0).slice(0, 3);
  if (sensitive && frostDays.length) {
    frostDays.forEach(d => alerts.push({ type: 'frost', text: `Risque de gel le ${formatDate(d.date)} : minimum prévu ${Number(d.min).toFixed(1)} °C au stade ${currentStage.id}.` }));
  }
  els.alertsList.innerHTML = alerts.map(a => `<div class="alert ${a.type === 'frost' ? 'frost' : ''}">${a.text}</div>`).join('');
  els.alertsSection.classList.toggle('hidden', alerts.length === 0);
}

function renderForecastTable(series, today) {
  const rows = series.filter(d => d.date >= today && d.type === 'forecast').slice(0, 16);
  els.forecastBody.innerHTML = rows.map(d => {
    const s = stageForGdd(d.adjustedGdd);
    return `<tr><td>${formatDate(d.date)}</td><td>${Number(d.min).toFixed(1)} °C</td><td>${Number(d.max).toFixed(1)} °C</td><td>${d.gdd.toFixed(1)}</td><td>${Math.round(d.adjustedGdd)}</td><td>${s.id}</td></tr>`;
  }).join('');
  els.forecastTableWrap.classList.toggle('hidden', rows.length === 0);
}

function loadCachedWeather() {
  try {
    const cache = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || '{}');
    activeWeather = cache[activeParcel()?.id]?.data || null;
    if (activeWeather) {
      els.weatherStatus.textContent = 'Dernières données enregistrées localement.';
      renderPhenology();
    }
  } catch { activeWeather = null; }
}

function saveWeatherCache(parcelId, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || '{}');
    cache[parcelId] = { savedAt: Date.now(), data };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch (error) { console.warn('Cache météo non enregistré', error); }
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { parcels: [], activeParcelId: null }; }
  catch { return { parcels: [], activeParcelId: null }; }
}
function persistState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
}

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installBtn.classList.add('hidden');
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}
function isoDate(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,10); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function dateDiffDays(a,b) { return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000); }
function formatDate(date) { return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function escapeHtml(str) { return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
