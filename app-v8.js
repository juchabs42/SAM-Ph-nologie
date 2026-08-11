'use strict';

const VERSION = '2.6';
const STORAGE_KEY = 'sam-phenologie-v2.6';
const LEGACY_STORAGE_KEYS = ['sam-phenologie-v2.5', 'sam-phenologie-v2.4', 'sam-phenologie-v2.3', 'sam-phenologie-v1'];
const WEATHER_CACHE_KEY = 'sam-phenologie-weather-v2.6';
const LEGACY_WEATHER_CACHE_KEYS = ['sam-phenologie-weather-v2.5', 'sam-phenologie-weather-v2.4', 'sam-phenologie-weather-cache-v1'];
const DEFAULT_LOCATION = { name: 'Marsillargues', admin1: 'Occitanie', country: 'France', latitude: 43.6343, longitude: 4.1706, elevation: 2, timezone: 'Europe/Paris' };
const DEFAULT_BASE_TEMP = 5;
const FALLBACK_START = '-03-01';

const STAGE_META = [
  { id: 'C', label: 'C — éclatement des bourgeons', bbch: 'BBCH 53' },
  { id: 'C3', label: 'C3 — oreille de souris', bbch: 'BBCH 54' },
  { id: 'D', label: 'D — bouton vert', bbch: 'BBCH 56' },
  { id: 'E', label: 'E — bouton rose', bbch: 'BBCH 57' },
  { id: 'E2', label: 'E2 — ballonnets', bbch: 'BBCH 59' },
  { id: 'F', label: 'F — début floraison', bbch: 'BBCH 61' },
  { id: 'F2', label: 'F2 — pleine floraison', bbch: 'BBCH 65' },
  { id: 'G', label: 'G — floraison déclinante', bbch: 'BBCH 67' },
  { id: 'H', label: 'H — fin floraison', bbch: 'BBCH 69' },
  { id: 'I', label: 'I — nouaison', bbch: 'BBCH 71' },
  { id: 'J', label: 'J — taille noisette', bbch: 'BBCH 72' }
];

const GENERIC_THRESHOLDS = { C: 0, C3: 30, D: 70, E: 110, E2: 145, F: 185, F2: 225, G: 265, H: 305, I: 355, J: 425 };

// Seuils WSU normalisés à 0 DJ au stade Green Tip, assimilé ici au stade Fleckinger C.
// Le stade G est interpolé entre Full Bloom et Petal Fall. I et J prolongent le modèle
// avec les incréments génériques après H, car l'étude WSU s'arrête à Petal Fall.
const GALA_THRESHOLDS = { C: 0, C3: 22.84, D: 75.76, E: 112.82, E2: 147.16, F: 185.48, F2: 207.72, G: 234.97, H: 262.22, I: 312.22, J: 382.22 };
const CRIPPS_PINK_THRESHOLDS = { C: 0, C3: 13.72, D: 55.26, E: 82.40, E2: 113.45, F: 152.61, F2: 181.91, G: 204.91, H: 227.90, I: 277.90, J: 347.90 };

const WSU_REPORT_URL = 'https://treefruitresearch.org/wp-content/uploads/2019/11/Report-723.-Hoogenboom_Final_Report_Apple_2015.pdf';
const ACTA_URL = 'https://www.actahort.org/books/1160/1160_29.htm';

const MODEL_CONFIG = {
  gala: {
    id: 'gala-wsu',
    name: 'Modèle variétal Gala — WSU',
    baseTemp: 6.1,
    fixedBase: true,
    thresholds: GALA_THRESHOLDS,
    description: 'Seuils variétaux C à H issus du modèle WSU à base 6,1 °C, normalisés au stade C. Le stade G est interpolé ; les stades I et J utilisent une prolongation générique après H.',
    referenceLinks: [
      { label: 'Rapport scientifique WSU', url: WSU_REPORT_URL },
      { label: 'Article Acta Horticulturae', url: ACTA_URL }
    ]
  },
  pinklady: {
    id: 'cripps-pink-wsu',
    name: 'Modèle variétal Cripps Pink / Pink Lady — WSU',
    baseTemp: 6.1,
    fixedBase: true,
    thresholds: CRIPPS_PINK_THRESHOLDS,
    description: 'Seuils variétaux C à H issus du modèle WSU à base 6,1 °C, normalisés au stade C. Le stade G est interpolé ; les stades I et J utilisent une prolongation générique après H.',
    referenceLinks: [
      { label: 'Rapport scientifique WSU', url: WSU_REPORT_URL },
      { label: 'Article Acta Horticulturae', url: ACTA_URL }
    ]
  },
  generic: {
    id: 'generic-apple',
    name: 'Modèle générique du pommier',
    baseTemp: DEFAULT_BASE_TEMP,
    fixedBase: false,
    thresholds: GENERIC_THRESHOLDS,
    description: 'Aucun modèle variétal complet et compatible C → J n’a été retenu pour cette variété. Le calcul utilise les seuils génériques du pommier, recalables par les observations terrain.',
    referenceLinks: []
  }
};

