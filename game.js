(() => {
  'use strict';

  const W = 960;
  const H = 600;
  const DIFFICULTIES = {
    facil: { name: 'Fácil', lives: 5, spawn: 1.12, speed: 0.78, fire: 1.35 },
    medio: { name: 'Médio', lives: 3, spawn: 0.82, speed: 1, fire: 1 },
    dificil: { name: 'Difícil', lives: 2, spawn: 0.58, speed: 1.25, fire: 0.7 },
  };
  const $ = id => document.getElementById(id);
  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const ui = {
    frame: $('game-frame'), hud: $('game-hud'), menu: $('menu-screen'), pause: $('pause-screen'), over: $('gameover-screen'),
    pauseButton: $('pause-button'), soundButton: $('sound-button'), lives: $('lives'), score: $('score'), level: $('level'),
    combo: $('combo'), shield: $('shield'), finalScore: $('final-score'), finalLevel: $('final-level'),
    finalDifficulty: $('final-difficulty'), bestScore: $('best-score'), newRecord: $('new-record'),
  };
  const numberFormat = new Intl.NumberFormat('pt-BR');
  let selectedDifficulty = 'medio';
  let soundEnabled = true;
  let audio = null;
  let best = { facil: 0, medio: 0, dificil: 0 };
  let lastLives = -1;
  const cache = {};

  function makeStars() {
    return Array.from({ length: 95 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      size: Math.random() * 1.8 + 0.4, speed: Math.random() * 65 + 18, alpha: Math.random() * 0.65 + 0.2,
    }));
  }

  function makeWorld(difficulty = selectedDifficulty, status = 'menu') {
    return {
      status, difficulty,
      player: { x: W / 2, y: H - 82, cooldown: 0, invincible: 0, shield: 0, power: 0 },
      bullets: [], enemies: [], particles: [], pickups: [], stars: makeStars(), keys: new Set(),
      pointer: { active: false, x: W / 2, y: H - 82 },
      score: 0, lives: DIFFICULTIES[difficulty].lives, elapsed: 0, spawn: 0.8,
      shake: 0, combo: 1, comboTime: 0, statsClock: 0,
    };
  }
  let game = makeWorld();

  function updateRecords() {
    document.querySelectorAll('[data-record]').forEach(element => {
      const score = best[element.dataset.record];
      element.hidden = !score;
      element.textContent = `RECORDE ${numberFormat.format(score)}`;
    });
  }
  try {
    const saved = JSON.parse(localStorage.getItem('skyforce-records') || '{}');
    Object.keys(best).forEach(key => { best[key] = Number(saved[key]) || 0; });
  } catch { /* O jogo funciona mesmo sem armazenamento local. */ }
  updateRecords();

  function beep(frequency, duration = 0.06, volume = 0.035, type = 'sine') {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audio) audio = new AudioContext();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.7), audio.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch { /* Áudio é opcional. */ }
  }

  function syncStats() {
    cache.score = numberFormat.format(game.score);
    ui.score.textContent = cache.score;
    ui.level.textContent = String(Math.min(9, 1 + Math.floor(game.elapsed / 20))).padStart(2, '0');
    if (lastLives !== game.lives) {
      ui.lives.textContent = '♥'.repeat(Math.max(0, game.lives));
      lastLives = game.lives;
    }
    ui.combo.hidden = game.combo <= 1;
    ui.combo.textContent = `COMBO ×${game.combo}`;
    ui.shield.hidden = !game.player.shield;
  }

  function syncScreens() {
    const status = game.status;
    ui.menu.hidden = status !== 'menu';
    ui.pause.hidden = status !== 'paused';
    ui.over.hidden = status !== 'over';
    ui.hud.hidden = status !== 'playing' && status !== 'paused';
    ui.pauseButton.hidden = status !== 'playing' && status !== 'paused';
    ui.frame.classList.toggle('is-playing', status === 'playing');
    ui.pauseButton.innerHTML = status === 'paused'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
    const label = status === 'paused' ? 'Continuar' : 'Pausar';
    ui.pauseButton.setAttribute('aria-label', label);
    ui.pauseButton.title = `${label} (P)`;
  }

  function changeStatus(status) {
    game.status = status;
    game.keys.clear();
    game.pointer.active = false;
    syncScreens();
    if (status === 'paused') $('resume-button').focus();
    if (status === 'over') $('restart-button').focus();
    if (status === 'menu') { updateRecords(); $('start-button').focus(); }
  }

  function startGame() {
    game = makeWorld(selectedDifficulty, 'playing');
    lastLives = -1;
    syncStats();
    syncScreens();
    canvas.focus();
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
      try { localStorage.setItem('skyforce-records', JSON.stringify(best)); } catch { /* Armazenamento opcional. */ }
    }
    syncStats();
    ui.finalScore.textContent = numberFormat.format(game.score);
    ui.finalLevel.textContent = Math.min(9, 1 + Math.floor(game.elapsed / 20));
    ui.finalDifficulty.textContent = DIFFICULTIES[game.difficulty].name.toLowerCase();
    ui.bestScore.textContent = numberFormat.format(best[game.difficulty]);
    ui.newRecord.hidden = game.score <= previousBest || game.score === 0;
    changeStatus('over');
    beep(150, 0.5, 0.08, 'sawtooth');
  }

  function explode(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 180;
      const life = 0.3 + Math.random() * 0.55;
      game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, size: 1.5 + Math.random() * 4, color });
    }
  }

  function hitPlayer() {
    const p = game.player;
    if (p.invincible > 0 || game.status !== 'playing') return;
    if (p.shield > 0) {
      p.shield = 0;
      p.invincible = 0.7;
      explode(p.x, p.y, '#63e6ff', 20);
      beep(260, 0.15, 0.06, 'triangle');
      return;
    }
    game.lives--;
    p.invincible = 1.8;
    game.shake = 12;
    game.combo = 1;
    explode(p.x, p.y, '#62d9ff', 28);
    beep(110, 0.25, 0.08, 'sawtooth');
    if (game.lives <= 0) finishGame();
  }

  function spawnEnemy() {
    const settings = DIFFICULTIES[game.difficulty];
    const progress = Math.min(1, game.elapsed / 75);
    const roll = Math.random();
    const kind = roll < 0.18 + progress * 0.15 ? 'heavy' : roll < 0.52 ? 'zigzag' : 'scout';
    const radius = kind === 'heavy' ? 28 : kind === 'zigzag' ? 20 : 17;
    const hp = kind === 'heavy' ? 5 : kind === 'zigzag' ? 2 : 1;
    const x = 45 + Math.random() * (W - 90);
    game.enemies.push({
      x, y: -45, baseX: x, vx: (Math.random() - 0.5) * 30,
      vy: (kind === 'heavy' ? 65 : kind === 'zigzag' ? 100 : 125) * settings.speed * (1 + Math.min(0.45, game.elapsed / 180)),
      radius, hp, maxHp: hp, kind, age: 0, fire: 1 + Math.random() * 2.5,
    });
  }

  function firePlayer() {
    const p = game.player;
    const shot = (x, vx = 0) => game.bullets.push({ x, y: p.y - 27, vx, vy: -570, radius: 3.5, enemy: false, damage: 1 });
    if (p.power > 0) { shot(p.x - 13, -45); shot(p.x); shot(p.x + 13, 45); }
    else shot(p.x);
    p.cooldown = p.power > 0 ? 0.13 : 0.2;
    beep(p.power > 0 ? 740 : 620, 0.035, 0.018, 'square');
  }

  function update(dt) {
    if (game.status !== 'playing') return;
    const p = game.player;
    const settings = DIFFICULTIES[game.difficulty];
    game.elapsed += dt;
    game.statsClock += dt;
    game.spawn -= dt;
    game.shake = Math.max(0, game.shake - dt * 35);
    p.cooldown -= dt;
    p.invincible = Math.max(0, p.invincible - dt);
    p.power = Math.max(0, p.power - dt);
    game.comboTime -= dt;
    if (game.comboTime <= 0) game.combo = 1;

    for (const star of game.stars) {
      star.y += star.speed * dt * (1 + game.elapsed / 100);
      if (star.y > H + 3) { star.y = -3; star.x = Math.random() * W; }
    }
    let dx = 0, dy = 0;
    if (game.keys.has('ArrowLeft') || game.keys.has('KeyA')) dx--;
    if (game.keys.has('ArrowRight') || game.keys.has('KeyD')) dx++;
    if (game.keys.has('ArrowUp') || game.keys.has('KeyW')) dy--;
    if (game.keys.has('ArrowDown') || game.keys.has('KeyS')) dy++;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    p.x += dx * 340 * dt;
    p.y += dy * 340 * dt;
    if (game.pointer.active) {
      p.x += (game.pointer.x - p.x) * Math.min(1, dt * 13);
      p.y += (game.pointer.y - p.y) * Math.min(1, dt * 13);
    }
    p.x = Math.max(25, Math.min(W - 25, p.x));
    p.y = Math.max(92, Math.min(H - 30, p.y));
    if (p.cooldown <= 0) firePlayer();
    if (game.spawn <= 0) {
      spawnEnemy();
      game.spawn = settings.spawn * (0.75 + Math.random() * 0.5) / (1 + Math.min(0.8, game.elapsed / 90));
    }
    for (const enemy of game.enemies) {
      enemy.age += dt;
      enemy.y += enemy.vy * dt;
      if (enemy.kind === 'zigzag') enemy.x = enemy.baseX + Math.sin(enemy.age * 2.8) * 85;
      else enemy.x += enemy.vx * dt;
      enemy.x = Math.max(enemy.radius, Math.min(W - enemy.radius, enemy.x));
      enemy.fire -= dt;
      if (enemy.fire <= 0 && enemy.y > 35 && enemy.y < H - 150) {
        const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        const speed = 190 * settings.speed;
        game.bullets.push({ x: enemy.x, y: enemy.y + enemy.radius * 0.6, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 5, enemy: true, damage: 1 });
        enemy.fire = (1.8 + Math.random() * 2.2) * settings.fire;
      }
    }
    for (const bullet of game.bullets) { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; }
    for (const pickup of game.pickups) { pickup.y += 75 * dt; pickup.spin += dt * 2; }
    for (const particle of game.particles) {
      particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      particle.vx *= 0.985; particle.vy *= 0.985; particle.life -= dt;
    }

    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const deadBullets = new Set();
    const deadEnemies = new Set();
    for (const bullet of game.bullets) {
      if (bullet.enemy) {
        if (distance(bullet, p) < 19 + bullet.radius) { deadBullets.add(bullet); hitPlayer(); }
      } else {
        for (const enemy of game.enemies) {
          if (!deadEnemies.has(enemy) && distance(bullet, enemy) < enemy.radius + bullet.radius) {
            deadBullets.add(bullet);
            enemy.hp -= bullet.damage;
            explode(bullet.x, bullet.y, '#79dcff', 3);
            if (enemy.hp <= 0) {
              deadEnemies.add(enemy);
              game.combo = game.comboTime > 0 ? Math.min(5, game.combo + 1) : 1;
              game.comboTime = 2.8;
              game.score += (enemy.kind === 'heavy' ? 300 : enemy.kind === 'zigzag' ? 160 : 100) * game.combo;
              explode(enemy.x, enemy.y, enemy.kind === 'heavy' ? '#ffad66' : '#ff6685', enemy.kind === 'heavy' ? 28 : 16);
              beep(enemy.kind === 'heavy' ? 120 : 190, 0.09, 0.04, 'triangle');
              if (Math.random() < 0.12) {
                const roll = Math.random();
                game.pickups.push({ x: enemy.x, y: enemy.y, kind: roll < 0.25 ? 'life' : roll < 0.58 ? 'shield' : 'power', spin: 0 });
              }
            }
            break;
          }
        }
      }
    }
    for (const enemy of game.enemies) {
      if (!deadEnemies.has(enemy) && distance(enemy, p) < enemy.radius + 17) { deadEnemies.add(enemy); hitPlayer(); }
    }
    const deadPickups = new Set();
    for (const pickup of game.pickups) {
      if (distance(pickup, p) < 34) {
        deadPickups.add(pickup);
        if (pickup.kind === 'life') game.lives = Math.min(6, game.lives + 1);
        if (pickup.kind === 'shield') p.shield = 1;
        if (pickup.kind === 'power') p.power = 10;
        game.score += 50;
        beep(880, 0.18, 0.05, 'sine');
        explode(pickup.x, pickup.y, '#64f6c2', 12);
      }
    }
    game.bullets = game.bullets.filter(b => !deadBullets.has(b) && b.y > -35 && b.y < H + 35 && b.x > -35 && b.x < W + 35);
    game.enemies = game.enemies.filter(e => !deadEnemies.has(e) && e.y < H + 55);
    game.pickups = game.pickups.filter(pickup => !deadPickups.has(pickup) && pickup.y < H + 30);
    game.particles = game.particles.filter(particle => particle.life > 0);
    if (game.statsClock > 0.1) { game.statsClock = 0; syncStats(); }
  }

  function drawPlayer(p, time) {
    if (p.invincible > 0 && Math.floor(time * 12) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    const flame = 16 + Math.sin(time * 35) * 5;
    const flameGradient = ctx.createLinearGradient(0, 18, 0, 18 + flame);
    flameGradient.addColorStop(0, '#d8ffff'); flameGradient.addColorStop(0.35, '#42dfff'); flameGradient.addColorStop(1, 'rgba(52,112,255,0)');
    ctx.fillStyle = flameGradient;
    ctx.beginPath(); ctx.moveTo(-6, 18); ctx.lineTo(0, 18 + flame); ctx.lineTo(6, 18); ctx.fill();
    ctx.shadowColor = '#4fdcff'; ctx.shadowBlur = 18;
    const body = ctx.createLinearGradient(-20, 0, 20, 0);
    body.addColorStop(0, '#1688c7'); body.addColorStop(0.48, '#e8fcff'); body.addColorStop(0.6, '#72ddff'); body.addColorStop(1, '#126da9');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(8, -11); ctx.lineTo(29, 9); ctx.lineTo(28, 17); ctx.lineTo(8, 10);
    ctx.lineTo(7, 23); ctx.lineTo(14, 29); ctx.lineTo(12, 33); ctx.lineTo(0, 28); ctx.lineTo(-12, 33);
    ctx.lineTo(-14, 29); ctx.lineTo(-7, 23); ctx.lineTo(-8, 10); ctx.lineTo(-28, 17); ctx.lineTo(-29, 9);
    ctx.lineTo(-8, -11); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#092a4c';
    ctx.beginPath(); ctx.moveTo(0, -19); ctx.quadraticCurveTo(8, -4, 5, 5); ctx.lineTo(-5, 5); ctx.quadraticCurveTo(-8, -4, 0, -19); ctx.fill();
    ctx.fillStyle = '#7df4ff'; ctx.fillRect(-23, 10, 9, 2); ctx.fillRect(14, 10, 9, 2);
    if (p.shield) {
      ctx.strokeStyle = `rgba(93,234,255,${0.65 + Math.sin(time * 5) * 0.2})`;
      ctx.lineWidth = 2; ctx.shadowColor = '#4cecff'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save(); ctx.translate(enemy.x, enemy.y);
    ctx.shadowColor = enemy.kind === 'heavy' ? '#ff9a62' : '#ff527d'; ctx.shadowBlur = 14;
    ctx.fillStyle = enemy.kind === 'heavy' ? '#bd5b4c' : enemy.kind === 'zigzag' ? '#bd416d' : '#d84b62';
    ctx.beginPath();
    if (enemy.kind === 'heavy') {
      ctx.moveTo(0, 28); ctx.lineTo(-27, 7); ctx.lineTo(-25, -17); ctx.lineTo(-10, -12); ctx.lineTo(0, -25); ctx.lineTo(10, -12); ctx.lineTo(25, -17); ctx.lineTo(27, 7);
    } else {
      ctx.moveTo(0, 23); ctx.lineTo(-enemy.radius, -11); ctx.lineTo(-7, -7); ctx.lineTo(0, -20); ctx.lineTo(7, -7); ctx.lineTo(enemy.radius, -11);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffccd7'; ctx.fillRect(-3, -7, 6, 12);
    ctx.fillStyle = '#ff8b9f'; ctx.fillRect(-enemy.radius + 3, -7, 6, 3); ctx.fillRect(enemy.radius - 9, -7, 6, 3);
    if (enemy.maxHp > 2) {
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(-22, -36, 44, 3);
      ctx.fillStyle = '#ffab72'; ctx.fillRect(-22, -36, 44 * (enemy.hp / enemy.maxHp), 3);
    }
    ctx.restore();
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#071325'); bg.addColorStop(0.5, '#0a1b31'); bg.addColorStop(1, '#07111f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.75, H * 0.15, 0, W * 0.75, H * 0.15, 440);
    glow.addColorStop(0, 'rgba(36,111,155,.18)'); glow.addColorStop(1, 'rgba(5,16,30,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(87,170,205,.035)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (const star of game.stars) {
      ctx.globalAlpha = star.alpha; ctx.fillStyle = '#c4efff';
      ctx.fillRect(star.x, star.y, star.size, star.size * (game.status === 'playing' ? 2.2 : 1));
    }
    ctx.globalAlpha = 1;
    ctx.save();
    if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    for (const pickup of game.pickups) {
      const colors = { life: '#62f0b5', shield: '#5fdcff', power: '#c38aff' };
      ctx.save(); ctx.translate(pickup.x, pickup.y); ctx.rotate(pickup.spin);
      ctx.strokeStyle = colors[pickup.kind]; ctx.lineWidth = 2; ctx.shadowColor = colors[pickup.kind]; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.rect(-13, -13, 26, 26); ctx.stroke(); ctx.rotate(-pickup.spin);
      ctx.fillStyle = colors[pickup.kind]; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pickup.kind === 'life' ? '+' : pickup.kind === 'shield' ? 'S' : '3×', 0, 1); ctx.restore();
    }
    for (const bullet of game.bullets) {
      ctx.strokeStyle = bullet.enemy ? '#ff7691' : '#79eeff'; ctx.lineWidth = bullet.enemy ? 4 : 3;
      ctx.shadowColor = bullet.enemy ? '#ff365f' : '#38d9ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(bullet.x, bullet.y); ctx.lineTo(bullet.x - bullet.vx * 0.025, bullet.y - bullet.vy * 0.025); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (const enemy of game.enemies) drawEnemy(enemy);
    if (game.status !== 'over') drawPlayer(game.player, time);
    for (const particle of game.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife); ctx.fillStyle = particle.color;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.restore();
    if (game.player.power > 0 && game.status === 'playing') {
      ctx.fillStyle = 'rgba(7,18,33,.75)'; ctx.fillRect(W / 2 - 75, H - 24, 150, 5);
      ctx.fillStyle = '#bd8cff'; ctx.fillRect(W / 2 - 75, H - 24, 150 * (game.player.power / 10), 5);
    }
  }

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * ratio; canvas.height = H * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  }
  canvas.addEventListener('pointerdown', event => {
    if (game.status !== 'playing') return;
    canvas.setPointerCapture(event.pointerId);
    game.pointer = { active: true, ...pointerPosition(event) };
  });
  canvas.addEventListener('pointermove', event => {
    if (game.pointer.active) Object.assign(game.pointer, pointerPosition(event));
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => canvas.addEventListener(type, () => { game.pointer.active = false; }));

  document.querySelectorAll('[data-difficulty]').forEach(button => {
    button.addEventListener('click', () => {
      selectedDifficulty = button.dataset.difficulty;
      document.querySelectorAll('[data-difficulty]').forEach(card => {
        const selected = card === button;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-pressed', String(selected));
        card.querySelector('.difficulty-check').textContent = selected ? '✓' : '';
      });
    });
  });
  $('start-button').addEventListener('click', startGame);
  $('restart-button').addEventListener('click', startGame);
  $('resume-button').addEventListener('click', togglePause);
  ui.pauseButton.addEventListener('click', togglePause);
  document.querySelectorAll('[data-menu]').forEach(button => button.addEventListener('click', () => changeStatus('menu')));
  $('brand').addEventListener('click', event => { event.preventDefault(); if (game.status !== 'playing') changeStatus('menu'); });
  ui.soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    ui.soundButton.setAttribute('aria-label', soundEnabled ? 'Desativar som' : 'Ativar som');
    ui.soundButton.title = soundEnabled ? 'Desativar som' : 'Ativar som';
    $('sound-waves').setAttribute('d', soundEnabled ? 'M15 8.5a5 5 0 0 1 0 7m2.5-9.5a8.5 8.5 0 0 1 0 12' : 'm16 9 5 6m0-6-5 6');
    if (soundEnabled) beep(600);
  });

  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code) && game.status === 'playing') event.preventDefault();
    game.keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Escape' || event.code === 'KeyP') togglePause();
    if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement) && (game.status === 'menu' || game.status === 'over')) startGame();
  });
  window.addEventListener('keyup', event => game.keys.delete(event.code));
  window.addEventListener('blur', () => { if (game.status === 'playing') changeStatus('paused'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.status === 'playing') changeStatus('paused'); });
  window.addEventListener('resize', resize);

  resize();
  syncScreens();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.034, Math.max(0, (now - last) / 1000));
    last = now;
    if (game.status === 'playing') update(dt);
    else {
      for (const star of game.stars) { star.y += star.speed * dt * 0.22; if (star.y > H) star.y = 0; }
    }
    draw(now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
