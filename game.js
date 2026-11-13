(() => {
  'use strict';

  /* ============================================================
     SKYFORCE v2 — arcade vertical shooter
     Canvas 2D, sem dependências.
     ============================================================ */

  let W = 960;         // largura lógica (recalculada conforme a tela)
  const H = 600;       // altura lógica fixa
  const LEVEL_TIME = 24;          // segundos por nível
  const BOSS_EVERY = 3;           // chefão a cada N níveis

  const DIFFICULTIES = {
    facil:   { name: 'Fácil',   lives: 5, spawn: 1.15, speed: 0.80, fire: 1.45, hp: 0.85, boss: 0.80 },
    medio:   { name: 'Médio',   lives: 3, spawn: 0.85, speed: 1.00, fire: 1.00, hp: 1.00, boss: 1.00 },
    dificil: { name: 'Difícil', lives: 2, spawn: 0.58, speed: 1.28, fire: 0.70, hp: 1.25, boss: 1.20 },
  };

  const BOSSES = [
    { name: 'CRUZADOR FERRO',   color: '#ff8a4d', accent: '#ffd9a8', hp: 150, patterns: ['spread', 'minions', 'volley'] },
    { name: 'CEIFADOR SOMBRIO', color: '#b06bff', accent: '#e6c2ff', hp: 230, patterns: ['volley', 'sweep', 'minions'] },
    { name: 'FORTALEZA ÓRBITA', color: '#ff4d70', accent: '#ffc0cb', hp: 320, patterns: ['radial', 'missiles', 'spread'] },
  ];

  const bossScale = () => clamp(W / 960, 0.6, 1);
  const bossTargetY = () => 130 + 88 * bossScale();

  const PICKUP_STYLE = {
    life:      { color: '#62f0b5', label: '+', name: 'VIDA EXTRA' },
    shield:    { color: '#5fdcff', label: '◇', name: 'ESCUDO' },
    weapon:    { color: '#c38aff', label: 'W', name: 'TIRO +1' },
    missile:   { color: '#ffb457', label: 'M', name: 'MÍSSEIS' },
    laser:     { color: '#ff6ad5', label: 'L', name: 'LASER' },
    bomb:      { color: '#ffe066', label: 'B', name: 'BOMBA +1' },
    drone:     { color: '#7ef9d0', label: 'D', name: 'DRONE DE APOIO' },
    overdrive: { color: '#ff9d5c', label: '⚡', name: 'SOBRECARGA' },
  };

  // tiro principal em 3 níveis: 1 canhão -> 2 canhões -> 3 canhões em leque
  const WEAPON_PATTERNS = [
    [{ dx: 0, angle: 0 }],
    [{ dx: -10, angle: -0.035 }, { dx: 10, angle: 0.035 }],
    [{ dx: -16, angle: -0.17 }, { dx: 0, angle: 0 }, { dx: 16, angle: 0.17 }],
  ];
  const WEAPON_COOLDOWN = [0, 0.165, 0.135, 0.11];
  const WEAPON_DAMAGE = [0, 1, 1.15, 1.5];
  const WEAPON_RADIUS = [0, 3.6, 4.0, 4.6];

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const $ = id => document.getElementById(id);

  const canvas = $('game-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  const ui = {
    frame: $('game-frame'), hud: $('game-hud'), menu: $('menu-screen'),
    pause: $('pause-screen'), over: $('gameover-screen'),
    pauseButton: $('pause-button'), soundButton: $('sound-button'), bombButton: $('bomb-button'),
    lives: $('lives'), score: $('score'), level: $('level'), combo: $('combo'), shield: $('shield'),
    finalScore: $('final-score'), finalLevel: $('final-level'), finalDifficulty: $('final-difficulty'),
    bestScore: $('best-score'), newRecord: $('new-record'),
    bossHud: $('boss-hud'), bossName: $('boss-name'), bossFill: $('boss-fill'),
    arsenal: $('arsenal'), weaponLevel: $('weapon-level'),
    missileChip: $('missile-chip'), missileCount: $('missile-count'),
    laserChip: $('laser-chip'), laserTime: $('laser-time'),
    droneChip: $('drone-chip'), droneCount: $('drone-count'),
    overdriveChip: $('overdrive-chip'), overdriveTime: $('overdrive-time'),
    bombCount: $('bomb-count'),
    banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    killCount: $('final-kills'), bossCount: $('final-bosses'),
  };

  if (!ctx) return;

  const numberFormat = new Intl.NumberFormat('pt-BR');
  let selectedDifficulty = 'medio';
  let soundEnabled = true;
  let audio = null;
  let best = { facil: 0, medio: 0, dificil: 0 };
  let lastLives = -1;
  let lastWeapon = -1;
  let lastBombs = -1;

  /* ---------------- records ---------------- */

  try {
    const saved = JSON.parse(localStorage.getItem('skyforce-records') || '{}');
    Object.keys(best).forEach(key => { best[key] = Number(saved[key]) || 0; });
  } catch { /* segue sem armazenamento */ }

  function updateRecords() {
    document.querySelectorAll('[data-record]').forEach(element => {
      const score = best[element.dataset.record];
      element.hidden = !score;
      element.textContent = `RECORDE ${numberFormat.format(score)}`;
    });
  }
  updateRecords();

  /* ---------------- áudio ---------------- */

  let audioCtx = null;
  let musicGain = null;
  let musicTimer = null;
  let musicMood = 'calma';
  let musicStep = 0;
  let musicNextTime = 0;
  let musicNoise = null;

  function getAudio() {
    if (!soundEnabled) return null;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      return audioCtx;
    } catch { return null; }
  }

  function beep(frequency, duration = 0.06, volume = 0.035, type = 'sine') {
    const ac = getAudio();
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.7), ac.currentTime + duration);
      gain.gain.setValueAtTime(volume, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch { /* áudio opcional */ }
  }

  function boom(volume = 0.07) {
    beep(90, 0.28, volume, 'sawtooth');
    beep(54, 0.42, volume * 0.7, 'triangle');
  }

  /* ---------------- trilha sonora adaptativa ----------------
     Três climas: calma (menu e primeiros níveis), suspense (níveis
     médios / pouca vida) e intensa (chefão / reta final).
     Sintetizada na hora, sem arquivos de áudio. */

  const MUSIC_MOODS = {
    calma: {
      bpm: 74, padVol: 0.028, bassVol: 0.040, arpVol: 0.020, hatVol: 0,
      padWave: 'sine', arpWave: 'sine',
      chords: [[0, 7, 12], [-3, 4, 9], [-5, 2, 7], [-7, 0, 5]],
    },
    suspense: {
      bpm: 98, padVol: 0.030, bassVol: 0.048, arpVol: 0.026, hatVol: 0.006,
      padWave: 'triangle', arpWave: 'triangle',
      chords: [[0, 7, 10], [-1, 6, 11], [-3, 4, 9], [-5, 2, 7]],
    },
    intensa: {
      bpm: 134, padVol: 0.026, bassVol: 0.055, arpVol: 0.030, hatVol: 0.018,
      padWave: 'sawtooth', arpWave: 'square',
      chords: [[0, 3, 7], [-2, 5, 10], [-4, 3, 8], [-5, 2, 7]],
    },
  };
  const MUSIC_ROOT = 110;

  function musicBus() {
    const ac = getAudio();
    if (!ac) return null;
    if (!musicGain) {
      musicGain = ac.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(ac.destination);
    }
    return musicGain;
  }

  function musicNote(freq, time, dur, type, vol) {
    const ac = getAudio();
    const bus = musicBus();
    if (!ac || !bus) return;
    try {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      env.gain.setValueAtTime(0.0001, time);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), time + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(env).connect(bus);
      osc.start(time);
      osc.stop(time + dur + 0.04);
    } catch { /* ignora */ }
  }

  function musicHat(time, vol) {
    const ac = getAudio();
    const bus = musicBus();
    if (!ac || !bus || vol <= 0) return;
    try {
      if (!musicNoise) {
        const length = Math.floor(ac.sampleRate * 0.12);
        musicNoise = ac.createBuffer(1, length, ac.sampleRate);
        const data = musicNoise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const src = ac.createBufferSource();
      src.buffer = musicNoise;
      const filter = ac.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6200;
      const env = ac.createGain();
      env.gain.setValueAtTime(vol, time);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
      src.connect(filter).connect(env).connect(bus);
      src.start(time);
      src.stop(time + 0.1);
    } catch { /* ignora */ }
  }

  function musicScheduleStep(ac, mood, time, index, stepDuration) {
    const chord = mood.chords[Math.floor(index / 16) % mood.chords.length];
    const semitone = n => MUSIC_ROOT * Math.pow(2, n / 12);

    // baixo
    if (index % 4 === 0 || index === 6 || index === 11 || index === 14) {
      musicNote(semitone(chord[0] - 12), time, stepDuration * 1.8, 'triangle', mood.bassVol);
    }
    // acorde (pad) no começo de cada compasso
    if (index % 16 === 0) {
      for (const note of chord) {
        musicNote(semitone(note), time, stepDuration * 15, mood.padWave, mood.padVol);
      }
    }
    // arpejo
    if (index % 2 === 0) {
      const arpIndex = (index / 2) % chord.length;
      musicNote(semitone(chord[arpIndex] + 12), time, stepDuration * 1.4, mood.arpWave, mood.arpVol);
    }
    // percussão
    if (index % 8 === 4) musicHat(time, mood.hatVol);
    if (mood.hatVol > 0 && index % 4 === 2) musicHat(time, mood.hatVol * 0.5);
    void ac;
  }

  function musicTick() {
    const ac = getAudio();
    if (!ac) return;
    const mood = MUSIC_MOODS[musicMood] || MUSIC_MOODS.calma;
    const stepDuration = 60 / mood.bpm / 4;
    if (musicNextTime < ac.currentTime) musicNextTime = ac.currentTime + 0.05;
    let guard = 0;
    while (musicNextTime < ac.currentTime + 0.35 && guard < 64) {
      musicScheduleStep(ac, mood, musicNextTime, musicStep % 32, stepDuration);
      musicNextTime += stepDuration;
      musicStep++;
      guard++;
    }
  }

  function musicStart() {
    const ac = getAudio();
    const bus = musicBus();
    if (!ac || !bus) return;
    bus.gain.cancelScheduledValues(ac.currentTime);
    bus.gain.setTargetAtTime(0.65, ac.currentTime, 0.8);
    if (!musicTimer) {
      musicNextTime = ac.currentTime + 0.1;
      musicTimer = setInterval(musicTick, 120);
    }
  }

  function musicStop(fade = 0.5) {
    const ac = getAudio();
    if (musicGain && ac) {
      musicGain.gain.cancelScheduledValues(ac.currentTime);
      musicGain.gain.setTargetAtTime(0.0001, ac.currentTime, fade);
    }
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function musicSetMood(mood) {
    if (MUSIC_MOODS[mood] && mood !== musicMood) {
      musicMood = mood;
      musicStart();
    }
  }

  function musicDuck(quiet) {
    const ac = getAudio();
    if (!ac || !musicGain) return;
    musicGain.gain.setTargetAtTime(quiet ? 0.15 : 0.65, ac.currentTime, 0.25);
  }

  /* ---------------- mundo ---------------- */

  function makeStars() {
    const layers = [];
    for (let layer = 0; layer < 3; layer++) {
      const count = [46, 34, 22][layer];
      const items = [];
      for (let i = 0; i < count; i++) {
        items.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: rand(0.6, 1.3) + layer * 0.55,
          speed: (16 + layer * 30) * rand(0.85, 1.2),
          alpha: 0.20 + layer * 0.22 + Math.random() * 0.18,
        });
      }
      layers.push(items);
    }
    return layers;
  }

  function makeWorld(difficulty = selectedDifficulty, status = 'menu') {
    return {
      status,
      difficulty,
      player: {
        x: W / 2, y: H - 82, cooldown: 0, invincible: 0, shield: 0,
        weapon: 1, missiles: 0, missileCd: 0, laser: 0, laserTick: 0, bombs: 2,
        drones: 0, droneCd: 0, overdrive: 0,
        bank: 0, engine: 0,
      },
      bullets: [], missiles: [], enemyMissiles: [], enemies: [], pickups: [],
      particles: [], rings: [], texts: [], stars: makeStars(),
      keys: new Set(), pointer: { active: false, x: W / 2, y: H - 82 },
      score: 0, lives: DIFFICULTIES[difficulty].lives,
      elapsed: 0, spawn: 0.7, level: 1, levelTimer: 0,
      boss: null, bossCount: 0, bossHudShown: false,
      shake: 0, flash: 0, combo: 1, comboTime: 0, statsClock: 0,
      kills: 0, bannerTime: 0,
    };
  }

  let game = makeWorld();

  /* ---------------- fundo em camadas (cache) ---------------- */

  let bgCanvas = null;

  function buildBackground() {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const g = off.getContext('2d');
    if (!g) return null;

    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#060f1f');
    base.addColorStop(0.45, '#0a1c34');
    base.addColorStop(1, '#050d19');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // nebulosas
    const nebulae = [
      { x: W * 0.18, y: H * 0.22, r: 320, color: '86,72,255', alpha: 0.17 },
      { x: W * 0.82, y: H * 0.58, r: 300, color: '24,150,210', alpha: 0.15 },
      { x: W * 0.52, y: H * 0.92, r: 260, color: '255,90,160', alpha: 0.10 },
    ];
    for (const n of nebulae) {
      const grad = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      grad.addColorStop(0, `rgba(${n.color},${n.alpha})`);
      grad.addColorStop(0.55, `rgba(${n.color},${n.alpha * 0.35})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }

    // planeta distante
    const px = W * 0.83;
    const py = H * 0.20;
    const pr = 128;
    const planet = g.createRadialGradient(px - pr * 0.4, py - pr * 0.45, pr * 0.12, px, py, pr);
    planet.addColorStop(0, 'rgba(96,186,255,0.30)');
    planet.addColorStop(0.62, 'rgba(30,86,140,0.22)');
    planet.addColorStop(1, 'rgba(5,16,30,0)');
    g.fillStyle = planet;
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(120,214,255,0.16)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(px, py, pr * 0.99, 0, Math.PI * 2);
    g.stroke();
    // anel
    g.strokeStyle = 'rgba(120,214,255,0.10)';
    g.lineWidth = 9;
    g.beginPath();
    g.ellipse(px, py + 22, pr * 1.35, pr * 0.30, -0.22, 0, Math.PI * 2);
    g.stroke();

    // grade sutil
    g.strokeStyle = 'rgba(87,170,205,0.035)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

    return off;
  }

  /* ---------------- HUD ---------------- */

  function syncHud() {
    if (ui.score) ui.score.textContent = numberFormat.format(game.score);
    if (ui.level) ui.level.textContent = String(Math.min(99, game.level)).padStart(2, '0');

    if (lastLives !== game.lives) {
      if (ui.lives) ui.lives.textContent = '♥'.repeat(Math.max(0, game.lives));
      lastLives = game.lives;
    }
    if (ui.combo) {
      ui.combo.hidden = game.combo <= 1;
      ui.combo.textContent = `COMBO ×${game.combo}`;
    }
    if (ui.shield) ui.shield.hidden = !game.player.shield;

    if (lastWeapon !== game.player.weapon && ui.weaponLevel) {
      ui.weaponLevel.textContent = `Nv.${game.player.weapon}`;
      lastWeapon = game.player.weapon;
    }
    if (ui.missileChip) {
      ui.missileChip.hidden = game.player.missiles <= 0;
      if (ui.missileCount) ui.missileCount.textContent = game.player.missiles;
    }
    if (ui.laserChip) {
      ui.laserChip.hidden = game.player.laser <= 0;
      if (ui.laserTime) ui.laserTime.textContent = `${Math.ceil(game.player.laser)}s`;
    }
    if (ui.droneChip) {
      ui.droneChip.hidden = game.player.drones <= 0;
      if (ui.droneCount) ui.droneCount.textContent = `×${game.player.drones}`;
    }
    if (ui.overdriveChip) {
      ui.overdriveChip.hidden = game.player.overdrive <= 0;
      if (ui.overdriveTime) ui.overdriveTime.textContent = `${Math.ceil(game.player.overdrive)}s`;
    }
    if (lastBombs !== game.player.bombs && ui.bombCount) {
      ui.bombCount.textContent = game.player.bombs;
      lastBombs = game.player.bombs;
    }
    if (ui.bombButton) ui.bombButton.classList.toggle('is-empty', game.player.bombs <= 0);

    const boss = game.boss;
    if (ui.bossHud) {
      const show = !!boss && boss.state !== 'dying';
      ui.bossHud.hidden = !show;
      if (show) {
        if (ui.bossName) ui.bossName.textContent = boss.name;
        if (ui.bossFill) {
          const pct = clamp(boss.hp / boss.maxHp, 0, 1) * 100;
          ui.bossFill.style.width = `${pct}%`;
          ui.bossFill.style.background = pct > 55 ? boss.accent
            : pct > 25 ? '#ffd166' : '#ff5d7a';
        }
      }
    }
  }

  function syncScreens() {
    const status = game.status;
    if (ui.menu) ui.menu.hidden = status !== 'menu';
    if (ui.pause) ui.pause.hidden = status !== 'paused';
    if (ui.over) ui.over.hidden = status !== 'over';
    if (ui.hud) ui.hud.hidden = status !== 'playing' && status !== 'paused';
    if (ui.pauseButton) {
      ui.pauseButton.hidden = status !== 'playing' && status !== 'paused';
      ui.pauseButton.innerHTML = status === 'paused'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
      const label = status === 'paused' ? 'Continuar' : 'Pausar';
      ui.pauseButton.setAttribute('aria-label', label);
      ui.pauseButton.title = `${label} (P)`;
    }
    if (ui.frame) ui.frame.classList.toggle('is-playing', status === 'playing');
    if (ui.bombButton) ui.bombButton.hidden = status !== 'playing' && status !== 'paused';
    if (ui.banner && status !== 'playing' && status !== 'paused') ui.banner.hidden = true;
    if (ui.bossHud && (status !== 'playing' && status !== 'paused')) ui.bossHud.hidden = true;
    syncHud();
  }

  function announce(title, sub = '') {
    if (!ui.banner) return;
    ui.banner.hidden = false;
    if (ui.bannerTitle) ui.bannerTitle.textContent = title;
    if (ui.bannerSub) ui.bannerSub.textContent = sub;
    ui.banner.classList.remove('show');
    void ui.banner.offsetWidth;
    ui.banner.classList.add('show');
    game.bannerTime = 2.3;
  }

  function hideBanner(dt) {
    if (!ui.banner || ui.banner.hidden) return;
    game.bannerTime -= dt;
    if (game.bannerTime <= 0) {
      ui.banner.hidden = true;
      ui.banner.classList.remove('show');
    }
  }

  /* ---------------- fluxo do jogo ---------------- */

  function changeStatus(status) {
    game.status = status;
    if (status === 'paused') musicDuck(true);
    else if (status === 'playing') musicDuck(false);
    else if (status === 'menu') { musicSetMood('calma'); musicDuck(false); }
    else if (status === 'over') musicStop(0.9);
    game.keys.clear();
    game.pointer.active = false;
    syncScreens();
    if (status === 'paused' && $('resume-button')) $('resume-button').focus();
    if (status === 'over' && $('restart-button')) $('restart-button').focus();
    if (status === 'menu') {
      updateRecords();
      if ($('start-button')) $('start-button').focus();
    }
  }

  function startGame() {
    game = makeWorld(selectedDifficulty, 'playing');
    lastLives = -1;
    lastWeapon = -1;
    lastBombs = -1;
    syncHud();
    syncScreens();
    canvas.focus();
    announce('NÍVEL 1', 'BOA SORTE, PILOTO');
    musicSetMood('calma');
    musicStart();
    beep(520, 0.12, 0.05, 'triangle');
  }

  function togglePause() {
    if (game.status === 'playing') changeStatus('paused');
    else if (game.status === 'paused') changeStatus('playing');
  }

  function finishGame() {
    const previousBest = best[game.difficulty];
    if (game.score > previousBest) {
      best[game.difficulty] = game.score;
      try { localStorage.setItem('skyforce-records', JSON.stringify(best)); } catch { /* opcional */ }
    }
    syncHud();
    if (ui.finalScore) ui.finalScore.textContent = numberFormat.format(game.score);
    if (ui.finalLevel) ui.finalLevel.textContent = game.level;
    if (ui.finalDifficulty) ui.finalDifficulty.textContent = DIFFICULTIES[game.difficulty].name.toLowerCase();
    if (ui.bestScore) ui.bestScore.textContent = numberFormat.format(best[game.difficulty]);
    if (ui.newRecord) ui.newRecord.hidden = game.score <= previousBest || game.score === 0;
    if (ui.killCount) ui.killCount.textContent = game.kills;
    if (ui.bossCount) ui.bossCount.textContent = game.bossCount;
    changeStatus('over');
    boom(0.09);
  }

  /* ---------------- efeitos ---------------- */

  function addParticle(x, y, vx, vy, life, size, color, kind = 'spark') {
    game.particles.push({ x, y, vx, vy, life, maxLife: life, size, color, kind });
  }

  function explode(x, y, color, strength = 1) {
    const count = Math.round(14 * strength);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(40, 210) * strength;
      addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        rand(0.28, 0.7), rand(1.4, 3.6) * Math.min(1.6, strength), color, 'spark');
    }
    for (let i = 0; i < Math.round(5 * strength); i++) {
      const angle = Math.random() * Math.PI * 2;
      addParticle(x, y, Math.cos(angle) * rand(12, 55), Math.sin(angle) * rand(12, 55),
        rand(0.5, 1.1), rand(5, 13), 'rgba(255,255,255,0.16)', 'smoke');
    }
    game.rings.push({ x, y, r: 4, maxR: 34 * strength, life: 0.42, maxLife: 0.42, color });
  }

  function floatText(x, y, text, color) {
    game.texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9, vy: -42 });
  }

  /* ---------------- jogador ---------------- */

  function hitPlayer() {
    const p = game.player;
    if (p.invincible > 0 || game.status !== 'playing') return;
    if (p.shield > 0) {
      p.shield = 0;
      p.invincible = 0.7;
      explode(p.x, p.y, '#63e6ff', 1.1);
      beep(260, 0.15, 0.06, 'triangle');
      floatText(p.x, p.y - 30, 'ESCUDO ROMPIDO', '#63e6ff');
      syncHud();
      return;
    }
    game.lives--;
    p.weapon = Math.max(1, p.weapon - 1);
    p.missiles = 0;
    p.laser = 0;
    p.invincible = 2.1;
    game.shake = 14;
    game.flash = 0.45;
    game.combo = 1;
    explode(p.x, p.y, '#62d9ff', 2);
    beep(110, 0.25, 0.08, 'sawtooth');
    if (game.lives <= 0) finishGame();
    syncHud();
  }

  function firePrimary() {
    const p = game.player;
    const level = clamp(p.weapon, 1, 3);
    const pattern = WEAPON_PATTERNS[level - 1];
    const boost = p.overdrive > 0 ? 1.6 : 1;
    const speed = 620 + level * 30;
    for (const shot of pattern) {
      game.bullets.push({
        x: p.x + shot.dx, y: p.y - 26,
        vx: Math.sin(shot.angle) * speed,
        vy: -Math.cos(shot.angle) * speed,
        radius: WEAPON_RADIUS[level] + (p.overdrive > 0 ? 0.9 : 0),
        damage: WEAPON_DAMAGE[level] * (p.overdrive > 0 ? 1.25 : 1),
        enemy: false, life: 2, power: level,
      });
    }
    p.cooldown = WEAPON_COOLDOWN[level] / boost;
    beep(660 + level * 70, 0.035, 0.016, 'square');
  }

  function fireDrone(drone) {
    const p = game.player;
    const speed = 700;
    game.bullets.push({
      x: drone.x, y: drone.y - 8, vx: 0, vy: -speed,
      radius: 3, damage: 0.8, enemy: false, life: 2, power: 2, drone: true,
    });
    beep(980, 0.028, 0.010, 'triangle');
    void p;
  }

  function nearestEnemyTarget(from) {
    let target = game.boss && game.boss.state === 'fight' ? game.boss : null;
    let bestDist = target ? dist(from, target) : Infinity;
    for (const enemy of game.enemies) {
      const d = dist(from, enemy);
      if (d < bestDist) { bestDist = d; target = enemy; }
    }
    return target;
  }

  function fireMissile() {
    const p = game.player;
    p.missiles--;
    const target = nearestEnemyTarget(p);
    const side = game.missiles.length % 2 === 0 ? -18 : 18;
    game.missiles.push({
      x: p.x + side, y: p.y, vx: side * 3, vy: -180,
      target, life: 3.4, trail: [],
    });
    p.missileCd = 0.55;
    beep(320, 0.09, 0.03, 'triangle');
  }

  function useBomb() {
    const p = game.player;
    if (game.status !== 'playing' || p.bombs <= 0) return;
    p.bombs--;
    game.flash = 0.85;
    game.shake = 18;
    boom(0.1);
    const cleared = game.bullets.filter(b => b.enemy).length + game.enemyMissiles.length;
    game.bullets = game.bullets.filter(b => !b.enemy);
    game.enemyMissiles = [];
    for (const enemy of game.enemies) {
      explode(enemy.x, enemy.y, '#ffe066', 0.7);
      enemy.hp -= 6;
      if (enemy.hp <= 0) killEnemy(enemy, false);
    }
    game.enemies = game.enemies.filter(e => e.hp > 0);
    if (game.boss && game.boss.state === 'fight') {
      game.boss.hp -= 22;
      game.boss.flash = 0.4;
      if (game.boss.hp <= 0) startBossDeath();
    }
    game.rings.push({ x: p.x, y: p.y, r: 10, maxR: 620, life: 0.75, maxLife: 0.75, color: '#ffe066' });
    floatText(p.x, p.y - 40, 'BOMBA!', '#ffe066');
    if (cleared) game.score += cleared * 10;
    syncHud();
  }

  /* ---------------- inimigos ---------------- */

  function availableKinds() {
    const lvl = game.level;
    const kinds = ['scout', 'zigzag'];
    if (lvl >= 2) kinds.push('heavy');
    if (lvl >= 3) kinds.push('diver');
    if (lvl >= 5) kinds.push('sniper');
    return kinds;
  }

  function spawnEnemy(kind) {
    const settings = DIFFICULTIES[game.difficulty];
    const types = kind ? [kind] : availableKinds();
    const pick = types[Math.floor(Math.random() * types.length)];
    const progress = Math.min(1, game.elapsed / 90);
    const x = rand(45, W - 45);
    const levelHp = 1 + (game.level - 1) * 0.10;

    const config = {
      scout:  { hp: 1, radius: 17, speed: 128 },
      zigzag: { hp: 2, radius: 20, speed: 100 },
      heavy:  { hp: 6, radius: 28, speed: 62 },
      diver:  { hp: 2, radius: 18, speed: 96 },
      sniper: { hp: 3, radius: 19, speed: 74 },
    }[pick];

    game.enemies.push({
      x, y: -50, baseX: x,
      vx: rand(-26, 26),
      vy: config.speed * settings.speed * (1 + progress * 0.5),
      radius: config.radius,
      hp: Math.max(1, Math.round(config.hp * settings.hp * levelHp)),
      maxHp: Math.max(1, Math.round(config.hp * settings.hp * levelHp)),
      kind: pick, age: 0,
      fire: rand(1.1, 2.6) * settings.fire,
      hit: 0, phase: Math.random() * Math.PI * 2,
      diving: false,
    });
  }

  function enemyShoot(enemy, angle, speed, radius = 5) {
    game.bullets.push({
      x: enemy.x, y: enemy.y + enemy.radius * 0.5,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius, damage: 1, enemy: true, life: 6, kind: 'orb',
    });
  }

  function killEnemy(enemy, chain = true) {
    const base = enemy.kind === 'heavy' ? 320
      : enemy.kind === 'sniper' ? 200
      : enemy.kind === 'diver' ? 150
      : enemy.kind === 'zigzag' ? 160 : 100;
    if (chain) {
      game.combo = game.comboTime > 0 ? Math.min(9, game.combo + 1) : 1;
      game.comboTime = 2.9;
    }
    const points = base * game.combo;
    game.score += points;
    game.kills++;
    explode(enemy.x, enemy.y, enemy.kind === 'heavy' ? '#ffad66' : '#ff6685', enemy.kind === 'heavy' ? 2 : 1);
    beep(enemy.kind === 'heavy' ? 120 : 190, 0.09, 0.035, 'triangle');
    if (chain && game.combo >= 3) floatText(enemy.x, enemy.y - 12, `+${numberFormat.format(points)}`, '#ffd076');
    dropPickup(enemy.x, enemy.y, enemy.kind === 'heavy' ? 0.52 : 0.17);
  }

  function dropPickup(x, y, chance) {
    if (Math.random() > chance) return;
    const roll = Math.random();
    let kind;
    if (roll < 0.13) kind = 'life';          // vidas extras: presentes, mas raras
    else if (roll < 0.29) kind = 'weapon';
    else if (roll < 0.41) kind = 'shield';
    else if (roll < 0.55) kind = 'missile';
    else if (roll < 0.67) kind = 'laser';
    else if (roll < 0.83) kind = 'bomb';     // bombas ficaram bem mais frequentes
    else if (roll < 0.93) kind = 'drone';
    else kind = 'overdrive';
    game.pickups.push({ x, y, kind, spin: 0, life: 12 });
  }

  function collectPickup(pickup) {
    const p = game.player;
    const style = PICKUP_STYLE[pickup.kind];
    if (pickup.kind === 'life') game.lives = Math.min(7, game.lives + 1);
    if (pickup.kind === 'shield') p.shield = 1;
    if (pickup.kind === 'weapon') p.weapon = Math.min(3, p.weapon + 1);
    if (pickup.kind === 'missile') p.missiles = Math.min(24, p.missiles + 9);
    if (pickup.kind === 'laser') p.laser = Math.min(16, p.laser + 7);
    if (pickup.kind === 'bomb') p.bombs = Math.min(6, p.bombs + 1);
    if (pickup.kind === 'drone') p.drones = Math.min(2, p.drones + 1);
    if (pickup.kind === 'overdrive') p.overdrive = Math.min(12, p.overdrive + 6);
    game.score += 60;
    beep(880, 0.16, 0.045, 'sine');
    explode(pickup.x, pickup.y, style.color, 0.6);
    floatText(pickup.x, pickup.y - 10, style.name, style.color);
    syncHud();
  }

  /* ---------------- chefões ---------------- */

  function bossLevelType() {
    return (game.bossCount + game.level) % BOSSES.length;
  }

  function spawnBoss(nextLevel) {
    const settings = DIFFICULTIES[game.difficulty];
    const template = BOSSES[(game.bossCount + nextLevel) % BOSSES.length];
    const scale = 1 + game.bossCount * 0.55 + nextLevel * 0.04;
    const hp = Math.round(template.hp * settings.boss * scale);

    game.level = nextLevel;
    game.levelTimer = 0;
    game.boss = {
      name: template.name,
      color: template.color,
      accent: template.accent,
      patterns: template.patterns,
      variant: BOSSES.indexOf(template),
      x: W / 2, y: -150, targetY: bossTargetY(),
      hp, maxHp: hp,
      state: 'enter', timer: 0, attackTimer: 1.4, patternIndex: 0,
      phase: 1, flash: 0, sway: 0, beam: null, radius: 74 * bossScale(),
      vx: 0, dyingTimer: 0,
    };
    game.bossCount++;
    announce('CHEFÃO', template.name);
    beep(90, 0.5, 0.08, 'sawtooth');
    syncHud();
  }

  function bossPhaseCheck() {
    const boss = game.boss;
    if (!boss) return;
    const pct = boss.hp / boss.maxHp;
    const phase = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
    if (phase !== boss.phase) {
      boss.phase = phase;
      boss.flash = 0.4;
      game.shake = 10;
      explode(boss.x, boss.y, boss.accent, 1.6);
      announce(`FASE ${phase}`, boss.name);
      beep(180, 0.3, 0.06, 'sawtooth');
    }
  }

  function startBossDeath() {
    const boss = game.boss;
    if (!boss || boss.state === 'dying') return;
    boss.state = 'dying';
    boss.dyingTimer = 1.9;
    boss.hp = 0;
    game.bullets = game.bullets.filter(b => !b.enemy);
    game.enemyMissiles = [];
    game.bossHudShown = false;
    if (ui.bossHud) ui.bossHud.hidden = true;
    syncHud();
  }

  function finishBossDeath() {
    const boss = game.boss;
    if (!boss) return;
    const bonus = 1200 * game.level * Math.max(1, game.combo);
    game.score += bonus;
    explode(boss.x, boss.y, boss.accent, 4);
    explode(boss.x, boss.y, boss.color, 3.4);
    game.rings.push({ x: boss.x, y: boss.y, r: 12, maxR: 420, life: 0.9, maxLife: 0.9, color: boss.accent });
    game.shake = 22;
    game.flash = 0.6;
    boom(0.11);
    floatText(boss.x, boss.y, `+${numberFormat.format(bonus)}`, '#ffe066');
    const bossLoot = ['bomb', 'weapon', 'drone', 'life', 'overdrive'];
    for (let i = 0; i < bossLoot.length; i++) {
      game.pickups.push({
        x: boss.x + rand(-80, 80), y: boss.y + rand(-36, 36),
        kind: bossLoot[i], spin: 0, life: 18,
      });
    }
    game.boss = null;
    game.level = game.level + 1;
    game.levelTimer = 0;
    announce(`NÍVEL ${game.level}`, 'CHEFÃO DESTRUÍDO');
    syncHud();
  }

  function bossAttack() {
    const boss = game.boss;
    const p = game.player;
    const settings = DIFFICULTIES[game.difficulty];
    const pattern = boss.patterns[boss.patternIndex % boss.patterns.length];
    boss.patternIndex++;
    boss.flash = 0.18;

    if (pattern === 'spread') {
      const count = 5 + boss.phase * 2;
      const spread = 1.15;
      const base = Math.PI / 2;
      for (let i = 0; i < count; i++) {
        const angle = base - spread / 2 + (spread / (count - 1)) * i;
        game.bullets.push({
          x: boss.x, y: boss.y + 30,
          vx: Math.cos(angle) * 220 * settings.fire ** -1 * 0.85,
          vy: Math.sin(angle) * 220 * settings.fire ** -1 * 0.85,
          radius: 6, damage: 1, enemy: true, life: 7, kind: 'orb',
        });
      }
      boss.attackTimer = 1.9 - boss.phase * 0.18;
    } else if (pattern === 'volley') {
      const shots = 2 + boss.phase;
      for (let i = 0; i < shots; i++) {
        const spreadAngle = Math.atan2(p.y - boss.y, p.x - boss.x) + rand(-0.10, 0.10);
        game.bullets.push({
          x: boss.x + rand(-26, 26), y: boss.y + 26,
          vx: Math.cos(spreadAngle) * 330, vy: Math.sin(spreadAngle) * 330,
          radius: 5, damage: 1, enemy: true, life: 5, kind: 'beam',
        });
      }
      boss.attackTimer = 1.35 - boss.phase * 0.14;
    } else if (pattern === 'minions') {
      const count = 2 + (boss.phase > 1 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        game.enemies.push({
          x: boss.x + rand(-60, 60), y: boss.y + 30, baseX: boss.x, vx: rand(-40, 40),
          vy: 100, radius: 17, hp: 2, maxHp: 2, kind: 'scout', age: 0,
          fire: rand(1.2, 2.2), hit: 0, phase: 0, diving: false,
        });
      }
      boss.attackTimer = 2.5;
    } else if (pattern === 'radial') {
      const count = 14 + boss.phase * 4;
      const offset = Math.random() * Math.PI;
      for (let i = 0; i < count; i++) {
        const angle = offset + (Math.PI * 2 / count) * i;
        game.bullets.push({
          x: boss.x, y: boss.y,
          vx: Math.cos(angle) * 170, vy: Math.sin(angle) * 170,
          radius: 5.5, damage: 1, enemy: true, life: 7, kind: 'orb',
        });
      }
      boss.attackTimer = 1.7;
    } else if (pattern === 'missiles') {
      for (let i = 0; i < 2; i++) {
        game.enemyMissiles.push({
          x: boss.x + (i ? 34 : -34), y: boss.y + 24,
          vx: rand(-40, 40), vy: 90, life: 6, trail: [],
        });
      }
      boss.attackTimer = 2.1;
    } else if (pattern === 'sweep') {
      boss.beam = { t: 0, telegraph: 0.85, duration: 2.1, angle: -0.75, from: -0.75, to: 0.75 };
      boss.attackTimer = 3.1;
      beep(300, 0.4, 0.04, 'sawtooth');
    }
  }

  function updateBoss(dt) {
    const boss = game.boss;
    if (!boss) return;
    const settings = DIFFICULTIES[game.difficulty];

    if (boss.state === 'enter') {
      boss.y += (boss.targetY - boss.y) * Math.min(1, dt * 2.2);
      if (boss.targetY - boss.y < 3) { boss.y = boss.targetY; boss.state = 'fight'; }
      return;
    }

    if (boss.state === 'dying') {
      boss.dyingTimer -= dt;
      boss.flash = 0.2;
      if (Math.random() < dt * 22) explode(boss.x + rand(-90, 90), boss.y + rand(-50, 50), boss.color, rand(0.5, 1.2));
      if (boss.dyingTimer <= 0) finishBossDeath();
      return;
    }

    boss.sway += dt;
    boss.x = W / 2 + Math.sin(boss.sway * 0.75) * Math.max(70, W * 0.19 - boss.phase * 12);
    boss.y = boss.targetY + Math.sin(boss.sway * 1.6) * 12;
    boss.flash = Math.max(0, boss.flash - dt * 4.5);
    boss.timer += dt;

    // rastro de energia do chefão
    if (Math.random() < dt * 18) {
      addParticle(boss.x + rand(-40, 40), boss.y + 34, rand(-14, 14), rand(20, 60),
        0.5, rand(3, 7), 'rgba(255,255,255,0.10)', 'smoke');
    }

    if (boss.beam) {
      const beam = boss.beam;
      beam.t += dt;
      const progress = clamp((beam.t - beam.telegraph) / (beam.duration - beam.telegraph), 0, 1);
      beam.angle = beam.from + (beam.to - beam.from) * progress;
      if (beam.t > beam.telegraph) {
        // dano do feixe de varredura
        const dx = Math.cos(beam.angle + Math.PI / 2);
        const dy = Math.sin(beam.angle + Math.PI / 2);
        const px = game.player.x - boss.x;
        const py = game.player.y - boss.y;
        const projection = px * dx + py * dy;
        if (projection > 0) {
          const perp = Math.abs(px * -dy + py * dx);
          if (perp < 20) hitPlayer();
        }
        if (Math.random() < dt * 30) {
          const length = 460;
          addParticle(boss.x + dx * rand(60, length), boss.y + dy * rand(60, length),
            rand(-30, 30), rand(-30, 30), 0.3, rand(1.5, 3), boss.accent, 'spark');
        }
      }
      if (beam.t > beam.duration) boss.beam = null;
    }

    boss.attackTimer -= dt * (1 + (game.level - 1) * 0.03) * (1 + (boss.phase - 1) * 0.22);
    if (boss.attackTimer <= 0 && !boss.beam) bossAttack();

    bossPhaseCheck();

    // colisão com o jogador
    if (dist(boss, game.player) < boss.radius + 16) hitPlayer();
    void settings;
  }

  /* ---------------- atualização ---------------- */

  function update(dt) {
    if (game.status !== 'playing') return;
    const p = game.player;
    const settings = DIFFICULTIES[game.difficulty];

    game.elapsed += dt;
    game.statsClock += dt;
    game.spawn -= dt;
    game.shake = Math.max(0, game.shake - dt * 42);
    game.flash = Math.max(0, game.flash - dt * 2.2);
    p.cooldown -= dt;
    p.missileCd -= dt;
    p.invincible = Math.max(0, p.invincible - dt);
    p.laser = Math.max(0, p.laser - dt);
    game.comboTime -= dt;
    if (game.comboTime <= 0) game.combo = 1;
    hideBanner(dt);

    // estrelas em paralaxe
    let layerIndex = 0;
    for (const layer of game.stars) {
      const factor = 1 + layerIndex * 0.85 + game.elapsed / 120;
      for (const star of layer) {
        star.y += star.speed * dt * factor;
        if (star.y > H + 4) { star.y = -4; star.x = Math.random() * W; }
      }
      layerIndex++;
    }

    // movimento
    let dx = 0;
    let dy = 0;
    if (game.keys.has('ArrowLeft') || game.keys.has('KeyA')) dx--;
    if (game.keys.has('ArrowRight') || game.keys.has('KeyD')) dx++;
    if (game.keys.has('ArrowUp') || game.keys.has('KeyW')) dy--;
    if (game.keys.has('ArrowDown') || game.keys.has('KeyS')) dy++;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    const speed = 348;
    p.x += dx * speed * dt;
    p.y += dy * speed * dt;
    p.bank += ((dx * 0.55) - p.bank) * Math.min(1, dt * 8);
    if (game.pointer.active) {
      const nextX = p.x + (game.pointer.x - p.x) * Math.min(1, dt * 14);
      p.bank += (((nextX - p.x) / 90) - p.bank) * Math.min(1, dt * 8);
      p.x = nextX;
      p.y += (game.pointer.y - p.y) * Math.min(1, dt * 14);
    }
    p.x = clamp(p.x, 26, W - 26);
    p.y = clamp(p.y, 96, H - 30);
    p.engine += dt;

    // tiro principal
    if (p.cooldown <= 0) firePrimary();

    // mísseis teleguiados
    if (p.missiles > 0 && p.missileCd <= 0) fireMissile();

    // drones de apoio (escolta)
    p.overdrive = Math.max(0, p.overdrive - dt);
    if (p.drones > 0) {
      p.droneCd -= dt;
      if (p.droneCd <= 0) {
        for (let i = 0; i < p.drones; i++) {
          const side = p.drones === 1 ? -1 : i === 0 ? -1 : 1;
          fireDrone({ x: p.x + side * 36, y: p.y + 16 + Math.sin(p.engine * 3 + i) * 3 });
        }
        p.droneCd = p.overdrive > 0 ? 0.3 : 0.44;
      }
    }

    // laser contínuo
    if (p.laser > 0) {
      p.laserTick += dt;
      for (const enemy of game.enemies) {
        if (Math.abs(enemy.x - p.x) < 26 + enemy.radius && enemy.y < p.y) {
          enemy.hp -= 30 * dt;
          enemy.hit = 0.15;
          if (enemy.hp <= 0) killEnemy(enemy);
        }
      }
      if (game.boss && game.boss.state === 'fight'
        && Math.abs(game.boss.x - p.x) < 40 && game.boss.y < p.y) {
        game.boss.hp -= 26 * dt;
        game.boss.flash = 0.12;
        if (game.boss.hp <= 0) startBossDeath();
      }
      if (Math.random() < dt * 40) {
        addParticle(p.x + rand(-18, 18), rand(60, p.y - 40), rand(-10, 10), rand(-160, -60),
          0.35, rand(1.5, 3.2), '#ff9ae6', 'spark');
      }
      game.enemies = game.enemies.filter(e => e.hp > 0);
    }

    // spawn de inimigos
    const spawnMod = game.boss ? 2.1 : 1;
    if (game.spawn <= 0 && game.enemies.length < 22) {
      spawnEnemy();
      const base = settings.spawn * (0.78 + Math.random() * 0.44) / (1 + Math.min(0.9, game.elapsed / 80));
      game.spawn = base * spawnMod;
    }

    // progressão de nível
    if (!game.boss) {
      game.levelTimer += dt;
      if (game.levelTimer >= LEVEL_TIME) {
        const next = game.level + 1;
        if (next % BOSS_EVERY === 0) spawnBoss(next);
        else { game.level = next; game.levelTimer = 0; announce(`NÍVEL ${next}`, 'ESQUADRÃO REFORÇADO'); }
      }
    }

    updateBoss(dt);

    // inimigos
    for (const enemy of game.enemies) {
      enemy.age += dt;
      enemy.hit = Math.max(0, enemy.hit - dt * 4);
      enemy.y += enemy.vy * dt;

      if (enemy.kind === 'zigzag') {
        enemy.x = enemy.baseX + Math.sin(enemy.age * 2.8 + enemy.phase) * 86;
      } else if (enemy.kind === 'diver') {
        if (enemy.y > 90 && !enemy.diving) enemy.diving = true;
        if (enemy.diving) {
          const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
          enemy.x += Math.cos(angle) * 190 * dt;
          enemy.y += Math.sin(angle) * 120 * dt;
        } else {
          enemy.x += enemy.vx * dt;
        }
      } else if (enemy.kind === 'sniper') {
        if (enemy.y > 110 && enemy.y < 190) {
          enemy.y -= enemy.vy * dt * 0.85;
          enemy.x += Math.sin(enemy.age * 1.6) * 26 * dt;
        } else {
          enemy.x += enemy.vx * dt;
        }
      } else {
        enemy.x += enemy.vx * dt;
      }
      enemy.x = clamp(enemy.x, enemy.radius, W - enemy.radius);

      // tiros
      enemy.fire -= dt;
      if (enemy.fire <= 0 && enemy.y > 30 && enemy.y < H - 90 && enemy.kind !== 'diver') {
        const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        if (enemy.kind === 'heavy') {
          for (let i = -1; i <= 1; i++) enemyShoot(enemy, angle + i * 0.22, 190 * settings.speed, 5.5);
        } else if (enemy.kind === 'sniper') {
          enemyShoot(enemy, angle, 380 * settings.speed, 4);
        } else if (game.level >= 2) {
          enemyShoot(enemy, angle, 210 * settings.speed, 5);
        }
        enemy.fire = (enemy.kind === 'sniper' ? 1.5 : 2.0 + Math.random() * 2.2) * settings.fire;
      }
    }

    // projéteis
    for (const bullet of game.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
    }
    for (const missile of game.missiles) {
      updateMissile(missile, dt);
    }
    for (const missile of game.enemyMissiles) {
      updateEnemyMissile(missile, dt);
    }
    for (const pickup of game.pickups) {
      pickup.y += 78 * dt;
      pickup.spin += dt * 2;
      pickup.life -= dt;
    }

    // partículas
    for (const particle of game.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.985;
      particle.vy *= 0.985;
      particle.life -= dt;
    }
    for (const ring of game.rings) {
      ring.life -= dt;
      const progress = 1 - ring.life / ring.maxLife;
      ring.r = 4 + (ring.maxR - 4) * progress;
    }
    for (const text of game.texts) {
      text.life -= dt;
      text.y += text.vy * dt;
      text.vy *= 0.94;
    }

    collisions();

    // limpeza
    game.bullets = game.bullets.filter(b => b.life > 0 && b.y > -40 && b.y < H + 40 && b.x > -50 && b.x < W + 50);
    game.missiles = game.missiles.filter(m => m.life > 0);
    game.enemyMissiles = game.enemyMissiles.filter(m => m.life > 0 && m.y < H + 40);
    game.enemies = game.enemies.filter(e => e.hp > 0 && e.y < H + 70);
    game.pickups = game.pickups.filter(pk => pk.life > 0 && pk.y < H + 30);
    game.particles = game.particles.filter(pt => pt.life > 0);
    game.rings = game.rings.filter(r => r.life > 0);
    game.texts = game.texts.filter(t => t.life > 0);

    let mood = 'calma';
    if (game.level >= 5 || game.lives <= 1) mood = 'suspense';
    if (game.boss || game.level >= 9) mood = 'intensa';
    musicSetMood(mood);

    if (game.statsClock > 0.08) { game.statsClock = 0; syncHud(); }
  }

  function updateMissile(missile, dt) {
    missile.life -= dt;
    const target = missile.target && missile.target.hp > 0 ? missile.target : nearestEnemyTarget(missile);
    missile.target = target;
    if (target) {
      const angle = Math.atan2(target.y - missile.y, target.x - missile.x);
      const desiredVx = Math.cos(angle) * 430;
      const desiredVy = Math.sin(angle) * 430;
      missile.vx += (desiredVx - missile.vx) * Math.min(1, dt * 4.5);
      missile.vy += (desiredVy - missile.vy) * Math.min(1, dt * 4.5);
    } else {
      missile.vy -= 300 * dt;
    }
    missile.x += missile.vx * dt;
    missile.y += missile.vy * dt;
    missile.trail.push({ x: missile.x, y: missile.y });
    if (missile.trail.length > 14) missile.trail.shift();
    if (Math.random() < dt * 40) {
      addParticle(missile.x, missile.y, rand(-14, 14), rand(-14, 14), 0.4, rand(1.5, 3), '#ffb457', 'spark');
    }
  }

  function updateEnemyMissile(missile, dt) {
    missile.life -= dt;
    const p = game.player;
    const angle = Math.atan2(p.y - missile.y, p.x - missile.x);
    missile.vx += (Math.cos(angle) * 250 - missile.vx) * Math.min(1, dt * 2.2);
    missile.vy += (Math.sin(angle) * 250 - missile.vy) * Math.min(1, dt * 2.2);
    missile.x += missile.vx * dt;
    missile.y += missile.vy * dt;
    missile.trail.push({ x: missile.x, y: missile.y });
    if (missile.trail.length > 10) missile.trail.shift();
    if (dist(missile, p) < 20) {
      missile.life = 0;
      explode(missile.x, missile.y, '#ff7a9a', 0.8);
      hitPlayer();
    }
  }

  function collisions() {
    const p = game.player;
    const deadBullets = new Set();
    const deadEnemies = new Set();

    for (const bullet of game.bullets) {
      if (bullet.enemy) {
        if (dist(bullet, p) < 18 + bullet.radius) { deadBullets.add(bullet); hitPlayer(); }
        continue;
      }
      for (const enemy of game.enemies) {
        if (deadEnemies.has(enemy)) continue;
        if (dist(bullet, enemy) < enemy.radius + bullet.radius) {
          deadBullets.add(bullet);
          enemy.hp -= bullet.damage;
          enemy.hit = 0.18;
          explode(bullet.x, bullet.y, '#9fe8ff', 0.25);
          if (enemy.hp <= 0) { deadEnemies.add(enemy); killEnemy(enemy); }
          break;
        }
      }
      if (!deadBullets.has(bullet) && game.boss && game.boss.state === 'fight'
        && dist(bullet, game.boss) < game.boss.radius + bullet.radius) {
        deadBullets.add(bullet);
        game.boss.hp -= bullet.damage;
        game.boss.flash = 0.1;
        explode(bullet.x, bullet.y, '#ffe1b0', 0.3);
        if (game.boss.hp <= 0) startBossDeath();
      }
    }

    for (const missile of game.missiles) {
      for (const enemy of game.enemies) {
        if (deadEnemies.has(enemy)) continue;
        if (dist(missile, enemy) < enemy.radius + 12) {
          missile.life = 0;
          enemy.hp -= 4;
          enemy.hit = 0.2;
          explode(missile.x, missile.y, '#ffb457', 0.9);
          if (enemy.hp <= 0) { deadEnemies.add(enemy); killEnemy(enemy); }
          break;
        }
      }
      if (missile.life > 0 && game.boss && game.boss.state === 'fight'
        && dist(missile, game.boss) < game.boss.radius + 12) {
        missile.life = 0;
        game.boss.hp -= 10;
        game.boss.flash = 0.16;
        explode(missile.x, missile.y, '#ffb457', 1);
        if (game.boss.hp <= 0) startBossDeath();
      }
    }

    for (const enemy of game.enemies) {
      if (!deadEnemies.has(enemy) && dist(enemy, p) < enemy.radius + 15) {
        deadEnemies.add(enemy);
        explode(enemy.x, enemy.y, '#ff8fa6', 1);
        hitPlayer();
      }
    }

    const deadPickups = new Set();
    for (const pickup of game.pickups) {
      if (dist(pickup, p) < 36) { deadPickups.add(pickup); collectPickup(pickup); }
    }

    game.bullets = game.bullets.filter(b => !deadBullets.has(b));
    game.enemies = game.enemies.filter(e => !deadEnemies.has(e));
    game.pickups = game.pickups.filter(pk => !deadPickups.has(pk));
  }

  /* ---------------- desenho ---------------- */

  function drawStars() {
    let layerIndex = 0;
    for (const layer of game.stars) {
      const stretch = 1 + layerIndex * 0.6;
      for (const star of layer) {
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = layerIndex === 2 ? '#d8f4ff' : '#a9d8ef';
        ctx.fillRect(star.x, star.y, star.size, star.size * stretch);
      }
      layerIndex++;
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(p, time) {
    if (p.invincible > 0 && Math.floor(time * 14) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.bank * 0.32);

    // chama do motor
    const flame = 20 + Math.sin(p.engine * 34) * 7;
    const flameGrad = ctx.createLinearGradient(0, 18, 0, 18 + flame);
    flameGrad.addColorStop(0, '#e9ffff');
    flameGrad.addColorStop(0.32, '#49e3ff');
    flameGrad.addColorStop(1, 'rgba(52,112,255,0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-7, 18);
    ctx.lineTo(0, 18 + flame);
    ctx.lineTo(7, 18);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-15, 15);
    ctx.lineTo(-11, 15 + flame * 0.55);
    ctx.lineTo(-7, 15);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(15, 15);
    ctx.lineTo(11, 15 + flame * 0.55);
    ctx.lineTo(7, 15);
    ctx.fill();

    // asas traseiras
    ctx.shadowColor = '#4fdcff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#1a7fb8';
    ctx.beginPath();
    ctx.moveTo(-8, 2); ctx.lineTo(-30, 20); ctx.lineTo(-26, 25); ctx.lineTo(-6, 14); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, 2); ctx.lineTo(30, 20); ctx.lineTo(26, 25); ctx.lineTo(6, 14); ctx.fill();

    // fuselagem
    const body = ctx.createLinearGradient(-20, 0, 20, 0);
    body.addColorStop(0, '#1274ad');
    body.addColorStop(0.46, '#f0fdff');
    body.addColorStop(0.62, '#7fe3ff');
    body.addColorStop(1, '#0f639a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(7, -13);
    ctx.lineTo(26, 6);
    ctx.lineTo(25, 14);
    ctx.lineTo(8, 9);
    ctx.lineTo(7, 22);
    ctx.lineTo(13, 27);
    ctx.lineTo(11, 31);
    ctx.lineTo(0, 26);
    ctx.lineTo(-11, 31);
    ctx.lineTo(-13, 27);
    ctx.lineTo(-7, 22);
    ctx.lineTo(-8, 9);
    ctx.lineTo(-25, 14);
    ctx.lineTo(-26, 6);
    ctx.lineTo(-7, -13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(8, 26, 44, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // cabine
    ctx.shadowBlur = 0;
    const cockpit = ctx.createLinearGradient(0, -22, 0, 2);
    cockpit.addColorStop(0, '#bff4ff');
    cockpit.addColorStop(1, '#0a2b50');
    ctx.fillStyle = cockpit;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.quadraticCurveTo(8, -6, 5, 4);
    ctx.lineTo(-5, 4);
    ctx.quadraticCurveTo(-8, -6, 0, -21);
    ctx.fill();

    // canhões conforme nível de arma
    const pods = clamp(p.weapon, 1, 3);
    ctx.fillStyle = '#9ef3ff';
    for (let i = 0; i < pods; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const offset = 9 + Math.floor(i / 2) * 7;
      ctx.fillRect(side * offset - 2, -18, 4, 10);
    }

    if (p.shield) {
      ctx.strokeStyle = `rgba(93,234,255,${0.6 + Math.sin(time * 5) * 0.22})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#4cecff';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.overdrive > 0) {
      ctx.strokeStyle = `rgba(255,157,92,${0.35 + Math.sin(time * 14) * 0.2})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff9d5c';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 34, time * 3, time * 3 + Math.PI * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 34, time * 3 + Math.PI, time * 3 + Math.PI * 2.3);
      ctx.stroke();
    }
    ctx.restore();

    // drones de apoio
    if (p.drones > 0) {
      for (let i = 0; i < p.drones; i++) {
        const side = p.drones === 1 ? -1 : i === 0 ? -1 : 1;
        const dx = p.x + side * 36;
        const dy = p.y + 16 + Math.sin(p.engine * 3 + i) * 3;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.shadowColor = '#7ef9d0';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#7ef9d0';
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(9, 4);
        ctx.lineTo(3, 2);
        ctx.lineTo(0, 8);
        ctx.lineTo(-3, 2);
        ctx.lineTo(-9, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(-1.5, -4, 3, 5);
        ctx.restore();
      }
      ctx.shadowBlur = 0;
    }

    // laser ativo
    if (p.laser > 0) {
      const width = 18 + Math.sin(time * 22) * 4;
      const grad = ctx.createLinearGradient(p.x - width, 0, p.x + width, 0);
      grad.addColorStop(0, 'rgba(255,106,213,0)');
      grad.addColorStop(0.5, 'rgba(255,106,213,0.55)');
      grad.addColorStop(1, 'rgba(255,106,213,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - width, 0, width * 2, p.y - 20);
      ctx.strokeStyle = 'rgba(255,225,250,0.95)';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ff6ad5';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 24);
      ctx.lineTo(p.x, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const hurt = enemy.hit > 0;
    ctx.shadowColor = hurt ? '#ffffff' : enemy.kind === 'heavy' ? '#ff9a62' : '#ff527d';
    ctx.shadowBlur = 14;

    if (enemy.kind === 'heavy') {
      ctx.fillStyle = hurt ? '#ffe6d5' : '#bd5b4c';
      ctx.beginPath();
      ctx.moveTo(0, 28); ctx.lineTo(-27, 7); ctx.lineTo(-25, -17); ctx.lineTo(-10, -12);
      ctx.lineTo(0, -25); ctx.lineTo(10, -12); ctx.lineTo(25, -17); ctx.lineTo(27, 7);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(48, 8, 16, 0.7)'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.fillStyle = '#ffccd7';
      ctx.fillRect(-3, -7, 6, 12);
      ctx.fillStyle = 'rgba(255, 120, 90, 0.55)';
      ctx.fillRect(-19, 2, 8, 4); ctx.fillRect(11, 2, 8, 4);
    } else if (enemy.kind === 'diver') {
      ctx.fillStyle = hurt ? '#ffe6d5' : '#d1521f';
      ctx.beginPath();
      ctx.moveTo(0, 24); ctx.lineTo(-16, -6); ctx.lineTo(-6, -2); ctx.lineTo(0, -20);
      ctx.lineTo(6, -2); ctx.lineTo(16, -6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd9a8';
      ctx.fillRect(-2, -4, 4, 10);
    } else if (enemy.kind === 'sniper') {
      ctx.fillStyle = hurt ? '#ffe6d5' : '#8f4bd1';
      ctx.beginPath();
      ctx.moveTo(0, 22); ctx.lineTo(-20, -8); ctx.lineTo(-8, -6); ctx.lineTo(0, -19);
      ctx.lineTo(8, -6); ctx.lineTo(20, -8);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e6c2ff';
      ctx.beginPath();
      ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = hurt ? '#ffe6d5' : enemy.kind === 'zigzag' ? '#bd416d' : '#d84b62';
      ctx.beginPath();
      ctx.moveTo(0, 23); ctx.lineTo(-enemy.radius, -11); ctx.lineTo(-7, -7);
      ctx.lineTo(0, -20); ctx.lineTo(7, -7); ctx.lineTo(enemy.radius, -11);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(48, 8, 16, 0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffccd7';
      ctx.fillRect(-3, -7, 6, 12);
      ctx.fillStyle = 'rgba(255, 150, 175, 0.75)';
      ctx.fillRect(-enemy.radius + 2, -6, 6, 2.5);
      ctx.fillRect(enemy.radius - 8, -6, 6, 2.5);
    }

    ctx.shadowBlur = 0;
    if (enemy.maxHp > 2) {
      const pct = clamp(enemy.hp / enemy.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.fillRect(-22, -38, 44, 3.5);
      ctx.fillStyle = pct > 0.5 ? '#ffab72' : '#ff5d7a';
      ctx.fillRect(-22, -38, 44 * pct, 3.5);
    }
    ctx.restore();
  }

  function drawBoss(boss, time) {
    const r = boss.radius;
    const hurt = boss.flash > 0;
    ctx.save();
    ctx.translate(boss.x, boss.y);

    // aura
    const aura = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9);
    aura.addColorStop(0, `rgba(255,255,255,${hurt ? 0.16 : 0.06})`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = boss.color;
    ctx.shadowBlur = hurt ? 40 : 26;
    ctx.fillStyle = boss.color;

    if (boss.variant === 0) {
      // CRUZADOR FERRO — casco hexagonal largo
      const hull = ctx.createLinearGradient(-r, -r * 0.7, r, r * 0.85);
      hull.addColorStop(0, '#ffb27a');
      hull.addColorStop(0.5, boss.color);
      hull.addColorStop(1, '#a8441f');
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.85);
      ctx.lineTo(-r * 0.55, r * 0.4);
      ctx.lineTo(-r, -r * 0.1);
      ctx.lineTo(-r * 0.6, -r * 0.7);
      ctx.lineTo(r * 0.6, -r * 0.7);
      ctx.lineTo(r, -r * 0.1);
      ctx.lineTo(r * 0.55, r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 10, 4, 0.75)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // canhões laterais
      ctx.fillStyle = '#2b1a12';
      ctx.fillRect(-r * 0.82, -r * 0.34, r * 0.3, r * 0.56);
      ctx.fillRect(r * 0.52, -r * 0.34, r * 0.3, r * 0.56);
      ctx.fillStyle = boss.accent;
      ctx.shadowColor = boss.accent; ctx.shadowBlur = 14;
      ctx.fillRect(-r * 0.78, r * 0.16, r * 0.22, 6);
      ctx.fillRect(r * 0.56, r * 0.16, r * 0.22, 6);
      ctx.shadowBlur = 0;
      // placas de blindagem
      ctx.strokeStyle = 'rgba(255, 226, 200, 0.32)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.5); ctx.lineTo(r * 0.5, -r * 0.5);
      ctx.moveTo(-r * 0.34, -r * 0.2); ctx.lineTo(r * 0.34, -r * 0.2);
      ctx.stroke();
    } else if (boss.variant === 1) {
      // CEIFADOR SOMBRIO — flecha angular
      ctx.beginPath();
      ctx.moveTo(0, r * 0.95);
      ctx.lineTo(-r * 0.35, r * 0.15);
      ctx.lineTo(-r, -r * 0.35);
      ctx.lineTo(-r * 0.45, -r * 0.55);
      ctx.lineTo(0, -r * 0.95);
      ctx.lineTo(r * 0.45, -r * 0.55);
      ctx.lineTo(r, -r * 0.35);
      ctx.lineTo(r * 0.35, r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 4, 34, 0.8)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = boss.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.3); ctx.lineTo(0, r * 0.55); ctx.lineTo(r * 0.8, -r * 0.3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, -r * 0.45); ctx.lineTo(0, -r * 0.85); ctx.lineTo(r * 0.42, -r * 0.45);
      ctx.closePath(); ctx.fill();
    } else {
      // FORTALEZA ÓRBITA — estação circular com anéis
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 6, 14, 0.8)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
      for (let i = 0; i < 6; i++) {
        const a = time * 0.6 + (Math.PI * 2 / 6) * i;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = boss.accent;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++) {
        const start = time * 1.3 + i * (Math.PI / 2);
        ctx.beginPath();
        ctx.arc(0, 0, r, start, start + 0.85);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }

    // clarão curto ao levar dano (mantém a identidade do chefão)
    if (hurt) {
      const flashGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.05);
      flashGrad.addColorStop(0, `rgba(255,255,255,${Math.min(0.55, boss.flash)})`);
      flashGrad.addColorStop(0.7, `rgba(255,255,255,${Math.min(0.22, boss.flash * 0.4)})`);
      flashGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // núcleo pulsante
    const pulse = 0.65 + Math.sin(time * 6) * 0.25;
    const core = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.42);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.45, boss.accent);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // feixe de varredura
    if (boss.beam) {
      const beam = boss.beam;
      const ang = beam.angle + Math.PI / 2;
      const length = 520;
      const ex = boss.x + Math.cos(ang) * length;
      const ey = boss.y + Math.sin(ang) * length;
      const charged = beam.t > beam.telegraph;
      ctx.save();
      ctx.lineCap = 'round';
      if (!charged) {
        ctx.strokeStyle = `rgba(255,255,255,${0.25 + Math.sin(time * 30) * 0.15})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
      } else {
        ctx.strokeStyle = boss.accent;
        ctx.shadowColor = boss.color;
        ctx.shadowBlur = 26;
        ctx.lineWidth = 16;
      }
      ctx.beginPath();
      ctx.moveTo(boss.x, boss.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (charged) {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(boss.x, boss.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const bullet of game.bullets) {
      if (bullet.enemy) {
        ctx.shadowColor = '#ff365f';
        ctx.shadowBlur = 14;
        const grad = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, bullet.radius * 2.2);
        grad.addColorStop(0, '#fff2f6');
        grad.addColorStop(0.45, '#ff7691');
        grad.addColorStop(1, 'rgba(255,54,95,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const colors = ['#9df3ff', '#7fe9ff', '#b6a2ff'];
        const power = clamp(bullet.power || 1, 1, 3);
        const core = bullet.drone ? '#a9fff0' : colors[power - 1];
        const glow = bullet.drone ? '#2ef0c8' : power === 3 ? '#7b6bff' : '#38d9ff';
        ctx.strokeStyle = core;
        ctx.shadowColor = glow;
        ctx.shadowBlur = bullet.drone ? 9 : 12 + power * 3;
        ctx.lineWidth = bullet.drone ? 2.4 : 3 + power;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x - bullet.vx * 0.022, bullet.y - bullet.vy * 0.022);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = bullet.drone ? 1.1 : 1.6;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x - bullet.vx * 0.014, bullet.y - bullet.vy * 0.014);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    for (const missile of game.missiles) {
      ctx.strokeStyle = 'rgba(255,180,87,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      missile.trail.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.fillStyle = '#ffd9a8';
      ctx.shadowColor = '#ffb457';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(missile.x, missile.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const missile of game.enemyMissiles) {
      ctx.strokeStyle = 'rgba(255,122,154,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      missile.trail.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.fillStyle = '#ffd0da';
      ctx.shadowColor = '#ff4d70';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(missile.x, missile.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawPickups(time) {
    for (const pickup of game.pickups) {
      const style = PICKUP_STYLE[pickup.kind];
      const blink = pickup.life < 3 && Math.floor(time * 8) % 2 === 0;
      if (blink) continue;
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(pickup.spin);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = style.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.rect(-14, -14, 28, 28);
      ctx.stroke();
      ctx.rotate(-pickup.spin);
      ctx.fillStyle = style.color;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.label, 0, 1);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawEffects() {
    for (const particle of game.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = particle.kind === 'smoke' ? alpha * 0.55 : alpha;
      ctx.fillStyle = particle.color;
      if (particle.kind === 'smoke') {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (2 - alpha), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      }
    }
    ctx.globalAlpha = 1;

    for (const ring of game.rings) {
      const alpha = Math.max(0, ring.life / ring.maxLife);
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 3 * alpha + 0.6;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.font = 'bold 13px system-ui, sans-serif';
    for (const text of game.texts) {
      ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1;
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);
    drawStars();

    ctx.save();
    if (game.shake > 0) {
      ctx.translate(rand(-game.shake, game.shake) * 0.5, rand(-game.shake, game.shake) * 0.5);
    }

    drawPickups(time);
    drawBullets();
    for (const enemy of game.enemies) drawEnemy(enemy);
    if (game.boss) drawBoss(game.boss, time);
    if (game.status !== 'over') drawPlayer(game.player, time);
    drawEffects();
    ctx.restore();

    // barra de tempo do laser / bomba no rodapé
    if (game.player.laser > 0 && game.status === 'playing') {
      ctx.fillStyle = 'rgba(7,18,33,.72)';
      ctx.fillRect(W / 2 - 80, H - 26, 160, 6);
      ctx.fillStyle = '#ff6ad5';
      ctx.fillRect(W / 2 - 80, H - 26, 160 * clamp(game.player.laser / 14, 0, 1), 6);
    }

    // vinheta
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,6,16,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    if (game.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, game.flash * 0.6)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------------- redimensionamento ---------------- */

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const valid = rect.width > 40 && rect.height > 40;
    const aspect = valid ? rect.width / rect.height : 1.6;
    W = Math.round(clamp(H * aspect, 320, 1280));
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * ratio;
    canvas.height = H * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    bgCanvas = buildBackground();
    game.stars = makeStars();
    game.player.x = clamp(game.player.x, 26, W - 26);
    game.player.y = clamp(game.player.y, 96, H - 30);
    game.pointer.x = clamp(game.pointer.x, 26, W - 26);
    if (game.boss) {
      game.boss.radius = 74 * bossScale();
      game.boss.targetY = bossTargetY();
    }
  }

  /* ---------------- entrada ---------------- */

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener('pointerdown', event => {
    if (game.status !== 'playing') return;
    canvas.setPointerCapture(event.pointerId);
    game.pointer = { active: true, ...pointerPosition(event) };
  });
  canvas.addEventListener('pointermove', event => {
    if (game.pointer.active) Object.assign(game.pointer, pointerPosition(event));
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    canvas.addEventListener(type, () => { game.pointer.active = false; });
  });

  document.querySelectorAll('[data-difficulty]').forEach(button => {
    button.addEventListener('click', () => {
      selectedDifficulty = button.dataset.difficulty;
      document.querySelectorAll('[data-difficulty]').forEach(card => {
        const selected = card === button;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-pressed', String(selected));
        const check = card.querySelector('.difficulty-check');
        if (check) check.textContent = selected ? '✓' : '';
      });
    });
  });

  if ($('start-button')) $('start-button').addEventListener('click', startGame);
  if ($('restart-button')) $('restart-button').addEventListener('click', startGame);
  if ($('resume-button')) $('resume-button').addEventListener('click', togglePause);
  if (ui.pauseButton) ui.pauseButton.addEventListener('click', togglePause);
  if (ui.bombButton) ui.bombButton.addEventListener('click', useBomb);
  document.querySelectorAll('[data-menu]').forEach(button => {
    button.addEventListener('click', () => changeStatus('menu'));
  });
  if ($('brand')) {
    $('brand').addEventListener('click', event => {
      event.preventDefault();
      if (game.status !== 'playing') changeStatus('menu');
    });
  }
  if (ui.soundButton) {
    ui.soundButton.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      ui.soundButton.setAttribute('aria-label', soundEnabled ? 'Desativar som' : 'Ativar som');
      ui.soundButton.title = soundEnabled ? 'Desativar som' : 'Ativar som';
      const waves = $('sound-waves');
      if (waves) {
        waves.setAttribute('d', soundEnabled
          ? 'M15 8.5a5 5 0 0 1 0 7m2.5-9.5a8.5 8.5 0 0 1 0 12'
          : 'm16 9 5 6m0-6-5 6');
      }
      if (soundEnabled) { beep(600); musicStart(); } else { musicStop(0.15); }
    });
  }

  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)
      && game.status === 'playing') event.preventDefault();
    game.keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Escape' || event.code === 'KeyP') togglePause();
    if (event.code === 'KeyB' || event.code === 'KeyX') useBomb();
    if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)
      && (game.status === 'menu' || game.status === 'over')) startGame();
  });
  window.addEventListener('keyup', event => game.keys.delete(event.code));
  window.addEventListener('blur', () => { if (game.status === 'playing') changeStatus('paused'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.status === 'playing') changeStatus('paused');
  });
  window.addEventListener('resize', resize);

  /* ---------------- gancho de depuração ----------------
     Exposto apenas para testes automatizados / ajustes manuais no console.
     Não interfere na jogabilidade normal. */

  window.SkyforceDebug = {
    get game() { return game; },
    start: startGame,
    setLives: n => { game.lives = n; syncHud(); },
    spawnBoss: () => {
      const next = game.level + (BOSS_EVERY - ((game.level % BOSS_EVERY) || BOSS_EVERY)) + BOSS_EVERY;
      spawnBoss(Math.max(3, game.level + 1));
      return next;
    },
    damageBoss: n => {
      if (!game.boss) return false;
      game.boss.hp -= n;
      if (game.boss.hp <= 0) startBossDeath();
      return true;
    },
    giveWeapons: () => {
      game.player.weapon = 3;
      game.player.missiles = 18;
      game.player.laser = 10;
      game.player.bombs = 4;
      game.player.drones = 2;
      game.player.overdrive = 8;
      syncHud();
    },
    givePickup: (kind, x, y) => {
      game.pickups.push({
        x: typeof x === 'number' ? x : game.player.x,
        y: typeof y === 'number' ? y : game.player.y - 14,
        kind, spin: 0, life: 30,
      });
    },
  };

  /* ---------------- loop ---------------- */

  resize();
  syncScreens();
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.034, Math.max(0, (now - last) / 1000));
    last = now;
    if (game.status === 'playing') update(dt);
    else {
      for (const layer of game.stars) {
        for (const star of layer) {
          star.y += star.speed * dt * 0.25;
          if (star.y > H) { star.y = 0; star.x = Math.random() * W; }
        }
      }
      hideBanner(dt);
    }
    draw(now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