const VARIETIES = [
  { id: 'gala', label: 'Gala', model: 'gala' },
  { id: 'golden', label: 'Golden Delicious', model: 'generic' },
  { id: 'pinklady', label: 'Cripps Pink / Pink Lady', model: 'pinklady' },
  { id: 'joya', label: 'Joya', model: 'generic' },
  { id: 'reine', label: 'Reine des reinettes', model: 'generic' },
  { id: 'granny', label: 'Granny Smith', model: 'generic' },
  { id: 'ariane', label: 'Ariane', model: 'generic' },
  { id: 'dalinette', label: 'Dalinette', model: 'generic' },
  { id: 'opal', label: 'Opal', model: 'generic' },
  { id: 'other', label: 'Autre variété', model: 'generic' }
];

const els = {};
let state = loadState();
let activeWeather = null;
let latestAnalysis = null;
let deferredPrompt = null;
let pendingLocation = null;
let chartHoverState = null;
let supabaseClient = null;
let supabaseConfigured = false;
let isAdmin = false;

window.addEventListener('DOMContentLoaded', init);

async function init() {
  bindElements();
  populateVarieties();
  populateStages();
  bindEvents();
  normalizeState();
  registerServiceWorker();
  await initSupabase();
  if (supabaseConfigured) await loadRemoteData();
  renderExploitationSelect();
  renderParcelSelect();
  loadParcelIntoForm();
  loadCachedWeather();
  setEditMode();
  if (state.parcels.length) refreshWeather(false);
}

function bindElements() {
  [
    'exploitationSelect','parcelSelect','activeVariety','activeWeatherLocation','activeStart','dataModeBadge',
    'dashboardTabBtn','historyTabBtn','dashboardView','historyView',
    'exploitation','parcelName','variety','stageCDate','baseTemp','weatherLastUpdate','varietyInfoText','baseTempInfoText','modelName','modelDescription','modelReferenceLinks',
    'locationSearch','searchLocationBtn','locationResults','selectedLocation','editStatus',
    'saveParcelBtn','newParcelBtn','deleteParcelBtn',
    'stageMain','stageBbch','gddTotal','nextStage','nextDate','calibrationNotice',
    'alertsSection','alertsList','observationDate','observationStage','addObservationBtn','observationsList',
    'refreshBtn','weatherStatus','forecastTableWrap','forecastBody',
    'stageHistoryStatus','stageHistoryWrap','stageHistoryBody',
    'chartCurrentGdd','chartNextThreshold','chartForecastEnd','gddChartStatus','gddChart','chartWrap','chartTooltip',
    'installBtn','toast','importStagesBtn','importStagesBtnTop','importStagesInput',
    'authBtn','authPanel','closeAuthBtn','authEmail','authPassword','loginBtn','logoutBtn','syncLocalBtn','authStatus'
  ].forEach(id => els[id] = document.getElementById(id));
}

function bindEvents() {
  els.exploitationSelect.addEventListener('change', handleExploitationChange);
  els.parcelSelect.addEventListener('change', async () => {
    state.activeParcelId = els.parcelSelect.value;
    persistState();
    loadParcelIntoForm();
    loadCachedWeather();
    await refreshWeather(false);
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
  els.variety.addEventListener('change', () => updateModelUi(true));
  els.searchLocationBtn.addEventListener('click', searchLocations);
  els.locationSearch.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); searchLocations(); } });
  els.locationResults.addEventListener('change', selectLocationResult);
  els.gddChart.addEventListener('pointermove', handleChartPointer);
  els.gddChart.addEventListener('pointerleave', hideChartTooltip);

  els.authBtn.addEventListener('click', () => els.authPanel.classList.toggle('hidden'));
  els.closeAuthBtn.addEventListener('click', () => els.authPanel.classList.add('hidden'));
  els.loginBtn.addEventListener('click', loginSupabase);
  els.logoutBtn.addEventListener('click', logoutSupabase);
  els.syncLocalBtn.addEventListener('click', syncAllLocalToSupabase);

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
  els.observationStage.innerHTML = STAGE_META.map(stage => `<option value="${stage.id}">${stage.label}</option>`).join('');
}

