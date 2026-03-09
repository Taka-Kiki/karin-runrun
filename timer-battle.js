/* ========================================
   みえるんタイマー - たたかいモード
   勇者がモンスターと戦う視覚表現
   セグメントHPバー + マルチウェーブ + フェーズ変化
   ======================================== */

const BattleTimer = {
  canvas: null,
  ctx: null,
  w: 360,
  h: 280,
  frameCount: 0,
  completionFrame: -1,

  // ウェーブシステム
  waves: [],              // [{id, name, color, startProgress, endProgress}, ...]
  currentWaveIndex: 0,
  currentMonster: 'slime',
  totalSeconds: 0,

  // 敵の定義
  ENEMY_DEFS: {
    slime:  { i18nKey: 'enemy-slime',  color: '#00B8D4' },
    golem:  { i18nKey: 'enemy-golem',  color: '#F57C00' },
    dragon: { i18nKey: 'enemy-dragon', color: '#D32F2F' },
    demon:  { i18nKey: 'enemy-demon',  color: '#7B1FA2' },
  },

  // 時間帯によるウェーブ境界（秒）
  WAVE_BREAKPOINTS: [
    { startSec: 0,    id: 'slime' },   // 0秒～
    { startSec: 300,  id: 'golem' },   // 5分～
    { startSec: 900,  id: 'dragon' },  // 15分～
    { startSec: 1800, id: 'demon' },   // 30分～
  ],

  images: {},
  imagesLoaded: false,
  _dmgCanvas: null,  // ダメージオーバーレイ用オフスクリーンcanvas
  _dmgCtx: null,

  // 攻撃エフェクト
  attackFlash: 0,
  lastAttackProgress: 0,
  shakeAmount: 0,
  particles: [],

  // スライム撃破アニメーション
  slimeDefeatFrame: [0, 0, 0],
  SLIME_DEFEAT_DURATION: 25,

  // ウェーブ切替演出
  waveTransition: null,  // { frame, totalFrames, text }

  // 白背景を透過処理（キャラ画像用）
  removeWhiteBg(img) {
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 248) {
          d[i + 3] = 0;
        } else if (brightness > 225) {
          d[i + 3] = Math.round((248 - brightness) / 23 * d[i + 3]);
        }
      }
      ctx.putImageData(data, 0, 0);
      return c;
    } catch (e) {
      console.warn('removeWhiteBg skipped (CORS):', e.message);
      return img;
    }
  },

  // レイアウト
  HERO_X: 80,
  HERO_Y: 170,
  HERO_SIZE: 83,
  MONSTER_X: 260,
  MONSTER_Y: 150,
  MONSTER_SIZE: 120,
  MONSTER_SIZES: {
    dragon: 160,
    demon: 160,
  },
  SLIME_SIZE: 48,
  SLIME_OFFSETS: [
    { x: 0, y: -30 },
    { x: -28, y: 15 },
    { x: 28, y: 15 },
  ],
  ATTACK_CYCLE_LEN: 70,

  // セグメントHPバー（全幅）
  HP_LABEL_X: 10,
  HP_BAR_X: 38,
  HP_BAR_Y: 6,
  HP_BAR_W: 312,
  HP_BAR_H: 22,

  // --- ウェーブ生成 ---
  generateWaves(totalSeconds) {
    const waves = [];
    for (let i = 0; i < this.WAVE_BREAKPOINTS.length; i++) {
      const bp = this.WAVE_BREAKPOINTS[i];
      if (bp.startSec >= totalSeconds) break;
      const nextStart = (i + 1 < this.WAVE_BREAKPOINTS.length)
        ? this.WAVE_BREAKPOINTS[i + 1].startSec
        : Infinity;
      const endSec = Math.min(totalSeconds, nextStart);
      const def = this.ENEMY_DEFS[bp.id];
      waves.push({
        id: bp.id,
        i18nKey: def.i18nKey,
        color: def.color,
        startProgress: bp.startSec / totalSeconds,
        endProgress: endSec / totalSeconds,
      });
    }
    return waves;
  },

  // 現在のウェーブインデックス
  getCurrentWaveIndex(progress) {
    for (let i = 0; i < this.waves.length; i++) {
      if (progress < this.waves[i].endProgress) return i;
    }
    return this.waves.length - 1;
  },

  // ウェーブ内ローカル進捗（0→1）
  getWaveLocalProgress(progress) {
    if (this.waves.length === 0) return 0;
    const wave = this.waves[this.currentWaveIndex];
    if (!wave) return 0;
    const range = wave.endProgress - wave.startProgress;
    if (range <= 0) return 1;
    return Math.min(1, Math.max(0, (progress - wave.startProgress) / range));
  },

  init() {
    this.canvas = document.getElementById('battle-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.setupDPI();
    this.loadImages();
    this.drawFrame(0);
  },

  setupDPI() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.scale(dpr, dpr);
  },

  setDuration(totalSeconds) {
    this.totalSeconds = totalSeconds;
    this.waves = this.generateWaves(totalSeconds);
    this.currentWaveIndex = 0;
    this.waveTransition = null;
    if (this.waves.length > 0) {
      this.currentMonster = this.waves[0].id;
    }
  },

  loadImages() {
    const srcs = {
      bg: 'images/battle-bg.png',
      hero: 'images/battle-hero.png',
      slime: 'images/battle-slime.png',
      golem: 'images/battle-golem.png',
      dragon: 'images/battle-dragon.png',
      demon: 'images/battle-demon.png',
    };
    let loaded = 0;
    const total = Object.keys(srcs).length;
    for (const [key, src] of Object.entries(srcs)) {
      const img = new Image();
      img.onload = () => {
        this.images[key] = img;
        loaded++;
        if (loaded === total) {
          this.imagesLoaded = true;
          this.drawFrame(0);
        }
      };
      img.onerror = () => {
        console.error('Failed to load image:', src);
        loaded++;
      };
      img.src = src;
    }
  },

  drawFrame(progress) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    this.frameCount++;

    if (!this.imagesLoaded) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('よみこみちゅう...', this.w / 2, this.h / 2);
      ctx.textAlign = 'start';
      return;
    }

    // ウェーブ切替チェック
    if (this.waves.length > 0 && progress > 0 && progress < 1) {
      const newIndex = this.getCurrentWaveIndex(progress);
      if (newIndex > this.currentWaveIndex) {
        const defeated = this.waves[this.currentWaveIndex];
        this.waveTransition = {
          frame: 0,
          totalFrames: 55,
          text: I18n.get(defeated.i18nKey) + I18n.get('enemy-defeated'),
        };
        this.currentWaveIndex = newIndex;
        this.currentMonster = this.waves[newIndex].id;
        this.slimeDefeatFrame = [0, 0, 0];
        this.spawnWaveDefeatParticles();
        this.shakeAmount = 15;
      }
    }

    // 攻撃エフェクト更新
    this.updateAttackEffects(progress);

    // 1. 背景
    ctx.drawImage(this.images.bg, 0, 0, this.w, this.h);

    // 2. セグメントHPバー
    this.drawHPBar(ctx, progress);

    // 3. 勇者
    this.drawHero(ctx, progress);

    // 4. モンスター
    this.drawMonster(ctx, progress);

    // 5. パーティクル
    this.drawParticles(ctx);

    // 6. ウェーブ切替テキスト演出
    if (this.waveTransition) {
      this.drawWaveTransition(ctx);
    }

    // 7. 全撃破エフェクト
    if (progress >= 1) {
      if (this.currentMonster === 'slime') {
        if (this.slimeDefeatFrame[2] > this.SLIME_DEFEAT_DURATION) {
          this.drawDefeatEffect(ctx);
        }
      } else {
        this.drawDefeatEffect(ctx);
      }
    }
  },

  // --- セグメントHPバー描画 ---
  // バー配置: 右端＝最初の敵(slime), 左端＝最後の敵
  // HPは右から左へ減少（標準的なHP表示）
  drawHPBar(ctx, progress) {
    const { HP_LABEL_X: lx, HP_BAR_X: bx, HP_BAR_Y: by, HP_BAR_W: bw, HP_BAR_H: bh } = this;
    const remaining = Math.max(0, 1 - progress);
    const filledW = bw * remaining;

    // HPラベル
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText('HP', lx, by + bh / 2);
    ctx.fillText('HP', lx, by + bh / 2);
    ctx.textBaseline = 'alphabetic';

    // バー背景（消費済みエリア）
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 5);
    ctx.fill();

    // クリップ領域でセグメント端を角丸に
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx + 1, by + 1, bw - 2, bh - 2, 4);
    ctx.clip();

    // 各ウェーブセグメント描画
    for (let i = 0; i < this.waves.length; i++) {
      const wave = this.waves[i];
      // バー上の位置（右端=progress 0, 左端=progress 1）
      const segRight = bx + bw * (1 - wave.startProgress);
      const segLeft  = bx + bw * (1 - wave.endProgress);

      // 残HP領域（bx ～ bx+filledW）とのクリップ
      const drawLeft  = Math.max(segLeft, bx);
      const drawRight = Math.min(segRight, bx + filledW);
      if (drawRight <= drawLeft) continue;

      // セグメント色
      ctx.fillStyle = wave.color;

      // アクティブウェーブはパルス演出
      const isActive = (i === this.currentWaveIndex && progress > 0 && progress < 1);
      if (isActive) {
        const pulse = 0.85 + 0.15 * Math.sin(this.frameCount * 0.07);
        ctx.globalAlpha = pulse;
      }

      ctx.fillRect(drawLeft, by + 2, drawRight - drawLeft, bh - 4);
      ctx.globalAlpha = 1;
    }

    // セグメント区切り線
    for (let i = 1; i < this.waves.length; i++) {
      const wave = this.waves[i];
      const divX = bx + bw * (1 - wave.startProgress);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(divX, by + 1);
      ctx.lineTo(divX, by + bh - 1);
      ctx.stroke();
    }

    ctx.restore(); // クリップ解除

    // 枠線
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 5);
    ctx.stroke();

    // 敵名ラベル（バーの下）
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < this.waves.length; i++) {
      const wave = this.waves[i];
      const segRight = bx + bw * (1 - wave.startProgress);
      const segLeft  = bx + bw * (1 - wave.endProgress);
      const segWidth = segRight - segLeft;
      if (segWidth < 28) continue; // 狭すぎるセグメントはラベル省略

      const segCenter = (segLeft + segRight) / 2;
      const isDepleted = (progress >= wave.endProgress);
      const isActive = (i === this.currentWaveIndex && progress < 1);
      ctx.fillStyle = isActive ? '#FFD700' : isDepleted ? '#555' : '#bbb';
      ctx.fillText(I18n.get(wave.i18nKey), segCenter, by + bh + 13);
    }
    ctx.textAlign = 'start';
  },

  drawHero(ctx, progress) {
    const { HERO_X, HERO_Y, HERO_SIZE, MONSTER_X, MONSTER_SIZE } = this;
    const drawW = HERO_SIZE * 0.85;
    const drawH = HERO_SIZE;

    // タイマー非動作時は静止ポーズ
    if (progress <= 0 || progress >= 1) {
      ctx.drawImage(this.images.hero, HERO_X - drawW / 2, HERO_Y - drawH / 2, drawW, drawH);
      return;
    }

    // 攻撃サイクル（70フレーム周期）
    const cycle = this.frameCount % this.ATTACK_CYCLE_LEN;
    const mSize = this.MONSTER_SIZES[this.currentMonster] || MONSTER_SIZE;
    const maxLunge = MONSTER_X - mSize / 2 - HERO_X - 15;
    let offsetX = 0;
    let swingAngle = 0;

    if (cycle < 8) {
      // ためる（後ろに引く）
      const t = cycle / 8;
      offsetX = -8 * Math.sin(t * Math.PI / 2);
      swingAngle = -0.12 * t;
    } else if (cycle < 16) {
      // 突進！
      const t = (cycle - 8) / 8;
      const ease = t * t;
      offsetX = -8 + (maxLunge + 8) * ease;
      swingAngle = -0.12 + 0.45 * ease;
    } else if (cycle < 22) {
      // ヒット＋斬撃
      const t = (cycle - 16) / 6;
      offsetX = maxLunge * (1 - t * 0.1);
      swingAngle = 0.33 * (1 - t);
      if (cycle === 16) {
        this.shakeAmount = 12;
        this.spawnHitParticles();
      }
    } else if (cycle < 35) {
      // 戻る
      const t = (cycle - 22) / 13;
      const ease = t * (2 - t);
      offsetX = maxLunge * 0.9 * (1 - ease);
    } else {
      // 待機（呼吸アニメーション）
      const breathe = Math.sin((cycle - 35) * 0.12) * 2;
      offsetX = breathe;
    }

    ctx.save();
    ctx.translate(HERO_X + offsetX, HERO_Y);
    ctx.rotate(swingAngle);
    ctx.drawImage(this.images.hero, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  },

  drawMonster(ctx, progress) {
    const { MONSTER_X, MONSTER_Y, MONSTER_SIZE } = this;
    const monsterImg = this.images[this.currentMonster];
    if (!monsterImg) return;

    const localProg = this.getWaveLocalProgress(progress);

    // --- フェーズ変化パラメータ ---
    let phaseAlpha = 1;
    let phaseSizeScale = 1;
    let phaseExtraShake = 0;
    let phaseDamageOverlay = 0;

    if (progress > 0 && progress < 1 && this.currentMonster !== 'slime') {
      if (localProg > 0.3 && localProg <= 0.6) {
        // Phase 2: ダメージ蓄積
        phaseDamageOverlay = 0.08;
        phaseExtraShake = 1;
      } else if (localProg > 0.6 && localProg <= 0.9) {
        // Phase 3: 瀕死
        phaseDamageOverlay = 0.15;
        phaseSizeScale = 0.93;
        phaseExtraShake = 2;
      } else if (localProg > 0.9) {
        // Phase 4: 撃破直前（点滅）
        phaseAlpha = 0.5 + 0.5 * ((Math.sin(this.frameCount * 0.25) + 1) / 2);
        phaseSizeScale = 0.88;
        phaseExtraShake = 3;
        phaseDamageOverlay = 0.22;
      }
    }

    // 全ウェーブ撃破後の点滅（スライム以外）
    if (progress >= 1 && this.currentMonster !== 'slime') {
      phaseAlpha = (Math.sin(this.frameCount * 0.3) + 1) / 2 * 0.5;
    }

    // ウェーブ切替直後のフェードイン
    if (this.waveTransition && this.waveTransition.frame < 15) {
      const fadeIn = this.waveTransition.frame / 15;
      phaseAlpha *= fadeIn;
    }

    // 振動（ヒット＋フェーズ追加）
    const totalShake = this.shakeAmount + phaseExtraShake;
    const shakeX = totalShake * Math.sin(this.frameCount * 0.5);
    const shakeY = totalShake * Math.cos(this.frameCount * 0.7) * 0.5;

    ctx.save();
    ctx.globalAlpha = phaseAlpha;

    if (this.currentMonster === 'slime') {
      this.drawSlimes(ctx, progress, localProg, shakeX, shakeY);
    } else {
      // 単体モンスター描画
      const mSize = (this.MONSTER_SIZES[this.currentMonster] || MONSTER_SIZE) * phaseSizeScale;
      ctx.drawImage(
        monsterImg,
        MONSTER_X - mSize / 2 + shakeX,
        MONSTER_Y - mSize / 2 + shakeY,
        mSize, mSize
      );

      // ダメージオーバーレイ（敵画像の形に合わせたsource-atop合成）
      if (phaseDamageOverlay > 0) {
        const sz = Math.ceil(mSize);
        if (!this._dmgCanvas) {
          this._dmgCanvas = document.createElement('canvas');
          this._dmgCtx = this._dmgCanvas.getContext('2d');
        }
        const dc = this._dmgCanvas;
        const dCtx = this._dmgCtx;
        if (dc.width !== sz || dc.height !== sz) {
          dc.width = sz;
          dc.height = sz;
        } else {
          dCtx.clearRect(0, 0, sz, sz);
        }
        // オフスクリーンにモンスター描画
        dCtx.globalAlpha = 1;
        dCtx.globalCompositeOperation = 'source-over';
        dCtx.drawImage(monsterImg, 0, 0, sz, sz);
        // source-atop: モンスターの不透明ピクセルのみに赤を重ねる
        dCtx.globalCompositeOperation = 'source-atop';
        dCtx.fillStyle = '#ff0000';
        dCtx.globalAlpha = phaseDamageOverlay / phaseAlpha;
        dCtx.fillRect(0, 0, sz, sz);
        dCtx.globalCompositeOperation = 'source-over';
        dCtx.globalAlpha = 1;
        // メインcanvasに描画
        ctx.drawImage(dc,
          MONSTER_X - mSize / 2 + shakeX,
          MONSTER_Y - mSize / 2 + shakeY,
          mSize, mSize
        );
      }
    }

    ctx.restore();
  },

  // スライム3匹描画（ウェーブ内ローカル進捗で段階撃破）
  drawSlimes(ctx, progress, localProg, shakeX, shakeY) {
    const { MONSTER_X, MONSTER_Y } = this;
    const monsterImg = this.images.slime;
    if (!monsterImg) return;

    const sz = this.SLIME_SIZE;
    const thresholds = [0.33, 0.66, 0.96];
    const dur = this.SLIME_DEFEAT_DURATION;

    // 撃破トリガー検出（ローカル進捗基準）
    for (let i = 0; i < 3; i++) {
      if (this.slimeDefeatFrame[i] === 0 && localProg >= thresholds[i]) {
        this.slimeDefeatFrame[i] = 1;
        const offset = this.SLIME_OFFSETS[i];
        this.spawnSlimeDefeatParticles(MONSTER_X + offset.x, MONSTER_Y + offset.y);
      }
    }

    for (let i = 0; i < this.SLIME_OFFSETS.length; i++) {
      const offset = this.SLIME_OFFSETS[i];
      const df = this.slimeDefeatFrame[i];

      if (df > dur) continue;

      if (df > 0) {
        // 撃破アニメーション中
        const t = df / dur;
        ctx.save();
        const cx = MONSTER_X + offset.x + shakeX;
        const cy = MONSTER_Y + offset.y + shakeY;

        if (t <= 0.3) {
          const squish = t / 0.3;
          const scaleX = 1 + squish * 0.5;
          const scaleY = 1 - squish * 0.6;
          ctx.translate(cx, cy);
          ctx.scale(scaleX, scaleY);
          ctx.drawImage(monsterImg, -sz / 2, -sz / 2, sz, sz);
        } else {
          const flyT = (t - 0.3) / 0.7;
          const ease = flyT * flyT;
          const flyY = -80 * ease;
          const flyX = (i === 0 ? 0 : i === 1 ? -40 : 40) * ease;
          const shrink = 1 - ease;
          const flyAlpha = 1 - ease;
          ctx.globalAlpha = flyAlpha;
          ctx.translate(cx + flyX, cy + flyY);
          ctx.rotate(flyT * (i === 1 ? -2 : 2));
          ctx.scale(shrink, shrink);
          ctx.drawImage(monsterImg, -sz / 2, -sz / 2, sz, sz);
        }
        ctx.restore();
      } else {
        // 通常表示（生存中）
        ctx.drawImage(
          monsterImg,
          MONSTER_X + offset.x - sz / 2 + shakeX,
          MONSTER_Y + offset.y - sz / 2 + shakeY,
          sz, sz
        );
      }
    }
  },

  // --- ウェーブ切替演出 ---
  drawWaveTransition(ctx) {
    const t = this.waveTransition;
    if (!t) return;
    const p = t.frame / t.totalFrames;

    // 半透明暗幕
    if (p < 0.5) {
      const overlayAlpha = p < 0.15
        ? (p / 0.15) * 0.35
        : 0.35 * (1 - (p - 0.15) / 0.35);
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, overlayAlpha)})`;
      ctx.fillRect(0, 45, this.w, this.h - 45);
    }

    // 撃破テキスト
    if (p > 0.05 && p < 0.75) {
      const textAlpha = p < 0.15
        ? (p - 0.05) / 0.1
        : p > 0.55 ? (0.75 - p) / 0.2 : 1;

      ctx.save();
      ctx.globalAlpha = Math.max(0, textAlpha);
      ctx.textAlign = 'center';

      // 縁取り
      ctx.font = 'bold 20px sans-serif';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(t.text, this.w / 2, this.h / 2 - 5);

      ctx.fillStyle = '#FFD700';
      ctx.fillText(t.text, this.w / 2, this.h / 2 - 5);
      ctx.restore();
    }
  },

  // ウェーブ撃破時のパーティクル
  spawnWaveDefeatParticles() {
    const { MONSTER_X, MONSTER_Y } = this;
    const colors = ['#FFD700', '#FF4444', '#FF8C00', '#fff', '#00BFFF'];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 3 + Math.random() * 5;
      this.particles.push({
        x: MONSTER_X + (Math.random() - 0.5) * 40,
        y: MONSTER_Y + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    }
  },

  updateAttackEffects(progress) {
    // 振動減衰
    this.shakeAmount *= 0.85;
    if (this.shakeAmount < 0.1) this.shakeAmount = 0;

    this.lastAttackProgress = progress;

    // スライム撃破アニメフレーム進行
    for (let i = 0; i < 3; i++) {
      if (this.slimeDefeatFrame[i] > 0 && this.slimeDefeatFrame[i] <= this.SLIME_DEFEAT_DURATION) {
        this.slimeDefeatFrame[i]++;
      }
    }

    // ウェーブ切替演出フレーム進行
    if (this.waveTransition) {
      this.waveTransition.frame++;
      if (this.waveTransition.frame >= this.waveTransition.totalFrames) {
        this.waveTransition = null;
      }
    }

    // パーティクル更新
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.02;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  },

  spawnHitParticles() {
    const { MONSTER_X, MONSTER_Y } = this;
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x: MONSTER_X + (Math.random() - 0.5) * 60,
        y: MONSTER_Y + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 3,
        size: 4 + Math.random() * 8,
        color: ['#FFD700', '#FF4444', '#FF8C00', '#fff'][Math.floor(Math.random() * 4)],
        life: 1,
      });
    }
  },

  spawnSlimeDefeatParticles(cx, cy) {
    const colors = ['#00BFFF', '#87CEEB', '#FFD700', '#fff', '#00CED1'];
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      const speed = 3 + Math.random() * 4;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    }
    this.shakeAmount = 8;
  },

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;

      ctx.beginPath();
      const spikes = 4;
      const outerR = p.size;
      const innerR = p.size * 0.4;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        if (i === 0) ctx.moveTo(p.x + r * Math.cos(angle), p.y + r * Math.sin(angle));
        else ctx.lineTo(p.x + r * Math.cos(angle), p.y + r * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  drawDefeatEffect(ctx) {
    if (this.completionFrame < 0) this.completionFrame = 0;
    this.completionFrame++;
    const f = this.completionFrame;

    // アニメーション: ズームイン → オーバーシュート → 定着 → パルス
    let scale;
    if (f <= 12) {
      const t = f / 12;
      scale = 1.4 * (t * t * (3 - 2 * t));
    } else if (f <= 22) {
      const t = (f - 12) / 10;
      scale = 1.4 - 0.4 * (t * t * (3 - 2 * t));
    } else {
      scale = 1 + Math.sin((f - 22) * 0.08) * 0.04;
    }

    const alpha = Math.min(1, f / 8);

    const fontSize = 72;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.translate(this.w / 2, 50);
    ctx.scale(scale, scale);

    // ドロップシャドウ
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    ctx.strokeStyle = '#888';
    ctx.lineWidth = 6;
    ctx.strokeText('WIN!', 0, 0);

    ctx.shadowColor = 'transparent';
    const grad = ctx.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2);
    grad.addColorStop(0, '#FFF176');
    grad.addColorStop(0.5, '#FFD700');
    grad.addColorStop(1, '#FF8F00');
    ctx.fillStyle = grad;
    ctx.fillText('WIN!', 0, 0);

    ctx.restore();
  },

  update(progress) {
    this.drawFrame(progress);
  },

  reset() {
    this.frameCount = 0;
    this.particles = [];
    this.completionFrame = -1;
    this.shakeAmount = 0;
    this.lastAttackProgress = 0;
    this.slimeDefeatFrame = [0, 0, 0];
    this.currentWaveIndex = 0;
    this.waveTransition = null;
    if (this.waves.length > 0) {
      this.currentMonster = this.waves[0].id;
    }
    this.drawFrame(0);
  },

  updateTimeDisplay(minutes, seconds) {
    const el = document.getElementById('battle-time-text');
    if (el) el.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  },
};
