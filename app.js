'use strict';

const VERSION = '3.1';
const STORAGE_KEY = 'sam-phenologie-v2.7';
const LEGACY_STORAGE_KEYS = ['sam-phenologie-v2.6', 'sam-phenologie-v2.5', 'sam-phenologie-v2.4', 'sam-phenologie-v2.3', 'sam-phenologie-v1'];
const WEATHER_CACHE_KEY = 'sam-phenologie-weather-v2.7';
const LEGACY_WEATHER_CACHE_KEYS = ['sam-phenologie-weather-v2.6', 'sam-phenologie-weather-v2.5', 'sam-phenologie-weather-v2.4', 'sam-phenologie-weather-cache-v1'];
const REMOTE_CACHE_KEY = 'sam-phenologie-remote-cache-v1';
const OFFLINE_QUEUE_KEY = 'sam-phenologie-offline-observations-v1';
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
    description: 'Le calcul utilise les seuils génériques du pommier, recalables par les observations terrain.',
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
let state = { parcels: [], activeParcelId: null };
let activeWeather = null;
let latestAnalysis = null;
let deferredPrompt = null;
let pendingLocation = null;
let chartHoverState = null;
let supabaseClient = null;
let supabaseConfigured = false;
let isAdmin = false;
let configFormMode = 'edit';
let isSyncingPending = false;

clearLegacyParcelStorage();
window.addEventListener('DOMContentLoaded', init);

async function init() {
  bindElements();
  clearLegacyParcelStorage();
  populateVarieties();
  populateStages();
  bindEvents();
  initOfflineSync();
  initAuthToggle();
  initInstallButton();
  normalizeState();
  registerServiceWorker();
  await initSupabase();
  if (supabaseConfigured) await loadRemoteData();
  if (navigator.onLine) await syncPendingObservations();
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
    'exploitation','parcelName','variety','otherVarietyField','otherVarietyName','baseTemp','varietyInfoText','baseTempInfoText','modelDescription',
    'locationSearch','searchLocationBtn','locationResults','selectedLocation','editStatus','configPanel','configurationBtn','closeConfigBtn','configEyebrow',
    'saveParcelBtn','newParcelBtn','deleteParcelBtn',
    'stageMain','stageBbch','gddTotal','nextStage','nextDate','calibrationNotice',
    'alertsSection','alertsList','observationDate','observationStage','observationPercentage','addObservationBtn','observationsList',
    'refreshBtn','weatherStatus','forecastTableWrap','forecastBody',
    'stageHistoryStatus','stageHistoryWrap','stageHistoryBody',
    'chartCurrentGdd','chartNextThreshold','chartForecastEnd','gddChartStatus','gddChart','chartWrap','chartTooltip',
    'toast','exportStagesBtn',
    'loginForm','loggedInBox','loggedInEmail','authEmail','authPassword','loginBtn','logoutBtn','authStatus','authToggleButton','authCard','installCard','installButton','installMessage'
  ].forEach(id => els[id] = document.getElementById(id));
}

function bindEvents() {
  els.exploitationSelect.addEventListener('change', handleExploitationChange);
  els.parcelSelect.addEventListener('change', async () => {
    state.activeParcelId = els.parcelSelect.value;
    persistState();
    configFormMode = 'edit';
    loadParcelIntoForm();
    if (!els.configPanel.classList.contains('hidden')) updateConfigPanelMode();
    loadCachedWeather();
    await refreshWeather(false);
  });
  els.configurationBtn.addEventListener('click', openConfiguration);
  els.closeConfigBtn.addEventListener('click', closeConfiguration);
  els.saveParcelBtn.addEventListener('click', saveParcelFromForm);
  els.newParcelBtn.addEventListener('click', openNewParcel);
  els.deleteParcelBtn.addEventListener('click', deleteParcel);
  els.addObservationBtn.addEventListener('click', addObservation);
  els.refreshBtn.addEventListener('click', () => refreshWeather(true));
  els.dashboardTabBtn.addEventListener('click', () => switchTab('dashboard'));
  els.historyTabBtn.addEventListener('click', () => switchTab('history'));
  els.exportStagesBtn.addEventListener('click', exportStageTable);
  [...document.querySelectorAll('.info-btn')].forEach(btn => btn.addEventListener('click', () => toggleInfo(btn.dataset.info)));
  els.variety.addEventListener('change', () => updateModelUi(true));
  els.searchLocationBtn.addEventListener('click', searchLocations);
  els.locationSearch.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); searchLocations(); } });
  els.locationResults.addEventListener('change', selectLocationResult);
  els.gddChart.addEventListener('pointermove', handleChartPointer);
  els.gddChart.addEventListener('pointerdown', handleChartPointer);
  els.gddChart.addEventListener('pointerleave', hideChartTooltip);

  els.loginForm.addEventListener('submit', event => {
    event.preventDefault();
    loginSupabase();
  });
  els.logoutBtn.addEventListener('click', logoutSupabase);
  if (els.authToggleButton) {
    els.authToggleButton.addEventListener('click', toggleAuthCard);
  }
  window.addEventListener('resize', () => {
    drawChart();
    syncMobileUi();
  });
}

function isPhoneLayout() {
  return window.matchMedia('(max-width: 720px)').matches;
}

