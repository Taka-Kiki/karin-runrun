/* ========================================
   みえるんタイマー - もぐもぐモード
   動物がごはんを1つずつ食べていく視覚表現
   ======================================== */

const FeedingTimer = {
  canvas: null,
  ctx: null,
  w: 360,
  h: 280,
  frameCount: 0,
  currentAnimal: 'hamster',

  // 動物ごとの画像設定
  imageConfig: {
    hamster: {
      bg: 'images/feeding-bg.png',
      animal: 'images/feeding-hamster.png',
      animalHappy: 'images/feeding-hamster-happy.png',
      food: 'images/feeding-hamster-food.png',
      foodSize: 28,
    },
    rabbit: {
      bg: 'images/feeding-bg.png',
      animal: 'images/feeding-rabbit.png',
      animalHappy: 'images/feeding-rabbit-happy.png',
      food: 'images/feeding-rabbit-food.png',
      foodSize: 38,
    },
    dog: {
      bg: 'images/feeding-bg.png',
      animal: 'images/feeding-dog.png',
      animalHappy: 'images/feeding-dog-happy.png',
      food: 'images/feeding-dog-food.png',
      foodSize: 38,
    },
    cat: {
      bg: 'images/feeding-bg.png',
      animal: 'images/feeding-cat.png',
      animalHappy: 'images/feeding-cat-happy.png',
      food: 'images/feeding-cat-food.png',
      foodSize: 28,
    },
  },

  images: {},
  imagesLoaded: false,
  loadedAnimal: null,

  // レイアウト定数
  FOOD_COUNT: 5,
  FOOD_START_X: 129,
  FOOD_END_X: 315,
  FOOD_BASE_Y: 235,
  FOOD_SIZE: 38,
  ANIMAL_SIZE: 95,

  init() {
    this.canvas = document.getElementById('feeding-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.setupDPI();
    this.drawFrame(0);
  },

  setupDPI() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    // display size はCSSで制御（レスポンシブ対応）
    this.ctx.scale(dpr, dpr);
  },

  setAnimal(animal) {
    this.currentAnimal = animal;
    if (this.loadedAnimal !== animal) {
      this.imagesLoaded = false;
      this.loadImages(animal);
    }
  },

  // 白背景を透過処理（フォールバック用）
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

  loadImages(animal) {
    const config = this.imageConfig[animal];
    if (!config) return;
    let loaded = 0;
    const imageEntries = Object.entries(config).filter(([, v]) => typeof v === 'string');
    const total = imageEntries.length;
    this.images = {};

    for (const [key, src] of imageEntries) {
      const img = new Image();
      img.onload = () => {
        this.images[key] = img;
        loaded++;
        if (loaded === total) {
          this.imagesLoaded = true;
          this.loadedAnimal = animal;
          this.drawFrame(0);
        }
      };
      img.onerror = () => {
        console.error('Failed to load image:', src);
        loaded++;
        if (loaded === total) {
          this.imagesLoaded = false;
          this.drawFrame(0);
        }
      };
      img.src = src;
    }
  },

  // 食べ物の位置配列を返す
  getFoodPositions() {
    const positions = [];
    const spacing = (this.FOOD_END_X - this.FOOD_START_X) / (this.FOOD_COUNT - 1);
    for (let i = 0; i < this.FOOD_COUNT; i++) {
      positions.push({
        x: this.FOOD_START_X + spacing * i,
        y: this.FOOD_BASE_Y,
      });
    }
    return positions;
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
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('よみこみちゅう...', this.w / 2, this.h / 2);
      ctx.textAlign = 'start';
      return;
    }

    // 1. 背景
    ctx.drawImage(this.images.bg, 0, 0, this.w, this.h);

    // 2. 食べ物（1つずつ減る）
    this.drawFoodItems(ctx, progress);

    // 3. 動物（もぐもぐ or 満足顔）
    if (progress >= 1) {
      this.drawAnimalHappy(ctx);
    } else {
      this.drawAnimal(ctx, progress);
    }
  },

  getFoodSize() {
    const config = this.imageConfig[this.currentAnimal];
    return (config && config.foodSize) || this.FOOD_SIZE;
  },

  drawFoodItems(ctx, progress) {
    const positions = this.getFoodPositions();
    const total = this.FOOD_COUNT;
    const baseSize = this.getFoodSize();

    // 何個食べたか & 今食べ中のアイテムの進捗
    const eatenFloat = progress * total; // 0～5
    const eatenCount = Math.floor(eatenFloat);
    const itemProgress = eatenFloat - eatenCount; // 0～1

    for (let i = 0; i < total; i++) {
      if (i < eatenCount) continue; // 食べ済み

      const pos = positions[i];

      if (i === eatenCount && progress < 1 && itemProgress > 0) {
        // 今食べられている最中 → かじり表現
        this.drawBittenFood(ctx, pos, baseSize, itemProgress);
      } else {
        // まだ食べられていない → そのまま描画
        ctx.drawImage(this.images.food, pos.x - baseSize / 2, pos.y - baseSize, baseSize, baseSize);
      }
    }
  },

  // かじられた食べ物を描画（波形クリッピングで左からかじられていく）
  drawBittenFood(ctx, pos, size, progress) {
    const fx = pos.x - size / 2;
    const fy = pos.y - size;

    // 食べ進んだ位置（左→右にスイープ）
    const eatEdge = fx + size * progress;

    // 残りが少なすぎたら描画しない
    if (eatEdge >= fx + size - 1) return;

    // 食べられ中は軽く揺れる（動物のもぐもぐと同期）
    const wobble = Math.sin(this.frameCount * 0.18) * 1.5;

    ctx.save();
    ctx.translate(0, wobble);

    // スキャロップ（波形）のかじり跡クリッピングパス
    ctx.beginPath();

    // 右上から開始
    ctx.moveTo(fx + size, fy);

    // 上辺を左へ（食べ端まで）
    ctx.lineTo(eatEdge, fy);

    // 波形のかじり跡を下方向に描画
    const numScallops = 3;
    const segH = size / numScallops;
    const depths = [0.14, 0.10, 0.16]; // 各スキャロップの深さ（変化をつける）

    for (let i = 0; i < numScallops; i++) {
      const y1 = fy + i * segH;
      const y2 = fy + (i + 1) * segH;
      const midY = (y1 + y2) / 2;
      // かじり跡の深さ（右端を超えないよう制限）
      const indent = Math.min(size * depths[i], fx + size - eatEdge - 1);
      // 右方向へカーブ → 食べ物に凹み（かじり跡）ができる
      ctx.quadraticCurveTo(eatEdge + indent, midY, eatEdge, y2);
    }

    // 下辺を右へ、閉じる
    ctx.lineTo(fx + size, fy + size);
    ctx.closePath();

    ctx.clip();
    ctx.drawImage(this.images.food, fx, fy, size, size);
    ctx.restore();
  },

  drawAnimal(ctx, progress) {
    const positions = this.getFoodPositions();
    const total = this.FOOD_COUNT;
    const eatenFloat = progress * total;
    const eatenCount = Math.min(Math.floor(eatenFloat), total - 1);

    // 動物は「今食べている食べ物」の左側に配置（右向き）
    const targetFood = positions[eatenCount];
    const foodSize = this.getFoodSize();
    const animalX = targetFood.x - foodSize / 2 - this.ANIMAL_SIZE * 0.35;
    const animalY = this.FOOD_BASE_Y - this.ANIMAL_SIZE / 2 + 5;

    // 頭をえさの方に傾けて食べるアニメーション
    let tilt = 0;
    if (progress > 0 && progress < 1) {
      const t = this.frameCount * 0.18;
      // 頭を食べ物の方へ傾ける（ぱくっ→戻る の繰り返し）
      const cycle = (Math.sin(t) + 1) / 2; // 0～1
      tilt = cycle * 0.18; // 最大約10度、食べ物側へ傾く
    }

    ctx.save();
    ctx.translate(animalX, animalY);
    ctx.scale(-1, 1); // 左右反転で右向きに
    ctx.rotate(tilt); // 食べ物の方へ頭を傾ける

    const drawW = this.ANIMAL_SIZE * 0.85;
    const drawH = this.ANIMAL_SIZE;
    ctx.drawImage(this.images.animal, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  },

  drawAnimalHappy(ctx) {
    const centerX = this.w / 2;
    const baseY = this.FOOD_BASE_Y - this.ANIMAL_SIZE / 2;

    // ゆらゆら満足アニメ
    const sway = Math.sin(this.frameCount * 0.05) * 3;

    ctx.save();
    ctx.translate(centerX + sway, baseY);

    const drawW = this.ANIMAL_SIZE * 0.85;
    const drawH = this.ANIMAL_SIZE;
    ctx.drawImage(this.images.animalHappy, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  },

  update(progress) {
    this.drawFrame(progress);
  },

  reset() {
    this.frameCount = 0;
    this.drawFrame(0);
  },

  updateTimeDisplay(minutes, seconds) {
    const el = document.getElementById('feeding-time-text');
    if (el) el.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  },
};