function createDefaultParcel() {
  const selectedExploitation = els.exploitationSelect?.value || 'SudExpé Marsillargues';
  return {
    id: uid(),
    exploitation: selectedExploitation,
    name: 'Parcelle 1',
    variety: 'gala',
    stageCDate: '',
    baseTemp: MODEL_CONFIG.gala.baseTemp,
    weatherLocation: { ...DEFAULT_LOCATION },
    observations: []
  };
}

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_STORAGE_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) {
      const p = createDefaultParcel();
      return { parcels: [p], activeParcelId: p.id };
    }
    const parsed = JSON.parse(raw);
    parsed.parcels = Array.isArray(parsed.parcels) && parsed.parcels.length ? parsed.parcels : [createDefaultParcel()];
    if (!parsed.activeParcelId || !parsed.parcels.some(p => p.id === parsed.activeParcelId)) parsed.activeParcelId = parsed.parcels[0].id;
    parsed.parcels.forEach(p => {
      p.observations = Array.isArray(p.observations) ? p.observations : [];
      if (!p.exploitation) p.exploitation = '';
      if (!p.name) p.name = 'Parcelle';
      if (!p.variety) p.variety = 'other';
      if (!('stageCDate' in p)) p.stageCDate = '';
      const model = getModelForVariety(p.variety);
      if (model.fixedBase) p.baseTemp = model.baseTemp;
      else if (typeof p.baseTemp !== 'number') p.baseTemp = DEFAULT_BASE_TEMP;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
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

function normalizeState() {
  state.parcels.forEach(p => {
    p.observations = Array.isArray(p.observations) ? p.observations : [];
    p.exploitation = p.exploitation || 'SudExpé Marsillargues';
    p.name = p.name || 'Parcelle';
    if (p.variety === 'opale') p.variety = 'opal';
    p.variety = p.variety || 'other';
    p.stageCDate = p.stageCDate || '';
    const model = getModelForVariety(p.variety);
    p.baseTemp = model.fixedBase ? model.baseTemp : (typeof p.baseTemp === 'number' ? p.baseTemp : DEFAULT_BASE_TEMP);
    p.weatherLocation = normalizeLocation(p.weatherLocation || DEFAULT_LOCATION);
  });
  if (!state.activeParcelId || !state.parcels.some(p => p.id === state.activeParcelId)) state.activeParcelId = state.parcels[0]?.id || null;
  persistState();
}

function renderExploitationSelect() {
  const current = activeParcel()?.exploitation || '';
  const values = [...new Set(state.parcels.map(p => p.exploitation).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'fr'));
  els.exploitationSelect.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if (values.includes(current)) els.exploitationSelect.value = current;
}

function renderParcelSelect() {
  const exploitation = els.exploitationSelect.value || activeParcel()?.exploitation || '';
  const parcels = state.parcels.filter(p => p.exploitation === exploitation);
  els.parcelSelect.innerHTML = parcels.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  let selected = parcels.find(p => p.id === state.activeParcelId);
  if (!selected && parcels.length) {
    selected = parcels[0];
    state.activeParcelId = selected.id;
    persistState();
  }
  if (selected) els.parcelSelect.value = selected.id;
}

async function handleExploitationChange() {
  const parcels = state.parcels.filter(p => p.exploitation === els.exploitationSelect.value);
  if (!parcels.length) return;
  state.activeParcelId = parcels[0].id;
  persistState();
  renderParcelSelect();
  loadParcelIntoForm();
  loadCachedWeather();
  await refreshWeather(false);
}

function loadParcelIntoForm() {
  const p = activeParcel();
  if (!p) return;
  els.exploitation.value = p.exploitation || '';
  els.parcelName.value = p.name || '';
  els.variety.value = p.variety || 'other';
  els.stageCDate.value = p.stageCDate || '';
  els.baseTemp.value = p.baseTemp ?? getModelForVariety(p.variety).baseTemp;
  pendingLocation = normalizeLocation(p.weatherLocation || DEFAULT_LOCATION);
  renderSelectedLocation();
  els.locationSearch.value = '';
  els.locationResults.classList.add('hidden');
  updateModelUi(false);
  updateActiveSummary();
  renderObservations();
  renderPhenology();
  setEditMode();
}

function updateModelUi(resetBase) {
  const variety = VARIETIES.find(v => v.id === els.variety.value) || VARIETIES[VARIETIES.length - 1];
  const model = MODEL_CONFIG[variety.model] || MODEL_CONFIG.generic;
  if (model.fixedBase) {
    els.baseTemp.value = model.baseTemp;
    els.baseTemp.disabled = true;
  } else {
    els.baseTemp.disabled = false;
    if (resetBase) els.baseTemp.value = DEFAULT_BASE_TEMP;
  }

  els.modelName.textContent = model.name;
  els.modelDescription.textContent = model.description;
  els.varietyInfoText.textContent = model.fixedBase
    ? `${variety.label} dispose d’un modèle variétal intégré. Les seuils publiés sont utilisés de C à H.`
    : 'En l’absence de modèle variétal validé et compatible avec tous les stades suivis, le calcul utilise le modèle générique du pommier.';
  els.baseTempInfoText.textContent = model.fixedBase
    ? `Le modèle scientifique de ${variety.label} utilise une température de base de ${String(model.baseTemp).replace('.', ',')} °C (43 °F). Cette valeur est imposée pour conserver la cohérence avec les seuils variétaux publiés.`
    : 'La température de base est le seuil sous lequel le développement du pommier est considéré comme très faible. La valeur de 5 °C est utilisée pour calculer simplement l’accumulation de chaleur depuis le stade C.';

  if (model.referenceLinks.length) {
    els.modelReferenceLinks.innerHTML = model.referenceLinks.map(link => `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>`).join('');
    els.modelReferenceLinks.classList.remove('hidden');
  } else {
    els.modelReferenceLinks.innerHTML = '';
    els.modelReferenceLinks.classList.add('hidden');
  }
}

function updateActiveSummary() {
  const p = activeParcel();
  if (!p) return;
  const variety = VARIETIES.find(v => v.id === p.variety)?.label || '—';
  const loc = normalizeLocation(p.weatherLocation || DEFAULT_LOCATION);
  els.activeVariety.textContent = variety;
  els.activeWeatherLocation.textContent = locationLabel(loc);
  els.activeStart.textContent = p.stageCDate ? `Stade C observé le ${formatDate(p.stageCDate)}` : 'Stade C non renseigné';
}

async function saveParcelFromForm() {
  if (!canEdit()) return toast('Connexion SudExpé nécessaire pour modifier les données.');
  const p = activeParcel();
  p.exploitation = els.exploitation.value.trim() || 'SudExpé';
  p.name = els.parcelName.value.trim() || 'Parcelle';
  p.variety = els.variety.value;
  p.stageCDate = els.stageCDate.value;
  p.weatherLocation = normalizeLocation(pendingLocation || p.weatherLocation || DEFAULT_LOCATION);
  const model = getModelForVariety(p.variety);
  p.baseTemp = model.fixedBase ? model.baseTemp : clampNumber(parseFloat(els.baseTemp.value), 0, 15, DEFAULT_BASE_TEMP);
  persistState();
  if (supabaseConfigured && isAdmin) await syncParcelToSupabase(p);
  renderExploitationSelect();
  renderParcelSelect();
  loadParcelIntoForm();
  loadCachedWeather();
  await refreshWeather(true);
  toast('Parcelle enregistrée.');
}

async function newParcel() {
  if (!canEdit()) return toast('Connexion SudExpé nécessaire pour créer une parcelle.');
  const p = createDefaultParcel();
  state.parcels.push(p);
  state.activeParcelId = p.id;
  persistState();
  if (supabaseConfigured && isAdmin) await syncParcelToSupabase(p);
  renderExploitationSelect();
  renderParcelSelect();
  loadParcelIntoForm();
  toast('Nouvelle parcelle créée.');
}

async function deleteParcel() {
  if (!canEdit()) return toast('Connexion SudExpé nécessaire pour supprimer une parcelle.');
  if (state.parcels.length === 1) return toast('Impossible de supprimer la dernière parcelle.');
  const id = state.activeParcelId;
  if (supabaseConfigured && isAdmin) {
    const { error } = await supabaseClient.from('parcels').delete().eq('id', id);
    if (error) return toast(`Suppression Supabase impossible : ${error.message}`);
  }
  state.parcels = state.parcels.filter(p => p.id !== id);
  state.activeParcelId = state.parcels[0].id;
  persistState();
  renderExploitationSelect();
  renderParcelSelect();
  loadParcelIntoForm();
  loadCachedWeather();
  await refreshWeather(false);
  toast('Parcelle supprimée.');
}

async function addObservation() {
  if (!canEdit()) return toast('Connexion SudExpé nécessaire pour ajouter une observation.');
  const p = activeParcel();
  const date = els.observationDate.value;
  const stage = els.observationStage.value;
  if (!date) return toast('Choisissez une date.');
  p.observations = p.observations.filter(o => o.date !== date);
  p.observations.push({ date, stage });
  p.observations.sort((a, b) => a.date.localeCompare(b.date));
  if (stage === 'C') p.stageCDate = date;
  persistState();
  if (supabaseConfigured && isAdmin) {
    await syncParcelToSupabase(p);
    await syncObservationToSupabase(p.id, { date, stage });
  }
  loadParcelIntoForm();
  toast('Observation ajoutée.');
}

async function removeObservation(date) {
  if (!canEdit()) return toast('Connexion SudExpé nécessaire pour supprimer une observation.');
  const p = activeParcel();
  p.observations = p.observations.filter(o => o.date !== date);
  persistState();
  if (supabaseConfigured && isAdmin) {
    const { error } = await supabaseClient.from('observations').delete().eq('parcel_id', p.id).eq('obs_date', date);
    if (error) toast(`Suppression distante impossible : ${error.message}`);
  }
  renderObservations();
  renderPhenology();
}

function renderObservations() {
  const p = activeParcel();
  const obs = [...(p?.observations || [])].sort((a, b) => b.date.localeCompare(a.date));
  const editable = canEdit();
  els.observationsList.innerHTML = obs.length ? obs.map(o => {
    const s = stageById(o.stage);
    const del = editable ? `<button type="button" data-date="${o.date}" aria-label="Supprimer">✕</button>` : '<span></span>';
    return `<div class="observation-row"><span>${formatDate(o.date)}</span><strong>${s ? s.label : escapeHtml(o.stage)}</strong>${del}</div>`;
  }).join('') : '<p class="hint">Aucune observation enregistrée.</p>';
  if (editable) els.observationsList.querySelectorAll('button[data-date]').forEach(btn => btn.addEventListener('click', () => removeObservation(btn.dataset.date)));
}


function normalizeLocation(location) {
  const source = location || DEFAULT_LOCATION;
  return {
    name: source.name || DEFAULT_LOCATION.name,
    admin1: source.admin1 || '',
    country: source.country || 'France',
    latitude: Number.isFinite(Number(source.latitude)) ? Number(source.latitude) : DEFAULT_LOCATION.latitude,
    longitude: Number.isFinite(Number(source.longitude)) ? Number(source.longitude) : DEFAULT_LOCATION.longitude,
    elevation: Number.isFinite(Number(source.elevation)) ? Number(source.elevation) : DEFAULT_LOCATION.elevation,
    timezone: source.timezone || 'Europe/Paris'
  };
}

function locationLabel(location) {
  const loc = normalizeLocation(location);
  const details = [loc.admin1, loc.country].filter(Boolean).join(' · ');
  return details ? `${loc.name} · ${details}` : loc.name;
}

function renderSelectedLocation() {
  const loc = normalizeLocation(pendingLocation || DEFAULT_LOCATION);
  els.selectedLocation.innerHTML = `<strong>${escapeHtml(locationLabel(loc))}</strong><br><span>Latitude ${String(loc.latitude).replace('.', ',')} · longitude ${String(loc.longitude).replace('.', ',')} · altitude ${Math.round(loc.elevation)} m</span>`;
}

async function searchLocations() {
  if (!canEdit()) return toast('Connexion SudExpé nécessaire pour modifier la localisation.');
  const q = els.locationSearch.value.trim();
  if (q.length < 2) return toast('Saisissez au moins 2 caractères.');
  els.searchLocationBtn.disabled = true;
  els.searchLocationBtn.textContent = 'Recherche…';
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=12&language=fr&format=json&countryCode=FR`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Recherche indisponible');
    const data = await response.json();
    const results = data.results || [];
    if (!results.length) {
      els.locationResults.classList.add('hidden');
      return toast('Aucun lieu trouvé en France.');
    }
    els.locationResults._locations = results.map(r => normalizeLocation(r));
    els.locationResults.innerHTML = '<option value="">Choisir un lieu…</option>' + results.map((r, i) => {
      const admin = [r.admin2, r.admin1].filter(Boolean).join(', ');
      const postcode = Array.isArray(r.postcodes) && r.postcodes.length ? ` · ${r.postcodes[0]}` : '';
      return `<option value="${i}">${escapeHtml(r.name)}${postcode}${admin ? ` · ${escapeHtml(admin)}` : ''}</option>`;
    }).join('');
    els.locationResults.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    toast('Impossible de rechercher les localisations.');
  } finally {
    els.searchLocationBtn.disabled = !canEdit();
    els.searchLocationBtn.textContent = 'Rechercher';
  }
}

function selectLocationResult() {
  if (els.locationResults.value === '') return;
  const index = Number(els.locationResults.value);
  const results = els.locationResults._locations || [];
  if (!Number.isInteger(index) || !results[index]) return;
  pendingLocation = normalizeLocation(results[index]);
  renderSelectedLocation();
}

async function refreshWeather(force) {
  const p = activeParcel();
  if (!p) return;
  const loc = normalizeLocation(p.weatherLocation || DEFAULT_LOCATION);
  if (!navigator.onLine && activeWeather) {
    els.weatherStatus.textContent = 'Hors connexion : dernières données enregistrées.';
    renderPhenology();
    return;
  }
  if (!navigator.onLine) {
    loadCachedWeather();
    els.weatherStatus.textContent = activeWeather ? 'Hors connexion : dernières données enregistrées.' : 'Hors connexion et aucune donnée météo enregistrée.';
    renderPhenology();
    return;
  }

  const currentYear = new Date().getFullYear();
  const start = p.stageCDate || `${currentYear}${FALLBACK_START}`;
  const historyEnd = isoDate(addDays(new Date(), -1));
  const today = isoDate(new Date());
  els.weatherStatus.textContent = `Chargement des données Open-Meteo pour ${loc.name}…`;
  els.forecastTableWrap.classList.add('hidden');

  const timezone = encodeURIComponent(loc.timezone || 'Europe/Paris');
  const params = `latitude=${loc.latitude}&longitude=${loc.longitude}&daily=temperature_2m_max,temperature_2m_min&timezone=${timezone}`;
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
    const stamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    saveWeatherCache(activeWeather, p, stamp);
    els.weatherStatus.textContent = `Données de ${loc.name} actualisées le ${stamp}.`;
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
  els.weatherLastUpdate.value = getCachedWeatherStamp(activeParcel()) || 'Aucune donnée chargée';

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
  const currentStage = currentEntry ? stageForGdd(currentEntry.cumulative, analysis.stages) : analysis.stages[0];
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
  const model = getModelForVariety(parcel.variety);
  const stages = stagesForModel(model);
  const lastStage = stages[stages.length - 1];
  const start = parcel.stageCDate || `${new Date().getFullYear()}${FALLBACK_START}`;
  const baseTemp = model.fixedBase ? model.baseTemp : clampNumber(Number(parcel.baseTemp), 0, 15, DEFAULT_BASE_TEMP);
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
    const stage = stages.find(item => item.id === latestObs.stage);
    const rawAtObs = rawTimeline.find(d => d.date === latestObs.date)?.rawCumulative ?? 0;
    if (stage) offset = stage.gdd - rawAtObs;
  }

  const timeline = rawTimeline.map(day => ({
    ...day,
    cumulative: Math.max(0, day.rawCumulative + offset)
  }));

  const observedFinalDate = observations.find(o => o.stage === lastStage.id)?.date || null;
  const estimatedFinalDate = timeline.find(d => d.cumulative >= lastStage.gdd)?.date || null;
  const finalReachedDate = [observedFinalDate, estimatedFinalDate].filter(Boolean).sort()[0] || null;
  const truncatedTimeline = finalReachedDate ? timeline.filter(d => d.date <= finalReachedDate) : timeline;

  const stageDates = {};
  stages.forEach(stage => {
    const observed = observations.find(o => o.stage === stage.id);
    if (observed) {
      stageDates[stage.id] = { date: observed.date, origin: 'Observée' };
      return;
    }
    const reached = truncatedTimeline.find(d => d.cumulative >= stage.gdd);
    stageDates[stage.id] = reached ? { date: reached.date, origin: 'Estimée' } : null;
  });

  const today = isoDate(new Date());
  const currentEntry = [...truncatedTimeline].reverse().find(d => d.date <= today) || truncatedTimeline[truncatedTimeline.length - 1] || null;
  const currentStage = currentEntry ? stageForGdd(currentEntry.cumulative, stages) : stages[0];
  const nextStage = stages.find(stage => !stageDates[stage.id]) || null;
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
    model,
    stages,
    lastStage,
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
    const stage = stageForGdd(day.cumulative, analysis.stages);
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
  els.stageHistoryBody.innerHTML = analysis.stages.map(stage => {
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
    chartHoverState = null;
    hideChartTooltip();
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.fillText('Aucune donnée à afficher.', 20, 30);
    return;
  }

  const data = latestAnalysis.timeline;
  const margin = { top: 18, right: 18, bottom: 42, left: 52 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxGdd = Math.max(latestAnalysis.lastStage.gdd, ...data.map(d => d.cumulative)) * 1.08;
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

  latestAnalysis.stages.forEach(stage => {
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

  chartHoverState = { data, x, y, width, height, margin, analysis: latestAnalysis };
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


function handleChartPointer(event) {
  if (!chartHoverState || !chartHoverState.data.length) return;
  const canvasRect = els.gddChart.getBoundingClientRect();
  const wrapRect = els.chartWrap.getBoundingClientRect();
  const pointerX = event.clientX - canvasRect.left;
  let nearest = chartHoverState.data[0];
  let best = Infinity;
  chartHoverState.data.forEach(day => {
    const dist = Math.abs(chartHoverState.x(day.date) - pointerX);
    if (dist < best) { best = dist; nearest = day; }
  });
  const stage = stageForGdd(nearest.cumulative, chartHoverState.analysis.stages);
  const observed = chartHoverState.analysis.observations.find(o => o.date === nearest.date);
  const observedText = observed ? `<br>Observation : ${stageById(observed.stage)?.label || observed.stage}` : '';
  els.chartTooltip.innerHTML = `<strong>${formatDate(nearest.date)}</strong>${round1(nearest.cumulative)} DJ · ${stage.label}${observedText}`;
  const xInWrap = (canvasRect.left - wrapRect.left) + chartHoverState.x(nearest.date);
  const yInWrap = (canvasRect.top - wrapRect.top) + chartHoverState.y(nearest.cumulative);
  els.chartTooltip.style.left = `${Math.max(85, Math.min(wrapRect.width - 85, xInWrap))}px`;
  els.chartTooltip.style.top = `${Math.max(70, yInWrap)}px`;
  els.chartTooltip.classList.remove('hidden');
}

function hideChartTooltip() {
  if (els.chartTooltip) els.chartTooltip.classList.add('hidden');
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

function weatherCacheKey(parcel) {
  const loc = normalizeLocation(parcel?.weatherLocation || DEFAULT_LOCATION);
  const start = parcel?.stageCDate || `${new Date().getFullYear()}${FALLBACK_START}`;
  return `${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}_${start}`;
}

function loadWeatherCacheStore() {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
}

function loadCachedWeather() {
  const p = activeParcel();
  if (!p) return;
  try {
    const store = loadWeatherCacheStore();
    const entry = store[weatherCacheKey(p)];
    if (entry?.data) {
      activeWeather = entry.data;
      els.weatherLastUpdate.value = entry.updated || 'Données locales';
      return;
    }
    activeWeather = null;
  } catch (e) {
    console.error(e);
    activeWeather = null;
  }
}

function getCachedWeatherStamp(parcel) {
  const store = loadWeatherCacheStore();
  return store[weatherCacheKey(parcel)]?.updated || '';
}

function saveWeatherCache(data, parcel, updated) {
  const store = loadWeatherCacheStore();
  store[weatherCacheKey(parcel)] = { data, updated };
  localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(store));
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
  if (supabaseConfigured && isAdmin) {
    await syncParcelToSupabase(p);
    for (const obs of imported) await syncObservationToSupabase(p.id, obs);
  }
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
  const found = [...STAGE_META].sort((a, b) => b.id.length - a.id.length).find(stage => clean === stage.id || clean.startsWith(stage.id));
  return found ? found.id : null;
}


function canEdit() {
  return !supabaseConfigured || isAdmin;
}

async function initSupabase() {
  const cfg = window.SAM_SUPABASE || {};
  const usable = cfg.url && cfg.publishableKey && !cfg.url.includes('VOTRE_') && !cfg.publishableKey.includes('VOTRE_');
  if (!usable) {
    supabaseConfigured = false;
    isAdmin = false;
    els.authBtn.classList.add('hidden');
    els.authStatus.textContent = 'Supabase n’est pas configuré : l’application fonctionne avec le stockage local du navigateur.';
    setEditMode();
    return;
  }

  supabaseConfigured = true;
  if (!window.supabase?.createClient) {
    isAdmin = false;
    els.authBtn.classList.add('hidden');
    els.authStatus.textContent = 'Supabase est configuré mais le module de connexion est indisponible. L’application reste en lecture seule.';
    setEditMode();
    return;
  }

  supabaseClient = window.supabase.createClient(cfg.url, cfg.publishableKey);
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) console.error(error);
  isAdmin = Boolean(data?.session?.user);
  els.authBtn.classList.remove('hidden');
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    isAdmin = Boolean(session?.user);
    setEditMode();
  });
  setEditMode();
}

function setEditMode() {
  const editable = canEdit();
  document.body.classList.toggle('readonly-mode', !editable);
  document.querySelectorAll('[data-editable]').forEach(el => { el.disabled = !editable; });
  const model = getModelForVariety(els.variety?.value || activeParcel()?.variety || 'other');
  if (els.baseTemp) els.baseTemp.disabled = !editable || model.fixedBase;
  if (els.editStatus) {
    els.editStatus.classList.toggle('hidden', editable && !supabaseConfigured);
    els.editStatus.textContent = editable ? 'Édition SudExpé' : 'Lecture seule';
  }
  if (els.dataModeBadge) {
    els.dataModeBadge.textContent = supabaseConfigured ? (isAdmin ? 'Supabase · Édition SudExpé' : 'Supabase · Lecture seule') : 'Mode local';
  }
  if (els.authBtn && supabaseConfigured) els.authBtn.textContent = isAdmin ? 'Compte SudExpé' : 'Connexion SudExpé';
  if (els.loginBtn) els.loginBtn.classList.toggle('hidden', isAdmin);
  if (els.logoutBtn) els.logoutBtn.classList.toggle('hidden', !isAdmin);
  if (els.syncLocalBtn) els.syncLocalBtn.classList.toggle('hidden', !isAdmin);
  if (els.authStatus) {
    els.authStatus.textContent = supabaseConfigured
      ? (supabaseClient
          ? (isAdmin ? 'Connecté : les modifications sont enregistrées dans Supabase.' : 'Consultation publique : connectez-vous avec un compte SudExpé pour modifier les données.')
          : 'Supabase est configuré mais le module de connexion est indisponible. L’application reste en lecture seule.')
      : 'Supabase n’est pas configuré : les données restent dans ce navigateur.';
  }
  renderObservations();
}

async function loginSupabase() {
  if (!supabaseClient) return toast('Supabase n’est pas configuré.');
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) return toast('Renseignez l’e-mail et le mot de passe.');
  els.loginBtn.disabled = true;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  els.loginBtn.disabled = false;
  if (error) return toast(`Connexion impossible : ${error.message}`);
  isAdmin = true;
  setEditMode();
  await loadRemoteData();
  renderExploitationSelect();
  renderParcelSelect();
  loadParcelIntoForm();
  loadCachedWeather();
  refreshWeather(false);
  toast('Connexion SudExpé réussie.');
}

async function logoutSupabase() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  isAdmin = false;
  setEditMode();
  els.authPanel.classList.add('hidden');
  toast('Déconnecté.');
}

async function loadRemoteData() {
  if (!supabaseClient) return;
  const [{ data: parcels, error: parcelError }, { data: observations, error: obsError }] = await Promise.all([
    supabaseClient.from('parcels').select('*').order('exploitation').order('name'),
    supabaseClient.from('observations').select('*').order('obs_date')
  ]);
  if (parcelError || obsError) {
    console.error(parcelError || obsError);
    els.authStatus.textContent = `Connexion Supabase établie, mais les tables ne sont pas encore accessibles. Exécutez le fichier supabase-schema.sql.`;
    return;
  }
  if (!parcels?.length) return;
  const obsByParcel = new Map();
  (observations || []).forEach(o => {
    if (!obsByParcel.has(o.parcel_id)) obsByParcel.set(o.parcel_id, []);
    obsByParcel.get(o.parcel_id).push({ date: o.obs_date, stage: o.stage });
  });
  const previousId = state.activeParcelId;
  state.parcels = parcels.map(row => ({
    id: row.id,
    exploitation: row.exploitation,
    name: row.name,
    variety: row.variety === 'opale' ? 'opal' : row.variety,
    stageCDate: row.stage_c_date || '',
    baseTemp: Number(row.base_temp ?? DEFAULT_BASE_TEMP),
    weatherLocation: normalizeLocation({
      name: row.weather_location_name,
      admin1: row.weather_admin1,
      country: row.weather_country,
      latitude: row.latitude,
      longitude: row.longitude,
      elevation: row.elevation,
      timezone: row.timezone
    }),
    observations: obsByParcel.get(row.id) || []
  }));
  state.activeParcelId = state.parcels.some(p => p.id === previousId) ? previousId : state.parcels[0].id;
  normalizeState();
}

function parcelRow(parcel) {
  const loc = normalizeLocation(parcel.weatherLocation || DEFAULT_LOCATION);
  return {
    id: parcel.id,
    exploitation: parcel.exploitation,
    name: parcel.name,
    variety: parcel.variety,
    stage_c_date: parcel.stageCDate || null,
    base_temp: parcel.baseTemp,
    weather_location_name: loc.name,
    weather_admin1: loc.admin1 || null,
    weather_country: loc.country || 'France',
    latitude: loc.latitude,
    longitude: loc.longitude,
    elevation: loc.elevation,
    timezone: loc.timezone || 'Europe/Paris',
    updated_at: new Date().toISOString()
  };
}

async function syncParcelToSupabase(parcel) {
  if (!supabaseClient || !isAdmin) return;
  const { error } = await supabaseClient.from('parcels').upsert(parcelRow(parcel), { onConflict: 'id' });
  if (error) {
    console.error(error);
    toast(`Sauvegarde Supabase impossible : ${error.message}`);
  }
}

async function syncObservationToSupabase(parcelId, observation) {
  if (!supabaseClient || !isAdmin) return;
  const { error } = await supabaseClient.from('observations').upsert({
    parcel_id: parcelId,
    obs_date: observation.date,
    stage: observation.stage,
    updated_at: new Date().toISOString()
  }, { onConflict: 'parcel_id,obs_date' });
  if (error) {
    console.error(error);
    toast(`Observation Supabase non enregistrée : ${error.message}`);
  }
}

async function syncAllLocalToSupabase() {
  if (!supabaseClient || !isAdmin) return toast('Connexion SudExpé nécessaire.');
  els.syncLocalBtn.disabled = true;
  try {
    for (const parcel of state.parcels) {
      await syncParcelToSupabase(parcel);
      for (const obs of parcel.observations || []) await syncObservationToSupabase(parcel.id, obs);
    }
    toast('Données locales envoyées vers Supabase.');
    await loadRemoteData();
    renderExploitationSelect();
    renderParcelSelect();
    loadParcelIntoForm();
  } finally {
    els.syncLocalBtn.disabled = false;
  }
}

function getModelForVariety(varietyId) {
  const variety = VARIETIES.find(v => v.id === varietyId);
  return MODEL_CONFIG[variety?.model] || MODEL_CONFIG.generic;
}

function stagesForModel(model) {
  return STAGE_META.map(stage => ({ ...stage, gdd: Number(model.thresholds[stage.id]) }));
}

function stageById(id) { return STAGE_META.find(stage => stage.id === id); }
function stageForGdd(gdd, stages) {
  const stageList = stages || stagesForModel(MODEL_CONFIG.generic);
  let current = stageList[0];
  for (const stage of stageList) if (gdd >= stage.gdd) current = stage;
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