function syncMobileUi() {
  if (!els.authCard || !els.authToggleButton) return;
  if (isPhoneLayout()) {
    const open = els.authCard.classList.contains('open');
    els.authToggleButton.classList.remove('hidden');
    els.authToggleButton.setAttribute('aria-expanded', String(open));
    if (!open) els.authCard.classList.remove('open');
  } else {
    els.authCard.classList.remove('open');
    els.authCard.style.display = '';
    els.authToggleButton.classList.add('hidden');
    els.authToggleButton.setAttribute('aria-expanded', 'false');
  }
}

function toggleAuthCard() {
  if (!els.authCard || !isPhoneLayout()) return;
  const open = els.authCard.classList.toggle('open');
  els.authToggleButton.setAttribute('aria-expanded', String(open));
}

function initAuthToggle() {
  syncMobileUi();
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

function clearLegacyParcelStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Nettoyage du stockage local impossible', error);
  }
}

function persistState() {
  // Les parcelles et observations ont Supabase comme source unique de vérité.
  // Aucun historique de parcelle n'est conservé dans le navigateur.
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
    p.customVarietyName = p.customVarietyName || '';
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
  if (!values.length) {
    els.exploitationSelect.innerHTML = '<option value="">Aucune exploitation</option>';
    els.exploitationSelect.disabled = true;
    return;
  }
  els.exploitationSelect.disabled = false;
  els.exploitationSelect.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  els.exploitationSelect.value = values.includes(current) ? current : values[0];
}

function renderParcelSelect() {
  const exploitation = els.exploitationSelect.value || activeParcel()?.exploitation || '';
  const parcels = state.parcels.filter(p => p.exploitation === exploitation);
  if (!parcels.length) {
    els.parcelSelect.innerHTML = '<option value="">Aucune parcelle</option>';
    els.parcelSelect.disabled = true;
    state.activeParcelId = null;
    return;
  }
  els.parcelSelect.disabled = false;
  els.parcelSelect.innerHTML = parcels.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  let selected = parcels.find(p => p.id === state.activeParcelId) || parcels[0];
  state.activeParcelId = selected.id;
  els.parcelSelect.value = selected.id;
}

async function handleExploitationChange() {
  const parcels = state.parcels.filter(p => p.exploitation === els.exploitationSelect.value);
  if (!parcels.length) return;
  state.activeParcelId = parcels[0].id;
  persistState();
  renderParcelSelect();
  configFormMode = 'edit';
  loadParcelIntoForm();
  if (!els.configPanel.classList.contains('hidden')) updateConfigPanelMode();
  loadCachedWeather();
  await refreshWeather(false);
}

function loadParcelIntoForm() {
  const p = activeParcel();
  if (!p) {
    els.exploitation.value = '';
    els.parcelName.value = '';
    els.variety.value = 'gala';
    els.otherVarietyName.value = '';
    els.baseTemp.value = MODEL_CONFIG.gala.baseTemp;
    els.activeVariety.textContent = '—';
    els.activeWeatherLocation.textContent = '—';
    els.activeStart.textContent = '—';
    els.observationsList.innerHTML = '<p class="hint">Aucune parcelle enregistrée.</p>';
    activeWeather = null;
    latestAnalysis = null;
    resetDashboard('Aucune parcelle enregistrée');
    renderStageHistory(null);
    drawChart();
    setEditMode();
    return;
  }
  els.exploitation.value = p.exploitation || '';
  els.parcelName.value = p.name || '';
  els.variety.value = p.variety || 'other';
  els.otherVarietyName.value = p.customVarietyName || '';
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
  const isOther = variety.id === 'other';
  els.otherVarietyField.classList.toggle('hidden', !isOther);
  if (!isOther && resetBase) els.otherVarietyName.value = '';
  if (model.fixedBase) {
    els.baseTemp.value = model.baseTemp;
    els.baseTemp.disabled = true;
  } else {
    els.baseTemp.disabled = !canEdit();
    if (resetBase) els.baseTemp.value = DEFAULT_BASE_TEMP;
  }

  els.modelDescription.textContent = model.fixedBase
    ? 'Le calcul utilise les seuils variétaux intégrés pour cette variété, recalables par les observations terrain.'
    : 'Le calcul utilise les seuils génériques du pommier, recalables par les observations terrain.';
  els.varietyInfoText.textContent = model.fixedBase
    ? `${variety.label} dispose d’un modèle variétal intégré.`
    : 'En l’absence de modèle variétal validé et compatible avec tous les stades suivis, le calcul utilise le modèle générique du pommier.';
  els.baseTempInfoText.textContent = model.fixedBase
    ? `Le modèle scientifique de ${variety.label} utilise une température de base de ${String(model.baseTemp).replace('.', ',')} °C (43 °F). Cette valeur est imposée pour conserver la cohérence avec les seuils variétaux publiés.`
    : 'La température de base est le seuil sous lequel le développement du pommier est considéré comme très faible. La valeur de 5 °C est utilisée pour calculer simplement l’accumulation de chaleur depuis le stade C.';
}

function updateActiveSummary() {
  const p = activeParcel();
  if (!p) return;
  const variety = p.variety === 'other' ? (p.customVarietyName || 'Autre variété') : (VARIETIES.find(v => v.id === p.variety)?.label || '—');
  const loc = normalizeLocation(p.weatherLocation || DEFAULT_LOCATION);
  els.activeVariety.textContent = variety;
  els.activeWeatherLocation.textContent = locationLabel(loc);
  const stageCDate = getReachedStageCDate(p);
  els.activeStart.textContent = stageCDate ? `Stade C observé le ${formatDate(stageCDate)}` : 'Stade C non renseigné';
}

