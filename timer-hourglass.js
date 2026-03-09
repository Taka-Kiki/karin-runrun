/* ========================================
   みえるんタイマー - すなどけいモード
   Canvas アニメーション + Gemini フレーム合成版
   ======================================== */

const HourglassTimer = {
  // --- Canvas ---
  canvas: null,
  ctx: null,
  W: 240,
  H: 320,
  dpr: 1,

  // --- フレーム画像 ---
  frameImg: null,
  frameLoaded: false,

  // --- パーティクル ---
  TOTAL_STARS: 15,
  stars: [],
  sparkles: [],

  // --- 状態 ---
  progress: 0,
  frameCount: 0,
  lastTimestamp: 0,

  // --- クリップパス（init時にキャッシュ） ---
  upperClip: null,
  lowerClip: null,

  // =============================================
  //  初期化
  // =============================================
  init() {
    this.canvas = document.getElementById('hourglass-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.setupDPI();
    this.loadFrameImage();
    this.upperClip = this.buildUpperBulbPath();
    this.lowerClip = this.buildLowerBulbPath();
    this.initStars();
    this.drawFrame(0);
  },

  setupDPI() {
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  },

  loadFrameImage() {
    const img = new Image();
    img.onload = () => {
      this.frameImg = img;
      this.frameLoaded = true;
      this.drawFrame(this.progress);
    };
    img.src = 'images/hourglass-frame-transparent.png';
  },

  // =============================================
  //  バルブ形状（ベジエ曲線）
  //  生成フレーム画像に合わせた正規化座標
  // =============================================
  buildUpperBulbPath() {
    const p = new Path2D();
    const W = this.W, H = this.H;

    // 上バルブ内部: キャップ下(0.14) → 最大幅(0.26) → ネック(0.47)
    p.moveTo(0.37 * W, 0.14 * H);

    // 左側: 上端 → 最大幅
    p.bezierCurveTo(
      0.29 * W, 0.15 * H,
      0.27 * W, 0.20 * H,
      0.29 * W, 0.26 * H
    );
    // 左側: 最大幅 → ネック
    p.bezierCurveTo(
      0.31 * W, 0.34 * H,
      0.39 * W, 0.42 * H,
      0.47 * W, 0.47 * H
    );

    p.lineTo(0.53 * W, 0.47 * H);

    // 右側: ネック → 最大幅
    p.bezierCurveTo(
      0.61 * W, 0.42 * H,
      0.69 * W, 0.34 * H,
      0.71 * W, 0.26 * H
    );
    // 右側: 最大幅 → 上端
    p.bezierCurveTo(
      0.73 * W, 0.20 * H,
      0.71 * W, 0.15 * H,
      0.63 * W, 0.14 * H
    );

    p.closePath();
    return p;
  },

  buildLowerBulbPath() {
    const p = new Path2D();
    const W = this.W, H = this.H;

    // 下バルブ内部: ネック(0.53) → 最大幅(0.74) → 底(0.86)
    p.moveTo(0.47 * W, 0.53 * H);

    // 左側: ネック → 最大幅
    p.bezierCurveTo(
      0.39 * W, 0.58 * H,
      0.31 * W, 0.66 * H,
      0.29 * W, 0.74 * H
    );
    // 左側: 最大幅 → 底
    p.bezierCurveTo(
      0.27 * W, 0.80 * H,
      0.29 * W, 0.85 * H,
      0.37 * W, 0.86 * H
    );

    p.lineTo(0.63 * W, 0.86 * H);

    // 右側: 底 → 最大幅
    p.bezierCurveTo(
      0.71 * W, 0.85 * H,
      0.73 * W, 0.80 * H,
      0.71 * W, 0.74 * H
    );
    // 右側: 最大幅 → ネック
    p.bezierCurveTo(
      0.69 * W, 0.66 * H,
      0.61 * W, 0.58 * H,
      0.53 * W, 0.53 * H
    );

    p.closePath();
    return p;
  },

  // バルブ内の幅を返す（星配置用）
  upperBulbHalfWidth(ny) {
    if (ny <= 0.14 || ny >= 0.47) return 0.04;
    const widestY = 0.26;
    const maxHW = 0.20;
    if (ny <= widestY) {
      const t = (ny - 0.14) / (widestY - 0.14);
      return 0.12 + (maxHW - 0.12) * Math.sin(t * Math.PI / 2);
    }
    const t = (ny - widestY) / (0.47 - widestY);
    return maxHW * (1 - t * t) + 0.04 * t * t;
  },

  lowerBulbHalfWidth(ny) {
    if (ny <= 0.53 || ny >= 0.86) return 0.04;
    return this.upperBulbHalfWidth(1.0 - ny);
  },

  // =============================================
  //  星パーティクルシステム
  // =============================================
  initStars() {
    this.stars = [];
    for (let i = 0; i < this.TOTAL_STARS; i++) {
      this.stars.push(this.createStar('upper'));
    }
    this.sparkles = [];
  },

  createStar(bulb) {
    const W = this.W, H = this.H;
    let y, hw, x;

    if (bulb === 'upper') {
      y = (0.18 + Math.random() * 0.24) * H;
      hw = this.upperBulbHalfWidth(y / H) * W;
      x = 0.50 * W + (Math.random() - 0.5) * hw * 1.4;
    } else {
      y = (0.58 + Math.random() * 0.24) * H;
      hw = this.lowerBulbHalfWidth(y / H) * W;
      x = 0.50 * W + (Math.random() - 0.5) * hw * 1.4;
    }

    return {
      bulb,
      x, y,
      size: 5 + Math.random() * 6,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      bobPhase: Math.random() * Math.PI * 2,
      bobAmp: 0.4 + Math.random() * 0.8,
      glowPhase: Math.random() * Math.PI * 2,
      fallSpeed: 0,
    };
  },

  updateStars(progress, dt) {
    const targetUpper = Math.ceil(this.TOTAL_STARS * (1 - progress));

    let upperCount = 0;
    let fallingCount = 0;
    for (const s of this.stars) {
      if (s.bulb === 'upper') upperCount++;
      else if (s.bulb === 'falling') fallingCount++;
    }

    // 上から落下へ移す
    if (upperCount > targetUpper && fallingCount < 2) {
      let best = null;
      let bestY = -1;
      for (const s of this.stars) {
        if (s.bulb === 'upper' && s.y > bestY) {
          bestY = s.y;
          best = s;
        }
      }
      if (best) {
        best.bulb = 'falling';
        best.x = 0.50 * this.W;
        best.y = 0.46 * this.H;
        best.fallSpeed = 50 + Math.random() * 30;
        best.wobblePhase = 0;
      }
    }

    // 各星の更新
    for (const s of this.stars) {
      if (s.bulb === 'falling') {
        s.y += s.fallSpeed * dt;
        s.wobblePhase = (s.wobblePhase || 0) + 4 * dt;
        s.x = 0.50 * this.W + Math.sin(s.wobblePhase) * 3;
        s.rotation += 0.08;

        if (s.y > 0.56 * this.H) {
          s.bulb = 'lower';
          s.y = (0.58 + Math.random() * 0.08) * this.H;
          const hw = this.lowerBulbHalfWidth(s.y / this.H) * this.W;
          s.x = 0.50 * this.W + (Math.random() - 0.5) * hw * 1.2;
        }
      } else {
        // ゆらゆら浮遊
        s.bobPhase += 0.025;
        s.rotation += s.rotSpeed;
        s.glowPhase += 0.03;

        const ny = s.y / this.H;
        const hw = (s.bulb === 'upper'
          ? this.upperBulbHalfWidth(ny)
          : this.lowerBulbHalfWidth(ny)) * this.W;
        const cx = 0.50 * this.W;

        // はみ出し補正
        if (Math.abs(s.x - cx) > hw * 0.85) {
          s.x = cx + Math.sign(s.x - cx) * hw * 0.85;
        }
      }
    }
  },

  // キラキラ粒子
  updateSparkles(dt) {
    if (this.progress > 0.005 && this.progress < 0.995) {
      if (Math.random() < 0.35) {
        this.sparkles.push({
          x: (0.47 + Math.random() * 0.06) * this.W,
          y: (0.44 + Math.random() * 0.04) * this.H,
          vy: 45 + Math.random() * 25,
          size: 1 + Math.random() * 2.5,
          phase: Math.random() * Math.PI * 2,
          life: 0.6 + Math.random() * 0.4,
          maxLife: 1.0,
        });
      }
    }

    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.y += sp.vy * dt;
      sp.x += Math.sin(sp.phase) * 0.4;
      sp.phase += 0.12;
      sp.life -= dt;
      if (sp.life <= 0 || sp.y > 0.58 * this.H) {
        this.sparkles.splice(i, 1);
      }
    }

    if (this.sparkles.length > 25) {
      this.sparkles.splice(0, this.sparkles.length - 25);
    }
  },

  // =============================================
  //  描画
  // =============================================

  // --- 液体 ---
  drawLiquid(ctx, progress) {
    if (progress < 0.995) this.drawUpperLiquid(ctx, progress);
    if (progress > 0.005) this.drawLowerLiquid(ctx, progress);

    // ネック部の液体の流れ
    if (progress > 0.005 && progress < 0.995) {
      const grad = ctx.createLinearGradient(0, 0.44 * this.H, 0, 0.56 * this.H);
      grad.addColorStop(0, 'rgba(255, 213, 79, 0.6)');
      grad.addColorStop(0.5, 'rgba(255, 179, 0, 0.8)');
      grad.addColorStop(1, 'rgba(255, 213, 79, 0.6)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0.50 * this.W, 0.50 * this.H, 3, 0.06 * this.H, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawUpperLiquid(ctx, progress) {
    const W = this.W, H = this.H;
    // 液面: progress 0→1 で 0.16→0.46 に下がる
    const surfaceY = (0.16 + 0.30 * progress) * H;

    ctx.save();
    ctx.clip(this.upperClip);

    const grad = ctx.createLinearGradient(0, surfaceY, 0, 0.46 * H);
    grad.addColorStop(0, '#FFE082');
    grad.addColorStop(0.5, '#FFD54F');
    grad.addColorStop(1, '#FFB300');
    ctx.fillStyle = grad;
    ctx.fillRect(0, surfaceY, W, 0.46 * H - surfaceY + 1);

    // 液面ハイライト
    this.drawLiquidSurface(ctx, surfaceY);

    ctx.restore();
  },

  drawLowerLiquid(ctx, progress) {
    const W = this.W, H = this.H;
    // 液面: progress 0→1 で 0.84→0.54 に上がる
    const surfaceY = (0.84 - 0.30 * progress) * H;

    ctx.save();
    ctx.clip(this.lowerClip);

    const grad = ctx.createLinearGradient(0, surfaceY, 0, 0.86 * H);
    grad.addColorStop(0, '#FFE082');
    grad.addColorStop(0.5, '#FFD54F');
    grad.addColorStop(1, '#FFB300');
    ctx.fillStyle = grad;
    ctx.fillRect(0, surfaceY, W, 0.86 * H - surfaceY + 1);

    this.drawLiquidSurface(ctx, surfaceY);

    ctx.restore();
  },

  drawLiquidSurface(ctx, y) {
    const cx = 0.50 * this.W;
    const hw = Math.max(
      this.upperBulbHalfWidth(y / this.H),
      this.lowerBulbHalfWidth(y / this.H)
    ) * this.W;
    const time = this.frameCount * 0.06;

    ctx.beginPath();
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = cx - hw + t * hw * 2;
      const wobble = Math.sin(t * Math.PI * 2.5 + time) * 1.5;
      if (i === 0) ctx.moveTo(px, y + wobble);
      else ctx.lineTo(px, y + wobble);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  // --- 星 ---
  drawStars(ctx) {
    for (const s of this.stars) {
      const glow = 0.5 + 0.5 * Math.sin(s.glowPhase || 0);
      this.drawOneStar(ctx, s.x, s.y, s.size, s.rotation, glow);
    }
  },

  drawOneStar(ctx, x, y, size, rotation, glow) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // グロー効果
    ctx.shadowColor = 'rgba(255, 200, 50, ' + (0.3 + glow * 0.3) + ')';
    ctx.shadowBlur = size * 0.7;

    // 五芒星パス
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerA = (i * 2 * Math.PI / 5) - Math.PI / 2;
      const innerA = outerA + Math.PI / 5;
      const outerR = size;
      const innerR = size * 0.4;
      if (i === 0) ctx.moveTo(Math.cos(outerA) * outerR, Math.sin(outerA) * outerR);
      else ctx.lineTo(Math.cos(outerA) * outerR, Math.sin(outerA) * outerR);
      ctx.lineTo(Math.cos(innerA) * innerR, Math.sin(innerA) * innerR);
    }
    ctx.closePath();

    // グラデーション塗り
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    g.addColorStop(0, '#FFF176');
    g.addColorStop(0.6, '#FFD54F');
    g.addColorStop(1, '#FFB300');
    ctx.fillStyle = g;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.restore();
  },

  // --- キラキラ粒子 ---
  drawSparkles(ctx) {
    for (const sp of this.sparkles) {
      const alpha = Math.max(0, sp.life / sp.maxLife) * 0.8;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFF9C4';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  // --- ガラス内部の下地描画 ---
  drawGlassBase(ctx) {
    ctx.save();
    ctx.fillStyle = '#FBF1E1';
    ctx.fill(this.upperClip);
    ctx.fill(this.lowerClip);
    ctx.restore();
  },

  // --- フレーム画像合成 ---
  drawFrameImage(ctx) {
    if (!this.frameLoaded) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.frameImg, 0, 0, this.W, this.H);
    ctx.restore();
  },

  // =============================================
  //  メイン描画
  // =============================================
  drawFrame(progress) {
    const ctx = this.ctx;
    this.frameCount++;

    const now = performance.now();
    const dt = Math.min((now - (this.lastTimestamp || now)) / 1000, 0.05);
    this.lastTimestamp = now;

    // 1. 背景クリア（透明にしてCSS背景色を見せる）
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.W, this.H);

    // 2. ガラス内部にベージュ下地を塗る（multiply用の明るいベース）
    this.drawGlassBase(ctx);

    // 3. パーティクル更新
    this.updateStars(progress, dt);
    this.updateSparkles(dt);

    // 4. 液体描画（バルブ形状でクリップ）
    this.drawLiquid(ctx, progress);

    // 5. 星描画
    this.drawStars(ctx);

    // 6. キラキラ粒子描画
    this.drawSparkles(ctx);

    // 7. フレーム画像をmultiplyで合成（透過背景なので外側に影響なし）
    this.drawFrameImage(ctx);
  },

  // =============================================
  //  公開インターフェース
  // =============================================
  update(progress) {
    this.progress = progress;
    this.drawFrame(progress);
  },

  reset() {
    this.progress = 0;
    this.frameCount = 0;
    this.lastTimestamp = 0;
    this.initStars();
    this.sparkles = [];
    this.drawFrame(0);
  },

  updateTimeDisplay(minutes, seconds) {
    const el = document.getElementById('hg-time-text');
    el.textContent =
      String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  },
};
