/* ========================================
   みえるんタイマー - ぼうけんモード
   横スクロール冒険の視覚表現
   スタート→ゴールの全体が常に見える
   ======================================== */

const AdventureTimer = {
  canvas: null,
  ctx: null,
  w: 360,
  h: 280,
  frameCount: 0,
  completionFrame: -1,

  images: {},
  imagesLoaded: false,

  // パス（スタート→ゴール）
  PATH_POINTS: [],
  START_X: 72,
  GOAL_X: 324,
  CHARACTER_SIZE: 40,
  CASTLE_X: 315,
  CASTLE_Y: 56,

  // 白背景を透過処理（キャラ・旗画像用）
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

  init() {
    this.canvas = document.getElementById('adventure-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.setupDPI();
    this.buildPath();
    this.loadImages();
    this.drawFrame(0);
  },

  setupDPI() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    // display size はCSSで制御（レスポンシブ対応）
    this.ctx.scale(dpr, dpr);
  },

  buildPath() {
    // パノラマの道に合わせたウェイポイント（なだらかな道）
    const waypoints = [
      { x: 72,  y: 231 },  // 小屋の入口
      { x: 104, y: 238 },  // 小屋から右へ
      { x: 140, y: 235 },  // 道のカーブ
      { x: 176, y: 217 },  // 橋の手前
      { x: 207, y: 203 },  // 橋の上
      { x: 239, y: 179 },  // 橋を渡ってまっすぐ上り
      { x: 270, y: 151 },  // なだらかな坂道
      { x: 302, y: 123 },  // お城への坂
      { x: 324, y: 98 },   // お城のふもと
    ];

    this.PATH_POINTS = [];
    const steps = 100;
    const totalX = waypoints[waypoints.length - 1].x - waypoints[0].x;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const targetX = waypoints[0].x + t * totalX;

      let j = 0;
      while (j < waypoints.length - 2 && waypoints[j + 1].x < targetX) j++;

      const wp1 = waypoints[j];
      const wp2 = waypoints[j + 1];
      const localT = (targetX - wp1.x) / (wp2.x - wp1.x);
      const smooth = localT * localT * (3 - 2 * localT);
      const y = wp1.y + smooth * (wp2.y - wp1.y);

      this.PATH_POINTS.push({ x: targetX, y });
    }
  },

  loadImages() {
    const srcs = {
      panorama: 'images/adventure-panorama.png',
      character: 'images/adventure-character.png',
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

  getPositionAtProgress(progress) {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const idx = Math.min(
      Math.floor(clampedProgress * (this.PATH_POINTS.length - 1)),
      this.PATH_POINTS.length - 1
    );
    return this.PATH_POINTS[idx];
  },

  drawFrame(progress) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    this.frameCount++;

    if (!this.imagesLoaded) {
      const grad = ctx.createLinearGradient(0, 0, 0, this.h);
      grad.addColorStop(0, '#87CEEB');
      grad.addColorStop(1, '#90EE90');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('よみこみちゅう...', this.w / 2, this.h / 2);
      ctx.textAlign = 'start';
      return;
    }

    // 1. パノラマ背景
    ctx.drawImage(this.images.panorama, 0, 0, this.w, this.h);

    // 2. スタートマーカー
    this.drawStartMarker(ctx);

    // 3. ゴール（旗）
    this.drawGoalMarker(ctx);

    // 4. キャラクター
    this.drawCharacter(ctx, progress);

    // 5. 完了演出
    if (progress >= 1) {
      this.drawCelebration(ctx);
    }
  },

  drawStartMarker(ctx) {
    const startPos = this.PATH_POINTS[0];
    if (!startPos) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeText('START', startPos.x, startPos.y + 18);
    ctx.fillText('START', startPos.x, startPos.y + 18);
    ctx.restore();
  },

  drawGoalMarker(ctx) {
    // シンプルな旗をお城の手前（道の終点の少し左下）に描画
    const goalPos = this.PATH_POINTS[this.PATH_POINTS.length - 1];
    if (!goalPos) return;
    const gx = goalPos.x - 18;
    const gy = goalPos.y;

    ctx.save();
    // 旗の棒
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy - 28);
    ctx.stroke();
    // 旗の三角形
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(gx, gy - 28);
    ctx.lineTo(gx + 14, gy - 22);
    ctx.lineTo(gx, gy - 16);
    ctx.closePath();
    ctx.fill();
    // GOALテキスト
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeText('GOAL', gx + 2, gy + 12);
    ctx.fillText('GOAL', gx + 2, gy + 12);
    ctx.restore();
  },

  drawCharacter(ctx, progress) {
    const pos = this.getPositionAtProgress(progress);
    const sz = this.CHARACTER_SIZE;

    // 歩きアニメーション（上下のバウンス）
    let bobY = 0;
    if (progress > 0 && progress < 1) {
      bobY = Math.abs(Math.sin(this.frameCount * 0.15)) * -4;
    }

    if (this.images.character) {
      ctx.drawImage(
        this.images.character,
        pos.x - sz / 2,
        pos.y - sz + bobY,
        sz, sz
      );
    } else {
      // フォールバック: 丸で代替
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - sz / 2 + bobY, sz / 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawCelebration(ctx) {
    if (this.completionFrame < 0) this.completionFrame = 0;
    this.completionFrame++;
    const f = this.completionFrame;

    // アニメーション: ズームイン → オーバーシュート → 定着 → パルス
    let scale;
    if (f <= 12) {
      // 0→1.4 にズームイン（イージング）
      const t = f / 12;
      scale = 1.4 * (t * t * (3 - 2 * t));
    } else if (f <= 22) {
      // 1.4→1.0 にバウンスバック
      const t = (f - 12) / 10;
      scale = 1.4 - 0.4 * (t * t * (3 - 2 * t));
    } else {
      // 定着後のゆるいパルス
      scale = 1 + Math.sin((f - 22) * 0.08) * 0.04;
    }

    // フェードイン（最初の8フレーム）
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
    ctx.strokeText('GOAL!', 0, 0);

    ctx.shadowColor = 'transparent';
    // グラデーション塗り
    const grad = ctx.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2);
    grad.addColorStop(0, '#FFF176');
    grad.addColorStop(0.5, '#FFD700');
    grad.addColorStop(1, '#FF8F00');
    ctx.fillStyle = grad;
    ctx.fillText('GOAL!', 0, 0);

    ctx.restore();
  },

  update(progress) {
    this.drawFrame(progress);
  },

  reset() {
    this.frameCount = 0;
    this.completionFrame = -1;
    this.drawFrame(0);
  },

  updateTimeDisplay(minutes, seconds) {
    const el = document.getElementById('adventure-time-text');
    if (el) el.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  },
};