async function saveParcelFromForm() {
  if (!canEdit()) return toast('Connexion nécessaire pour modifier les données.');

  const exploitation = els.exploitation.value.trim();
  const name = els.parcelName.value.trim();
  if (!exploitation) return toast('Renseignez l’exploitation.');
  if (!name) return toast('Renseignez le nom de la parcelle.');

  const variety = els.variety.value;
  const customVarietyName = variety === 'other' ? els.otherVarietyName.value.trim() : '';
  if (variety === 'other' && !customVarietyName) return toast('Renseignez le nom de la variété.');
  const model = getModelForVariety(variety);
  const wasNew = configFormMode === 'new';
  const current = activeParcel();
  const candidate = {
    id: wasNew ? uid() : current?.id,
    exploitation,
    name,
    variety,
    customVarietyName,
    weatherLocation: normalizeLocation(pendingLocation || DEFAULT_LOCATION),
    baseTemp: model.fixedBase ? model.baseTemp : clampNumber(parseFloat(els.baseTemp.value), 0, 15, DEFAULT_BASE_TEMP),
    observations: current?.observations || []
  };
  if (!candidate.id) return toast('Aucune parcelle active.');

  const saved = await syncParcelToSupabase(candidate);
  if (!saved) return;
  await loadRemoteData();
  if (state.parcels.some(p => p.id === candidate.id)) state.activeParcelId = candidate.id;
  renderExploitationSelect();
  renderParcelSelect();
  configFormMode = 'edit';
  loadParcelIntoForm();
  closeConfiguration();
  loadCachedWeather();
  await refreshWeather(true);
  toast(wasNew ? 'Nouvelle parcelle enregistrée.' : 'Parcelle enregistrée.');
}

function openConfiguration() {
  configFormMode = 'edit';
  switchTab('dashboard');
  loadParcelIntoForm();
  updateConfigPanelMode();
  els.configPanel.classList.remove('hidden');
  els.configPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openNewParcel() {
  if (!canEdit()) return toast('Connexion nécessaire pour créer une parcelle.');
  configFormMode = 'new';
  switchTab('dashboard');
  els.exploitation.value = els.exploitationSelect.value || '';
  els.parcelName.value = '';
  els.variety.value = 'gala';
  els.otherVarietyName.value = '';
  pendingLocation = { ...DEFAULT_LOCATION };
  els.locationSearch.value = '';
  els.locationResults.classList.add('hidden');
  renderSelectedLocation();
  updateModelUi(true);
  updateConfigPanelMode();
  els.configPanel.classList.remove('hidden');
  els.configPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setEditMode();
}

function closeConfiguration() {
  els.configPanel.classList.add('hidden');
  configFormMode = 'edit';
  loadParcelIntoForm();
}

function updateConfigPanelMode() {
  const isNew = configFormMode === 'new';
  const title = document.getElementById('config-title');
  if (els.configEyebrow) els.configEyebrow.textContent = isNew ? 'Nouvelle parcelle' : 'Configuration';
  if (title) title.textContent = isNew ? 'Paramètres de la nouvelle parcelle' : 'Paramètres de la parcelle active';
  els.saveParcelBtn.textContent = isNew ? 'Enregistrer la nouvelle parcelle' : 'Enregistrer les modifications';
  els.deleteParcelBtn.classList.toggle('hidden', isNew);
}

async function deleteParcel() {
  if (!canEdit()) return toast('Connexion nécessaire pour supprimer une parcelle.');
  const id = state.activeParcelId;
  if (!id) return toast('Aucune parcelle à supprimer.');
  const { error } = await supabaseClient.from('parcels').delete().eq('id', id);
  if (error) return toast(`Suppression impossible : ${error.message}`);
  await loadRemoteData();
  renderExploitationSelect();
  renderParcelSelect();
  loadParcelIntoForm();
  if (state.parcels.length) {
    loadCachedWeather();
    await refreshWeather(false);
  }
  toast('Parcelle supprimée.');
}

async function addObservation() {
  if (!canEdit()) return toast('Connexion nécessaire pour ajouter une observation.');
  const p = activeParcel();
  if (!p) return toast('Aucune parcelle active.');
  const date = els.observationDate.value;
  const stage = els.observationStage.value;
  const percentage = Number(els.observationPercentage.value || 50);
  if (!date) return toast('Choisissez une date.');
  if (![25, 50, 75].includes(percentage)) return toast('Pourcentage invalide.');

  const observation = { date, stage, percentage };
  if (!navigator.onLine) {
    queueOfflineObservation(p.id, observation);
    mergePendingIntoState();
    loadParcelIntoForm();
    updateSyncBadge();
    toast('Observation enregistrée hors connexion.');
    return;
  }

  const obsSaved = await syncObservationToSupabase(p.id, observation, { queueOnNetworkError: true });
  if (!obsSaved) return;
  await loadRemoteData();
  renderExploitationSelect();
  renderParcelSelect();
  loadParcelIntoForm();
  loadCachedWeather();
  await refreshWeather(true);
  updateSyncBadge();
  toast('Observation ajoutée.');
}

async function removeObservation(id) {
  if (!canEdit()) return toast('Connexion nécessaire pour supprimer une observation.');
  const p = activeParcel();
  if (!p || !id) return;

  if (String(id).startsWith('offline_')) {
    removePendingObservation(id);
    mergePendingIntoState();
    loadParcelIntoForm();
    updateSyncBadge();
    toast('Observation hors connexion supprimée.');
    return;
  }

  if (!navigator.onLine) return toast('La suppression d’une observation déjà synchronisée nécessite une connexion.');
  const { error } = await supabaseClient.from('observations').delete().eq('id', id).eq('parcel_id', p.id);
  if (error) return toast(`Suppression impossible : ${error.message}`);
  await loadRemoteData();
  renderExploitationSelect();
  renderParcelSelect();
  loadParcelIntoForm();
  loadCachedWeather();
  await refreshWeather(true);
}

function renderObservations() {
  const p = activeParcel();
  const obs = [...(p?.observations || [])].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate) return byDate;
    return (b.percentage || 50) - (a.percentage || 50);
  });
  const editable = canEdit();
  els.observationsList.innerHTML = obs.length ? obs.map(o => {
    const stage = stageById(o.stage);
    const percentage = Number(o.percentage || 50);
    const del = editable ? `<button type="button" data-id="${o.id}" aria-label="Supprimer">✕</button>` : '<span></span>';
    const pending = o.pending ? '<em class="sync-pending-label">À synchroniser</em>' : '';
    return `<div class="observation-row ${o.pending ? 'pending-sync' : ''}"><span>${formatDate(o.date)}</span><strong>${percentage} % · ${stage ? stage.label : escapeHtml(o.stage)}${pending}</strong>${del}</div>`;
  }).join('') : '<p class="hint">Aucune observation enregistrée.</p>';
  if (editable) {
    els.observationsList.querySelectorAll('button[data-id]').forEach(btn => btn.addEventListener('click', () => removeObservation(btn.dataset.id)));
  }
}

