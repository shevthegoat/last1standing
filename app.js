const state = {
  coins: 1000,
  unlockedTiers: new Set(['F']),
  selectedCountry: null,
  selectedCity: null,
  player: {
    territory: 1,
    population: 0,
    militaryCap: 300,
    damageMultiplier: 1,
    defenseMultiplier: 1,
    incomeBonus: 0,
    strength: 300
  },
  enemyHP: 100,
  playerHP: 100,
  inCombat: false
};

const tierOrder = ['F', 'E', 'D', 'C', 'B', 'A'];
const screens = {
  landing: document.getElementById('landing'),
  intro: document.getElementById('intro'),
  selection: document.getElementById('country-selection'),
  map: document.getElementById('map-screen')
};

const playBtn = document.getElementById('play-btn');
const introWord = document.getElementById('intro-word');
const tierGrid = document.getElementById('tier-grid');
const coinCount = document.getElementById('coin-count');
const mapCoins = document.getElementById('map-coins');
const startWarRoom = document.getElementById('start-war-room');
const playerCountryEl = document.getElementById('player-country');
const empireStatsEl = document.getElementById('empire-stats');
const cityPanel = document.getElementById('city-panel');
const declareWarBtn = document.getElementById('declare-war');
const combatModal = document.getElementById('combat-modal');
const combatTitle = document.getElementById('combat-title');
const combatLog = document.getElementById('combat-log');
const playerHpBar = document.getElementById('player-hp');
const enemyHpBar = document.getElementById('enemy-hp');

function showScreen(screenKey) {
  Object.values(screens).forEach((screen) => screen.classList.add('hidden'));
  screens[screenKey].classList.remove('hidden');
}

