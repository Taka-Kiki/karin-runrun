/* ========================================
   みえるんタイマー - わくわくモード管理
   サブモード選択 + タイマー委譲ファサード
   ======================================== */

const WakuwakuManager = {
  activeSubMode: null,   // 'feeding' | 'battle' | 'adventure' | null
  selectedAnimal: null,  // 'hamster' | 'rabbit' | 'dog' | 'cat'

  timers: {
    feeding: null,
    battle: null,
    adventure: null,
  },

  init() {
    this.loadPreferences();
    this.timers.feeding = FeedingTimer;
    this.timers.battle = BattleTimer;
    this.timers.adventure = AdventureTimer;

    FeedingTimer.init();
    BattleTimer.init();
    AdventureTimer.init();

    this.bindEvents();
  },

  loadPreferences() {
    this.activeSubMode = localStorage.getItem('runrun-wakuwaku-submode') || null;
    this.selectedAnimal = localStorage.getItem('runrun-wakuwaku-animal') || 'hamster';
  },

  savePreferences() {
    if (this.activeSubMode) {
      localStorage.setItem('runrun-wakuwaku-submode', this.activeSubMode);
    } else {
      localStorage.removeItem('runrun-wakuwaku-submode');
    }
    localStorage.setItem('runrun-wakuwaku-animal', this.selectedAnimal);
  },

  bindEvents() {
    // サブモードカード選択
    document.getElementById('wakuwaku-select').addEventListener('click', (e) => {
      const card = e.target.closest('.wakuwaku-card');
      if (!card) return;
      const submode = card.dataset.submode;
      if (submode === 'feeding') {
        this.showAnimalSelect();
      } else {
        this.activateSubMode(submode);
      }
    });

    // 動物カード選択
    document.getElementById('wakuwaku-animal-select').addEventListener('click', (e) => {
      const card = e.target.closest('.animal-card');
      if (card) {
        this.selectedAnimal = card.dataset.animal;
        FeedingTimer.setAnimal(this.selectedAnimal);
        this.activateSubMode('feeding');
        return;
      }
    });

    // サブモード切替バー
    document.getElementById('submode-switcher').addEventListener('click', (e) => {
      const badge = e.target.closest('.submode-badge');
      if (!badge) return;
      const submode = badge.dataset.submode;
      if (submode === this.activeSubMode) {
        // アクティブなサブモードを再タップ
        if (submode === 'feeding') {
          this.showAnimalSelect();  // もぐもぐ→動物選択へ
        } else {
          this.backToSelect();      // 他→サブモード選択へ
        }
      } else if (submode === 'feeding') {
        // もぐもぐは保存済みの動物で直接切替
        this.activateSubMode('feeding');
      } else {
        this.activateSubMode(submode);
      }
    });

  },

  // わくわくタブがアクティブになった時
  onModeActivated() {
    if (this.activeSubMode) {
      // 前回選択したサブモードを復元
      if (this.activeSubMode === 'feeding') {
        FeedingTimer.setAnimal(this.selectedAnimal);
      }
      this.showActiveTimer();
    } else {
      this.showSubModeSelect();
    }
  },

  showSubModeSelect() {
    this.hideAllPanels();
    document.getElementById('submode-switcher').hidden = true;
    document.getElementById('wakuwaku-select').hidden = false;
  },

  showAnimalSelect() {
    this.hideAllPanels();
    document.getElementById('submode-switcher').hidden = true;
    document.getElementById('wakuwaku-animal-select').hidden = false;
  },

  showActiveTimer() {
    this.hideAllPanels();
    const timerId = this.activeSubMode + '-timer';
    document.getElementById(timerId).hidden = false;
    // 切替バーを表示し、アクティブなバッジをハイライト
    const switcher = document.getElementById('submode-switcher');
    switcher.hidden = false;
    switcher.querySelectorAll('.submode-badge').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.submode === this.activeSubMode);
    });
  },

  hideAllPanels() {
    document.getElementById('wakuwaku-select').hidden = true;
    document.getElementById('wakuwaku-animal-select').hidden = true;
    document.querySelectorAll('.wakuwaku-timer').forEach(el => el.hidden = true);
  },

  activateSubMode(submode) {
    this.activeSubMode = submode;
    this.savePreferences();

    if (submode === 'feeding') {
      FeedingTimer.setAnimal(this.selectedAnimal);
    } else if (submode === 'battle') {
      BattleTimer.setDuration(TimerApp.totalSeconds);
    }

    this.showActiveTimer();
  },

  // サブモード選択に戻る
  backToSelect() {
    if (TimerApp.state === 'RUNNING' || TimerApp.state === 'PAUSED') {
      return; // タイマー動作中は戻れない
    }
    this.activeSubMode = null;
    this.savePreferences();
    this.showSubModeSelect();
  },

  // --- タイマーインターフェース（app.jsから呼ばれる） ---
  getActiveTimer() {
    if (!this.activeSubMode) return null;
    return this.timers[this.activeSubMode];
  },

  update(progress) {
    const timer = this.getActiveTimer();
    if (timer) timer.update(progress);
  },

  reset() {
    FeedingTimer.reset();
    BattleTimer.reset();
    AdventureTimer.reset();
  },

  updateTimeDisplay(mins, secs) {
    const text = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    ['feeding-time-text', 'battle-time-text', 'adventure-time-text'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
  },
};