function getReachedStageCDate(parcel) {
  const observation = [...(parcel?.observations || [])]
    .filter(o => o.stage === 'C' && Number(o.percentage || 50) === 50)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return observation?.date || null;
}

function getThermalStartDate(parcel) {
  const firstCObservation = [...(parcel?.observations || [])]
    .filter(o => o.stage === 'C')
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return firstCObservation?.date || null;
}

function observationTargetGdd(observation, stages) {
  const index = stages.findIndex(stage => stage.id === observation.stage);
  if (index < 0) return null;
  const percentage = Number(observation.percentage || 50);
  const current = stages[index].gdd;
  if (percentage === 50) return current;
  if (percentage === 25) {
    if (index === 0) return current;
    return stages[index - 1].gdd + (current - stages[index - 1].gdd) * 0.5;
  }
  if (percentage === 75) {
    if (index === stages.length - 1) return current;
    return current + (stages[index + 1].gdd - current) * 0.5;
  }
  return current;
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
  if (!canEdit()) return toast('Connexion nécessaire pour modifier la localisation.');
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
  const start = getThermalStartDate(p) || `${currentYear}${FALLBACK_START}`;
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
  const start = getThermalStartDate(parcel) || `${new Date().getFullYear()}${FALLBACK_START}`;
  const baseTemp = model.fixedBase ? model.baseTemp : clampNumber(Number(parcel.baseTemp), 0, 15, DEFAULT_BASE_TEMP);
  const filtered = weather.filter(w => w.date >= start);

  const observations = [...(parcel.observations || [])]
    .filter(o => stageById(o.stage) && [25, 50, 75].includes(Number(o.percentage || 50)))
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate) return byDate;
      return observationTargetGdd(a, stages) - observationTargetGdd(b, stages);
    });

  // 1) Courbe thermique brute issue uniquement de la météo.
  let rawCumulative = 0;
  const rawTimeline = filtered.map(day => {
    const gdd = computeGdd(day.min, day.max, baseTemp);
    rawCumulative += gdd;
    return { ...day, gdd, rawCumulative };
  });

  // 2) Les observations deviennent des points d'ancrage fixes.
  // Si plusieurs observations existent le même jour, le 50 % est prioritaire
  // pour l'ancrage de la courbe (une courbe ne peut pas passer par deux Y différents
  // pour une même date). Toutes les observations restent néanmoins affichées/exportées.
  const anchorsByDate = new Map();
  observations.forEach(obs => {
    const pointIndex = rawTimeline.findIndex(day => day.date === obs.date);
    if (pointIndex < 0) return;
    const target = observationTargetGdd(obs, stages);
    if (target == null) return;
    const candidate = {
      date: obs.date,
      target,
      raw: rawTimeline[pointIndex].rawCumulative,
      index: pointIndex,
      observation: obs
    };
    const existing = anchorsByDate.get(obs.date);
    if (!existing) {
      anchorsByDate.set(obs.date, candidate);
      return;
    }
    const candidatePct = Number(obs.percentage || 50);
    const existingPct = Number(existing.observation.percentage || 50);
    if (candidatePct === 50 || (existingPct !== 50 && Math.abs(candidatePct - 50) < Math.abs(existingPct - 50))) {
      anchorsByDate.set(obs.date, candidate);
    }
  });

  const anchors = [...anchorsByDate.values()].sort((a, b) => a.index - b.index);
  const adjusted = new Array(rawTimeline.length).fill(null);

  // Avant le premier point observé : on recalcule les estimations pour rejoindre
  // exactement ce premier point, puisqu'aucun stade antérieur n'est encore verrouillé.
  if (anchors.length) {
    const first = anchors[0];
    if (first.index === 0) {
      adjusted[0] = Math.max(0, first.target);
    } else if (first.raw > 0 && first.target > 0) {
      const factor = first.target / first.raw;
      for (let i = 0; i <= first.index; i++) {
        adjusted[i] = Math.max(0, rawTimeline[i].rawCumulative * factor);
      }
      adjusted[first.index] = Math.max(0, first.target);
    } else {
      // Cas typique du stade C à 50 % (seuil 0 DJ) : on conserve la forme brute
      // puis on translate progressivement jusqu'au point observé sans passer sous 0.
      const rawAtAnchor = first.raw;
      for (let i = 0; i <= first.index; i++) {
        const progress = first.index ? i / first.index : 1;
        const correction = (first.target - rawAtAnchor) * progress;
        adjusted[i] = Math.max(0, rawTimeline[i].rawCumulative + correction);
      }
      adjusted[first.index] = Math.max(0, first.target);
    }

    // Entre deux observations : interpolation recalibrée. Les deux points observés
    // restent strictement fixes et seules les estimations situées entre eux bougent.
    for (let a = 0; a < anchors.length - 1; a++) {
      const left = anchors[a];
      const right = anchors[a + 1];
      const rawSpan = right.raw - left.raw;
      const targetSpan = right.target - left.target;
      const indexSpan = Math.max(1, right.index - left.index);

      adjusted[left.index] = Math.max(0, left.target);
      for (let i = left.index + 1; i < right.index; i++) {
        let fraction;
        if (rawSpan > 0) {
          fraction = (rawTimeline[i].rawCumulative - left.raw) / rawSpan;
        } else {
          fraction = (i - left.index) / indexSpan;
        }
        fraction = Math.max(0, Math.min(1, fraction));
        adjusted[i] = Math.max(0, left.target + targetSpan * fraction);
      }
      adjusted[right.index] = Math.max(0, right.target);
    }

    // Après le dernier point observé : on prolonge avec le rythme de calibration
    // du segment observé le plus récent. S'il n'existe pas encore de segment fiable,
    // on reprend une accumulation 1:1 à partir du dernier point fixe.
    const last = anchors[anchors.length - 1];
    let futureFactor = 1;
    for (let a = anchors.length - 2; a >= 0; a--) {
      const prev = anchors[a];
      const rawSpan = last.raw - prev.raw;
      const targetSpan = last.target - prev.target;
      if (rawSpan > 0 && targetSpan > 0) {
        futureFactor = targetSpan / rawSpan;
        break;
      }
    }
    for (let i = last.index + 1; i < rawTimeline.length; i++) {
      adjusted[i] = Math.max(0, last.target + (rawTimeline[i].rawCumulative - last.raw) * futureFactor);
    }
  } else {
    // Aucun point terrain : courbe météo brute.
    rawTimeline.forEach((day, i) => { adjusted[i] = day.rawCumulative; });
  }

  const timeline = rawTimeline.map((day, i) => ({
    ...day,
    cumulative: adjusted[i] == null ? day.rawCumulative : adjusted[i],
    isObservedAnchor: anchors.some(anchor => anchor.index === i)
  }));

  const observedFinalDate = observations.find(o => o.stage === lastStage.id && Number(o.percentage || 50) === 50)?.date || null;
  const estimatedFinalDate = timeline.find(d => d.cumulative >= lastStage.gdd)?.date || null;
  const finalReachedDate = [observedFinalDate, estimatedFinalDate].filter(Boolean).sort()[0] || null;
  const truncatedTimeline = finalReachedDate ? timeline.filter(d => d.date <= finalReachedDate) : timeline;

  const stageDates = {};
  stages.forEach(stage => {
    const observed50 = observations.find(o => o.stage === stage.id && Number(o.percentage || 50) === 50);
    if (observed50) {
      stageDates[stage.id] = { date: observed50.date, origin: 'Observation' };
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
  if (anchors.length === 1) {
    const obs = anchors[0].observation;
    notice = `Estimation recalée sur l’observation du ${formatDate(obs.date)} (${obs.percentage || 50} % · ${stageById(obs.stage).label}).`;
  } else if (anchors.length > 1) {
    notice = `Courbe recalée sur ${anchors.length} points observés. Les points observés restent fixes et les estimations intermédiaires sont recalculées.`;
  }

  return {
    parcel,
    model,
    stages,
    lastStage,
    baseTemp,
    start,
    observations,
    anchors,
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

  // Points terrain dessinés en dernier pour rester visibles au-dessus des axes et de la courbe.
  latestAnalysis.observations.forEach(obs => {
    const point = data.find(d => d.date === obs.date);
    const target = observationTargetGdd(obs, latestAnalysis.stages);
    if (!point || target == null) return;
    ctx.save();
    ctx.fillStyle = '#D31145';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(80, 0, 24, .22)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x(obs.date), y(target), 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

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
  const observedToday = chartHoverState.analysis.observations.filter(o => o.date === nearest.date);
  const observedText = observedToday.length
    ? `<br>${observedToday.map(o => `Observation : ${o.percentage || 50} % · ${stageById(o.stage)?.label || o.stage}`).join('<br>')}`
    : '';
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

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function initInstallButton() {
  if (!els.installCard || !els.installButton || !els.installMessage) return;

  const showMessage = (text) => {
    if (!text) {
      els.installMessage.textContent = '';
      els.installMessage.classList.add('hidden');
      return;
    }
    els.installMessage.textContent = text;
    els.installMessage.classList.remove('hidden');
  };

  const updateInstallVisibility = () => {
    if (isStandaloneApp() || !isPhoneLayout()) {
      els.installCard.classList.add('hidden');
    } else {
      els.installCard.classList.remove('hidden');
    }
  };

  updateInstallVisibility();
  window.addEventListener('resize', updateInstallVisibility);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallVisibility();
  });

  els.installButton.addEventListener('click', async () => {
    if (isStandaloneApp()) {
      els.installCard.classList.add('hidden');
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === 'accepted') {
        showMessage('Installation lancée…');
      }
      return;
    }

    if (isIosDevice()) {
      showMessage('Sur iPhone : Safari → Partager → Sur l’écran d’accueil.');
      return;
    }

    showMessage('Dans le menu du navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    els.installCard.classList.add('hidden');
    showMessage('');
    toast('SAM Phéno est installée.', 3000);
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Service worker non enregistré', error));
  }
}

function weatherCacheKey(parcel) {
  const loc = normalizeLocation(parcel?.weatherLocation || DEFAULT_LOCATION);
  const start = getThermalStartDate(parcel) || `${new Date().getFullYear()}${FALLBACK_START}`;
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

function exportStageTable() {
  const parcel = activeParcel();
  if (!parcel) return toast('Aucune parcelle active.');
  if (!latestAnalysis) return toast('Aucune donnée phénologique à exporter.');

  const observations = parcel.observations || [];
  const rows = [];
  latestAnalysis.stages.forEach(stage => {
    [25, 50, 75].forEach(percentage => {
      const observed = observations.find(o => o.stage === stage.id && Number(o.percentage || 50) === percentage);
      const target = observationTargetGdd({ stage: stage.id, percentage }, latestAnalysis.stages);
      const estimated = target == null ? null : latestAnalysis.timeline.find(day => day.cumulative >= target);
      const date = observed?.date || estimated?.date || '';
      const origin = observed ? 'Observée' : (date ? 'Estimée' : '');
      rows.push({ percentage, stage, date, origin });
    });
  });

  const variety = parcel.variety === 'other'
    ? (parcel.customVarietyName || 'Autre variété')
    : (VARIETIES.find(v => v.id === parcel.variety)?.label || parcel.variety);
  const header = ['Exploitation','Parcelle','Variété','Pourcentage de bourgeons atteints','Stade','BBCH','Date','Origine'];
  const csvRows = [header, ...rows.map(row => [
    parcel.exploitation || '',
    parcel.name || '',
    variety,
    `${row.percentage} %`,
    row.stage.label,
    row.stage.bbch,
    row.date ? formatDate(row.date) : '',
    row.origin
  ])];
  const csv = csvRows.map(row => row.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeParcel = (parcel.name || 'parcelle').replace(/[^a-z0-9_-]+/gi, '_');
  link.href = url;
  link.download = `SAM_Phenologie_${safeParcel}_stades.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function canEdit() {
  return supabaseConfigured && isAdmin;
}

async function initSupabase() {
  const cfg = window.SAM_SUPABASE || {};
  const usable = cfg.url && cfg.publishableKey && !cfg.url.includes('VOTRE_') && !cfg.publishableKey.includes('VOTRE_');
  if (!usable) {
    supabaseConfigured = false;
    isAdmin = false;
    supabaseClient = null;
    els.authStatus.textContent = 'Supabase n’est pas encore configuré. Renseignez Project URL et Publishable key dans supabase-config.js.';
    setEditMode();
    return;
  }

  supabaseConfigured = true;
  if (!window.supabase?.createClient) {
    isAdmin = false;
    supabaseClient = null;
    els.authStatus.textContent = 'Supabase est configuré mais le module de connexion n’a pas pu être chargé. L’application reste en lecture seule.';
    setEditMode();
    return;
  }

  supabaseClient = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) console.error(error);
  isAdmin = Boolean(data?.session?.user);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    const wasAdmin = isAdmin;
    isAdmin = Boolean(session?.user);
    setEditMode();
    if (!wasAdmin && isAdmin) {
      setTimeout(async () => {
        await loadRemoteData();
        renderExploitationSelect();
        renderParcelSelect();
        loadParcelIntoForm();
        loadCachedWeather();
        refreshWeather(false);
        syncPendingObservations();
      }, 0);
    }
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
    els.editStatus.textContent = editable ? 'Édition' : 'Lecture seule';
  }
  updateSyncBadge();

  if (els.loginForm) els.loginForm.classList.toggle('hidden', isAdmin);
  if (els.loggedInBox) els.loggedInBox.classList.toggle('hidden', !isAdmin);
  if (els.loggedInEmail) els.loggedInEmail.textContent = isAdmin ? 'Connecté' : '—';
  if (isAdmin && supabaseClient) {
    supabaseClient.auth.getUser().then(({ data }) => {
      if (els.loggedInEmail) els.loggedInEmail.textContent = data?.user?.email || 'Connecté';
    }).catch(() => {});
  }
  if (els.newParcelBtn) els.newParcelBtn.classList.toggle('hidden', !editable);
  if (els.configurationBtn) els.configurationBtn.classList.toggle('hidden', !editable);

  if (supabaseConfigured && !isAdmin) {
    els.dashboardTabBtn.classList.add('hidden');
    switchTab('history');
  } else {
    els.dashboardTabBtn.classList.remove('hidden');
  }

  if (els.authStatus) {
    const message = supabaseConfigured ? '' : 'Connexion indisponible';
    els.authStatus.textContent = message;
    els.authStatus.classList.toggle('hidden', !message);
  }
  renderObservations();
}

async function loginSupabase() {
  if (!supabaseConfigured || !supabaseClient) return toast('Configurez d’abord Supabase dans supabase-config.js.');
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email) return toast('Renseignez votre adresse mail.');
  if (!password) return toast('Renseignez votre mot de passe.');

  els.loginBtn.disabled = true;
  els.loginBtn.textContent = 'Connexion…';
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  els.loginBtn.disabled = false;
  els.loginBtn.textContent = 'Connexion';

  if (error) {
    console.error(error);
    els.authPassword.value = '';
    els.authStatus.textContent = 'Lecture seule';
    return toast('Adresse mail ou mot de passe incorrect.');
  }

  isAdmin = Boolean(data?.session?.user);
  els.authPassword.value = '';
  setEditMode();
  switchTab('dashboard');
  await loadRemoteData();
  renderExploitationSelect();
  renderParcelSelect();
  loadParcelIntoForm();
  loadCachedWeather();
  await refreshWeather(false);
  if (els.authCard && isPhoneLayout()) { els.authCard.classList.remove('open'); els.authToggleButton?.setAttribute('aria-expanded', 'false'); }
  await syncPendingObservations();
  toast('Mode édition activé.');
}

async function logoutSupabase() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  isAdmin = false;
  setEditMode();
  els.authEmail.value = '';
  els.authPassword.value = '';
  if (els.authCard && isPhoneLayout()) { els.authCard.classList.remove('open'); els.authToggleButton?.setAttribute('aria-expanded', 'false'); }
  toast('Déconnecté.');
}

async function loadRemoteData() {
  if (!supabaseClient) {
    loadRemoteCache();
    mergePendingIntoState();
    updateSyncBadge();
    return;
  }
  const [{ data: parcels, error: parcelError }, { data: observations, error: obsError }] = await Promise.all([
    supabaseClient.from('parcels').select('*').order('exploitation').order('name'),
    supabaseClient.from('observations').select('*').order('obs_date')
  ]);
  if (parcelError || obsError) {
    console.error(parcelError || obsError);
    const restored = loadRemoteCache();
    mergePendingIntoState();
    updateSyncBadge();
    if (!restored && navigator.onLine) {
      state = { parcels: [], activeParcelId: null };
      activeWeather = null;
      latestAnalysis = null;
      els.authStatus.textContent = `Connexion Supabase établie, mais les tables ne sont pas encore accessibles. Exécutez le fichier supabase-schema.sql.`;
    }
    return;
  }
  const obsByParcel = new Map();
  (observations || []).forEach(o => {
    if (!obsByParcel.has(o.parcel_id)) obsByParcel.set(o.parcel_id, []);
    obsByParcel.get(o.parcel_id).push({ id: o.id, date: o.obs_date, stage: o.stage, percentage: Number(o.bud_percentage || 50) });
  });
  const previousId = state.activeParcelId;
  state.parcels = (parcels || []).map(row => ({
    id: row.id,
    exploitation: row.exploitation,
    name: row.name,
    variety: row.variety === 'opale' ? 'opal' : row.variety,
    customVarietyName: row.custom_variety_name || '',
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
  state.activeParcelId = state.parcels.some(p => p.id === previousId) ? previousId : (state.parcels[0]?.id || null);
  if (!state.parcels.length) {
    activeWeather = null;
    latestAnalysis = null;
  }
  normalizeState();
  saveRemoteCache();
  mergePendingIntoState();
  updateSyncBadge();
}

function parcelRow(parcel) {
  const loc = normalizeLocation(parcel.weatherLocation || DEFAULT_LOCATION);
  return {
    id: parcel.id,
    exploitation: parcel.exploitation,
    name: parcel.name,
    variety: parcel.variety,
    custom_variety_name: parcel.variety === 'other' ? (parcel.customVarietyName || null) : null,
    stage_c_date: getReachedStageCDate(parcel) || null,
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
  if (!supabaseClient || !isAdmin) return false;
  const { error } = await supabaseClient.from('parcels').upsert(parcelRow(parcel), { onConflict: 'id' });
  if (error) {
    console.error(error);
    toast(`Sauvegarde impossible : ${error.message}`);
    return false;
  }
  return true;
}

async function syncObservationToSupabase(parcelId, observation, options = {}) {
  if (!supabaseClient || !isAdmin) return false;
  const { error } = await supabaseClient.from('observations').upsert({
    parcel_id: parcelId,
    obs_date: observation.date,
    stage: observation.stage,
    bud_percentage: Number(observation.percentage || 50),
    updated_at: new Date().toISOString()
  }, { onConflict: 'parcel_id,obs_date,stage,bud_percentage' });
  if (error) {
    console.error(error);
    if (options.queueOnNetworkError && isLikelyNetworkError(error)) {
      queueOfflineObservation(parcelId, observation);
      mergePendingIntoState();
      loadParcelIntoForm();
      updateSyncBadge();
      toast('Réseau indisponible : observation conservée sur le téléphone.');
      return false;
    }
    toast(`Observation non enregistrée : ${error.message}`);
    return false;
  }
  return true;
}


function initOfflineSync() {
  window.addEventListener('online', async () => {
    updateSyncBadge();
    await syncPendingObservations();
    if (state.parcels.length) {
      loadCachedWeather();
      refreshWeather(false);
    }
  });
  window.addEventListener('offline', () => {
    updateSyncBadge();
    toast('Hors connexion : les nouveaux relevés seront conservés sur ce téléphone.');
  });
  updateSyncBadge();
}

function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('File hors connexion illisible', error);
    return [];
  }
}

function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Impossible de sauvegarder le relevé hors connexion', error);
  }
}

function queueOfflineObservation(parcelId, observation) {
  const queue = getOfflineQueue();
  const existing = queue.find(item =>
    item.parcelId === parcelId &&
    item.date === observation.date &&
    item.stage === observation.stage &&
    Number(item.percentage || 50) === Number(observation.percentage || 50)
  );
  if (existing) return existing;
  const item = {
    localId: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    parcelId,
    date: observation.date,
    stage: observation.stage,
    percentage: Number(observation.percentage || 50),
    createdAt: new Date().toISOString()
  };
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

function removePendingObservation(localId) {
  saveOfflineQueue(getOfflineQueue().filter(item => item.localId !== localId));
}

function mergePendingIntoState() {
  const queue = getOfflineQueue();
  state.parcels.forEach(parcel => {
    parcel.observations = (parcel.observations || []).filter(obs => !obs.pending);
    queue.filter(item => item.parcelId === parcel.id).forEach(item => {
      const duplicate = parcel.observations.some(obs =>
        obs.date === item.date &&
        obs.stage === item.stage &&
        Number(obs.percentage || 50) === Number(item.percentage || 50)
      );
      if (!duplicate) {
        parcel.observations.push({
          id: item.localId,
          date: item.date,
          stage: item.stage,
          percentage: Number(item.percentage || 50),
          pending: true
        });
      }
    });
  });
}

function saveRemoteCache() {
  try {
    const clean = {
      savedAt: new Date().toISOString(),
      activeParcelId: state.activeParcelId,
      parcels: state.parcels.map(parcel => ({
        ...parcel,
        observations: (parcel.observations || []).filter(obs => !obs.pending)
      }))
    };
    localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(clean));
  } catch (error) {
    console.warn('Cache des parcelles impossible', error);
  }
}

function loadRemoteCache() {
  try {
    const raw = localStorage.getItem(REMOTE_CACHE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.parcels)) return false;
    state = {
      parcels: cached.parcels,
      activeParcelId: cached.activeParcelId || cached.parcels[0]?.id || null
    };
    normalizeState();
    return true;
  } catch (error) {
    console.warn('Cache des parcelles illisible', error);
    return false;
  }
}

async function syncPendingObservations() {
  if (isSyncingPending || !navigator.onLine || !supabaseClient || !isAdmin) {
    updateSyncBadge();
    return;
  }
  let queue = getOfflineQueue();
  if (!queue.length) {
    updateSyncBadge();
    return;
  }

  isSyncingPending = true;
  updateSyncBadge();
  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    const { error } = await supabaseClient.from('observations').upsert({
      parcel_id: item.parcelId,
      obs_date: item.date,
      stage: item.stage,
      bud_percentage: Number(item.percentage || 50),
      updated_at: new Date().toISOString()
    }, { onConflict: 'parcel_id,obs_date,stage,bud_percentage' });

    if (error) {
      console.error('Synchronisation différée impossible', error);
      remaining.push(item);
      if (isLikelyNetworkError(error)) {
        const currentIndex = queue.indexOf(item);
        remaining.push(...queue.slice(currentIndex + 1));
        break;
      }
    } else {
      synced += 1;
    }
  }

  saveOfflineQueue(dedupeQueue(remaining));
  isSyncingPending = false;

  if (synced > 0) {
    await loadRemoteData();
    renderExploitationSelect();
    renderParcelSelect();
    loadParcelIntoForm();
    if (state.parcels.length) {
      loadCachedWeather();
      await refreshWeather(false);
    }
    toast(`${synced} relevé${synced > 1 ? 's' : ''} synchronisé${synced > 1 ? 's' : ''}.`);
  } else {
    mergePendingIntoState();
    renderObservations();
  }
  updateSyncBadge();
}

function dedupeQueue(queue) {
  const seen = new Set();
  return queue.filter(item => {
    const key = `${item.parcelId}|${item.date}|${item.stage}|${Number(item.percentage || 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateSyncBadge() {
  if (!els.dataModeBadge) return;
  const pendingCount = getOfflineQueue().length;
  if (!navigator.onLine) {
    els.dataModeBadge.textContent = pendingCount
      ? `Hors connexion · ${pendingCount} à synchroniser`
      : 'Hors connexion';
    els.dataModeBadge.classList.remove('hidden');
    els.dataModeBadge.classList.add('offline-badge');
    return;
  }
  if (isSyncingPending) {
    els.dataModeBadge.textContent = 'Synchronisation…';
    els.dataModeBadge.classList.remove('hidden');
    els.dataModeBadge.classList.add('offline-badge');
    return;
  }
  if (pendingCount) {
    els.dataModeBadge.textContent = `${pendingCount} à synchroniser`;
    els.dataModeBadge.classList.remove('hidden');
    els.dataModeBadge.classList.add('offline-badge');
    return;
  }
  els.dataModeBadge.classList.add('hidden');
  els.dataModeBadge.classList.remove('offline-badge');
}

function isLikelyNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return !navigator.onLine ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout');
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
function toast(message, duration = 1800) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => els.toast.classList.remove('show'), duration);
}