function synthShot(frequency = 120, duration = 0.18) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + duration);
  gain.gain.setValueAtTime(0.8, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

async function runIntro() {
  showScreen('intro');
  const words = ['LAST', 'ONE', 'STANDING'];
  for (const [i, word] of words.entries()) {
    introWord.classList.remove('show');
    await new Promise((r) => setTimeout(r, 180));
    introWord.textContent = word;
    introWord.classList.add('show');
    synthShot(180 - i * 30, 0.22);
    await new Promise((r) => setTimeout(r, 750));
  }
  showScreen('selection');
  renderCountrySelection();
}

function updateEconomyDisplay() {
  coinCount.textContent = state.coins;
  mapCoins.textContent = state.coins;
}

function renderCountrySelection() {
  updateEconomyDisplay();
  tierGrid.innerHTML = '';
  tierOrder.forEach((tier) => {
    const tierCard = document.createElement('div');
    tierCard.className = 'tier-card';
    const cost = GAME_DATA.tierUnlockCost[tier];
    const isUnlocked = state.unlockedTiers.has(tier);
    tierCard.innerHTML = `<h3>Tier ${tier} ${isUnlocked ? '' : `🔒 (${cost} coins)`}</h3>`;

    if (!isUnlocked && tier !== 'F') {
      const unlockBtn = document.createElement('button');
      unlockBtn.className = 'secondary-btn';
      unlockBtn.textContent = `Unlock Tier ${tier}`;
      unlockBtn.onclick = () => {
        if (state.coins >= cost) {
          state.coins -= cost;
          state.unlockedTiers.add(tier);
          renderCountrySelection();
        }
      };
      tierCard.appendChild(unlockBtn);
    }

    GAME_DATA.countries.filter((country) => country.tier === tier).forEach((country) => {
      const item = document.createElement('div');
      item.className = `country-item ${!isUnlocked ? 'locked' : ''}`;
      if (state.selectedCountry?.code === country.code) item.classList.add('selected');
      item.innerHTML = `<span>${country.flag}</span><span>${country.name} <small>(${country.strength}/1000)</small></span><span>Tier ${tier}</span>`;
      item.onclick = () => {
        if (!isUnlocked) return;
        state.selectedCountry = country;
        startWarRoom.disabled = false;
        renderCountrySelection();
      };
      tierCard.appendChild(item);
    });

    tierGrid.appendChild(tierCard);
  });
}

function derivePlayerBase() {
  const c = state.selectedCountry;
  const countryCities = GAME_DATA.cityCatalog.filter((city) => city.code === c.code);
  const population = countryCities.reduce((sum, city) => sum + city.population, 0);
  state.player.population = population;
  state.player.militaryCap = Math.round(c.strength * 1.1);
  state.player.strength = c.strength;
}

async function setupGlobe() {
  const globeContainer = document.getElementById('globeViz');
  globeContainer.innerHTML = '';
  const Globe = GlobeGL()(globeContainer)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
    .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
    .pointAltitude(0.02)
    .pointRadius(0.2)
    .pointColor(() => '#ff6b57')
    .pointsData(GAME_DATA.cityCatalog)
    .pointLabel((d) => `${d.city}, ${d.country}`)
    .onPointClick(handleCityClick);

  Globe.controls().autoRotate = false;
  Globe.controls().enableZoom = true;
  Globe.pointOfView({ lat: 20, lng: 0, altitude: 1.8 }, 1000);

  const world = await fetch('https://unpkg.com/world-atlas@2/countries-110m.json').then((res) => res.json());
  const countries = topojson.feature(world, world.objects.countries).features;
  Globe
    .polygonsData(countries)
    .polygonCapColor(() => 'rgba(90,120,90,0.15)')
    .polygonSideColor(() => 'rgba(60,60,60,0.08)')
    .polygonStrokeColor(() => 'rgba(180,200,180,0.25)');
}

function handleCityClick(city) {
  state.selectedCity = city;
  const country = GAME_DATA.countries.find((c) => c.code === city.code);
  document.getElementById('city-name').textContent = city.city;
  document.getElementById('city-country').textContent = city.country;
  document.getElementById('city-pop').textContent = city.population.toLocaleString();
  document.getElementById('city-leader').textContent = country?.leader || 'Data pending';
  document.getElementById('city-mil').textContent = country?.strength || 100;
  cityPanel.classList.remove('hidden');
}

function refreshEmpireStats() {
  empireStatsEl.textContent = `Land: ${state.player.territory} | Population: ${state.player.population.toLocaleString()} | Military Cap: ${state.player.militaryCap}`;
  updateEconomyDisplay();
}

function beginCombat() {
  if (!state.selectedCity || state.inCombat) return;
  const enemy = GAME_DATA.countries.find((c) => c.code === state.selectedCity.code);
  if (!enemy || enemy.code === state.selectedCountry.code) return;

  state.inCombat = true;
  state.enemyHP = 100;
  state.playerHP = 100;
  playerHpBar.value = 100;
  enemyHpBar.value = 100;
  combatTitle.textContent = `${state.selectedCountry.name} vs ${enemy.name}`;
  combatLog.textContent = `War declared on ${enemy.name}. Select units to attack.`;
  combatModal.classList.remove('hidden');
}

const unitDamage = { troops: 8, tanks: 15, jets: 20, bombers: 24, missiles: 32 };

function combatRound(unit) {
  if (!state.inCombat || !state.selectedCity) return;
  const enemy = GAME_DATA.countries.find((c) => c.code === state.selectedCity.code);
  const playerDamage = Math.round(unitDamage[unit] * state.player.damageMultiplier + Math.random() * 8);
  const enemyDamage = Math.round((enemy.strength / 90) * (0.7 + Math.random() * 0.6));

  state.enemyHP = Math.max(0, state.enemyHP - playerDamage);
  state.playerHP = Math.max(0, state.playerHP - Math.round(enemyDamage / state.player.defenseMultiplier));

  playerHpBar.value = state.playerHP;
  enemyHpBar.value = state.enemyHP;
  combatLog.textContent = `${unit.toUpperCase()} strike dealt ${playerDamage}. ${enemy.name} countered for ${Math.round(enemyDamage)}.`;

  if (state.enemyHP <= 0 || state.playerHP <= 0) {
    state.inCombat = false;
    if (state.enemyHP <= 0) {
      const reward = Math.round(enemy.strength * 1.35);
      state.coins += reward;
      state.player.territory += 1;
      state.player.population += state.selectedCity.population;
      state.player.militaryCap += Math.round(enemy.strength * 0.12);
      state.player.strength = Math.min(1000, state.player.strength + Math.round(enemy.strength * 0.04));
      combatLog.textContent = `Victory! ${enemy.name} territory captured. +${reward} coins.`;
    } else {
      combatLog.textContent = 'Defeat. Regroup and upgrade your forces.';
    }
    refreshEmpireStats();
  }
}

function applyUpgrade(kind) {
  const costs = { army: 200, tech: 250, industry: 220, defense: 180 };
  if (state.coins < costs[kind]) return;
  state.coins -= costs[kind];

  if (kind === 'army') state.player.strength = Math.min(1000, Math.round(state.player.strength * 1.05));
  if (kind === 'tech') state.player.damageMultiplier = Number((state.player.damageMultiplier * 1.08).toFixed(2));
  if (kind === 'industry') state.player.incomeBonus += 20;
  if (kind === 'defense') state.player.defenseMultiplier = Number((state.player.defenseMultiplier * 1.05).toFixed(2));

  refreshEmpireStats();
}

function startIncomeTick() {
  setInterval(() => {
    if (!state.selectedCountry) return;
    const income = Math.round(40 + state.player.territory * 12 + state.player.population / 4000000 + state.player.incomeBonus);
    state.coins += income;
    updateEconomyDisplay();
  }, 5000);
}

playBtn.addEventListener('click', runIntro);
startWarRoom.addEventListener('click', async () => {
  showScreen('map');
  document.getElementById('upgrade-panel').classList.remove('hidden');
  playerCountryEl.textContent = `Commander: ${state.selectedCountry.flag} ${state.selectedCountry.name}`;
  derivePlayerBase();
  refreshEmpireStats();
  await setupGlobe();
});
declareWarBtn.addEventListener('click', beginCombat);
document.querySelectorAll('.unit-btn').forEach((btn) => btn.addEventListener('click', () => combatRound(btn.dataset.unit)));
document.getElementById('close-combat').addEventListener('click', () => {
  if (!state.inCombat) combatModal.classList.add('hidden');
});
document.querySelectorAll('.upgrade-btn').forEach((btn) => btn.addEventListener('click', () => applyUpgrade(btn.dataset.upgrade)));

startIncomeTick();
renderCountrySelection();
