/* ========================================
   みえるんタイマー - メインアプリケーション
   ======================================== */

const TimerApp = {
  state: 'IDLE',
  totalSeconds: 0,
  remainingMs: 0,
  startTimestamp: null,
  pausedElapsed: 0,
  animFrameId: null,
  currentMode: 'circle',
  wakeLock: null,
  presetMode: 'minutes',

  // --- 初期化 ---
  init() {
    this.loadPreferences();
    I18n.init();
    this.bindEvents();
    this.buildPresetButtons('minutes');
    CircleTimer.init();
    HourglassTimer.init();
    WakuwakuManager.init();
    Rewards.init();
    this.applyMode(this.currentMode);
    this.updateControls();
    this.updateAllDisplays(0, 0);
  },

  loadPreferences() {
    const theme = localStorage.getItem('runrun-theme') || 'light';
    document.body.dataset.theme = theme;
    document.getElementById('btn-theme').querySelector('.theme-icon').textContent =
      theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';

    this.currentMode = localStorage.getItem('runrun-mode') || 'circle';
    // ねずみモードからの移行
    if (this.currentMode === 'mouse') {
      this.currentMode = 'wakuwaku';
      localStorage.setItem('runrun-mode', 'wakuwaku');
    }
  },

  // --- イベントバインド ---
  bindEvents() {
    // プリセットボタン（イベント委譲）
    document.getElementById('presets').addEventListener('click', (e) => {
      const btn = e.target.closest('.preset-btn');
      if (!btn || document.getElementById('presets').classList.contains('disabled')) return;
      const val = parseInt(btn.dataset.value, 10);
      if (isNaN(val)) return;

      // 選択状態の表示
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');

      // 対象フィールドに値を設定＋ハイライト
      const targetId = this.presetMode === 'seconds' ? 'custom-seconds' : 'custom-minutes';
      const otherId = this.presetMode === 'seconds' ? 'custom-minutes' : 'custom-seconds';
      document.getElementById(targetId).value = val;
      document.getElementById(targetId).classList.add('numpad-active');
      document.getElementById(otherId).classList.remove('numpad-active');
      this.applyCustomInput();
    });

    // カスタム入力 - セットボタン
    document.getElementById('btn-set-custom').addEventListener('click', () => {
      this.applyCustomInput();
    });

    // カスタム入力 - 矢印（スピナー）操作で自動反映
    const customMins = document.getElementById('custom-minutes');
    const customSecs = document.getElementById('custom-seconds');
    const onCustomInputChange = () => {
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('selected'));
      this.numpadFreshInput = true; // 矢印操作後のテンキー入力は新規入力扱い
      this.applyCustomInput();
    };
    customMins.addEventListener('input', onCustomInputChange);
    customSecs.addEventListener('input', onCustomInputChange);
    customMins.addEventListener('change', onCustomInputChange);
    customSecs.addEventListener('change', onCustomInputChange);

    // テンキー（ポップアップ）
    this.numpadTarget = null; // 現在の入力対象
    this.numpadFreshInput = true; // テンキー新規入力フラグ
    const numpad = document.getElementById('numpad');
    const backdrop = document.getElementById('numpad-backdrop');
    const numpadLabel = document.getElementById('numpad-label');

    // 入力欄タップでテンキー表示（タイマー表示の右側に配置）
    const showNumpad = (input) => {
      if (this.numpadTarget === input && numpad.classList.contains('active')) return;
      this.numpadTarget = input;
      this.numpadFreshInput = true; // テンキー表示時は新規入力モード
      const maxVal = input === customMins ? 60 : 59;
      numpad.dataset.max = maxVal;
      numpadLabel.textContent = input === customMins ? I18n.get('unit-min') : I18n.get('unit-sec');
      customMins.classList.toggle('numpad-active', input === customMins);
      customSecs.classList.toggle('numpad-active', input === customSecs);
      numpad.classList.add('active');
      backdrop.classList.add('active');
      this.positionNumpad();
      this.switchPresetMode(input === customSecs ? 'seconds' : 'minutes');
    };

    customMins.addEventListener('focus', () => showNumpad(customMins));
    customSecs.addEventListener('focus', () => showNumpad(customSecs));

    // バックドロップでテンキー閉じる
    backdrop.addEventListener('click', () => this.hideNumpad());

    // テンキーボタン
    numpad.addEventListener('click', (e) => {
      const btn = e.target.closest('.numpad-btn');
      if (!btn || !this.numpadTarget) return;
      const action = btn.dataset.action;
      const maxVal = parseInt(numpad.dataset.max, 10) || 59;
      let val = this.numpadTarget.value;

      if (action === 'clear') {
        val = '0';
        this.numpadFreshInput = true;
      } else if (action === 'backspace') {
        val = val.length > 1 ? val.slice(0, -1) : '0';
        this.numpadFreshInput = false;
      } else {
        const digit = btn.dataset.value;
        if (this.numpadFreshInput || val === '0') {
          // 新規入力モード：最初の数字で値を置き換え
          val = digit;
          this.numpadFreshInput = false;
        } else if (val.length < 2) {
          val = val + digit;
        }
        if (parseInt(val, 10) > maxVal) val = String(maxVal);
      }

      this.numpadTarget.value = val;
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('selected'));
      this.applyCustomInput();
    });

    // 操作ボタン
    document.getElementById('btn-start').addEventListener('click', () => this.start());
    document.getElementById('btn-pause').addEventListener('click', () => this.pause());
    document.getElementById('btn-resume').addEventListener('click', () => this.resume());
    document.getElementById('btn-reset').addEventListener('click', () => this.reset());
    document.getElementById('btn-back-to-select').addEventListener('click', () => this.reset());

    // モード切替
    document.getElementById('mode-switcher').addEventListener('click', (e) => {
      const tab = e.target.closest('.mode-tab');
      if (!tab) return;
      this.switchMode(tab.dataset.mode);
    });

    // テーマ切替
    document.getElementById('btn-theme').addEventListener('click', () => {
      const newTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
      document.body.dataset.theme = newTheme;
      localStorage.setItem('runrun-theme', newTheme);
      document.getElementById('btn-theme').querySelector('.theme-icon').textContent =
        newTheme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
    });

    // テキストモード切替
    document.getElementById('btn-text-mode').addEventListener('click', () => {
      I18n.toggle();
    });

    // 全画面（集中モード）
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      this.enterFocusMode();
    });

    document.getElementById('btn-exit-focus').addEventListener('click', () => {
      this.exitFocusMode();
    });

    // Fullscreen API変更検知
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        this.exitFocusMode();
      }
    });

    // タブ表示/非表示
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.state === 'RUNNING') {
        this.animFrameId = requestAnimationFrame((t) => this.tick(t));
      }
    });

    // ページ離脱時の確認
    window.addEventListener('beforeunload', (e) => {
      if (this.state === 'RUNNING' || this.state === 'PAUSED') {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // AudioContext初期化（最初のユーザー操作時）
    const initAudio = () => {
      AlarmAudio.ensureContext();
      document.removeEventListener('click', initAudio);
    };
    document.addEventListener('click', initAudio);
  },

  // --- テンキーを閉じる ---
  hideNumpad() {
    this.numpadTarget = null;
    document.getElementById('numpad').classList.remove('active');
    document.getElementById('numpad-backdrop').classList.remove('active');
    document.getElementById('custom-minutes').classList.remove('numpad-active');
    document.getElementById('custom-seconds').classList.remove('numpad-active');
  },

  // --- プリセットボタン構築 ---
  buildPresetButtons(mode) {
    const grid = document.querySelector('.presets-grid');
    const label = document.querySelector('.presets-label');
    const values = mode === 'seconds'
      ? [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
      : [0, 1, 2, 3, 5, 10, 15, 20, 25, 30, 45, 60];
    const i18nKey = mode === 'seconds' ? 'presets-label-sec' : 'presets-label';
    label.dataset.i18n = i18nKey;
    label.textContent = I18n.get(i18nKey);
    grid.innerHTML = '';
    values.forEach(val => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.dataset.value = val;
      btn.textContent = val;
      grid.appendChild(btn);
    });
  },

  switchPresetMode(mode) {
    if (this.presetMode === mode) return;
    this.presetMode = mode;
    this.buildPresetButtons(mode);
  },

  // --- テンキーの位置をタイマー表示の右側に配置 ---
  positionNumpad() {
    const numpad = document.getElementById('numpad');
    const timerArea = document.getElementById('timer-area');
    const activeVis = timerArea.querySelector('.timer-vis.active');
    if (!activeVis) return;

    const visRect = activeVis.getBoundingClientRect();
    const numpadW = numpad.offsetWidth || 200;
    const numpadH = numpad.offsetHeight || 280;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // タイマー表示の右側にスペースがあるか確認
    const spaceRight = vw - visRect.right;

    if (spaceRight >= numpadW + margin * 2) {
      // 右側に十分なスペース → タイマーの右横に配置
      numpad.style.left = (visRect.right + margin) + 'px';
      numpad.style.top = Math.max(margin, Math.min(visRect.top + (visRect.height - numpadH) / 2, vh - numpadH - margin)) + 'px';
    } else {
      // スペースが足りない → 右端に寄せて、タイマーの下半分に配置
      numpad.style.left = Math.max(margin, vw - numpadW - margin) + 'px';
      numpad.style.top = Math.max(margin, Math.min(visRect.bottom - numpadH, vh - numpadH - margin)) + 'px';
    }
  },

  // --- ごほうび確認後の自動リセット ---
  onRewardDismissed() {
    if (this.state !== 'COMPLETED') return;
    if (this.totalSeconds > 0) {
      const seconds = this.totalSeconds;
      document.getElementById('custom-minutes').value = Math.floor(seconds / 60);
      document.getElementById('custom-seconds').value = seconds % 60;
      this.setDuration(seconds);
    } else {
      this.reset();
    }
  },

  // --- カスタム入力の適用 ---
  applyCustomInput() {
    const mins = parseInt(document.getElementById('custom-minutes').value, 10) || 0;
    const secs = parseInt(document.getElementById('custom-seconds').value, 10) || 0;
    const total = Math.min(mins * 60 + secs, 3600);
    if (total > 0) {
      this.setDuration(total);
    } else {
      // 0秒の場合もタイマー表示を更新
      this.totalSeconds = 0;
      this.remainingMs = 0;
      this.state = 'IDLE';
      this.updateControls();
      this.updateAllDisplays(0, 0);
      CircleTimer.update(0);
      HourglassTimer.update(0);
      WakuwakuManager.update(0);
    }
  },

  // --- タイマー制御 ---
  setDuration(seconds) {
    if (this.state === 'RUNNING') return;
    this.totalSeconds = seconds;
    this.remainingMs = seconds * 1000;
    this.pausedElapsed = 0;
    this.state = 'READY';
    this.updateControls();

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.updateAllDisplays(mins, secs);

    // たたかいモードのモンスター更新（ウェーブ生成を描画より先に行う）
    BattleTimer.setDuration(seconds);

    // ビジュアルリセット
    CircleTimer.update(0);
    HourglassTimer.update(0);
    WakuwakuManager.update(0);

    // 完了状態のクリア
    document.getElementById('timer-area').classList.remove('timer-complete');

    localStorage.setItem('runrun-lastPreset', seconds);
  },

  start() {
    this.hideNumpad();
    if (this.state === 'IDLE') {
      this.applyCustomInput();
    }
    if (this.state !== 'READY') return;
    this.state = 'RUNNING';
    this.startTimestamp = performance.now();
    this.pausedElapsed = 0;
    this.updateControls();
    this.requestWakeLock();
    this.animFrameId = requestAnimationFrame((t) => this.tick(t));
  },

  pause() {
    if (this.state !== 'RUNNING') return;
    this.state = 'PAUSED';
    this.pausedElapsed += performance.now() - this.startTimestamp;
    cancelAnimationFrame(this.animFrameId);
    this.updateControls();
    this.releaseWakeLock();
  },

  resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'RUNNING';
    this.startTimestamp = performance.now();
    this.updateControls();
    this.requestWakeLock();
    this.animFrameId = requestAnimationFrame((t) => this.tick(t));
  },

  reset() {
    this.hideNumpad();
    this.state = 'IDLE';
    cancelAnimationFrame(this.animFrameId);
    this.totalSeconds = 0;
    this.remainingMs = 0;
    this.pausedElapsed = 0;
    this.startTimestamp = null;

    AlarmAudio.stopAlarm();
    this.releaseWakeLock();

    this.updateControls();
    this.updateAllDisplays(0, 0);

    CircleTimer.reset();
    HourglassTimer.reset();
    WakuwakuManager.reset();

    document.getElementById('timer-area').classList.remove('timer-complete');
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('selected'));
    document.getElementById('custom-minutes').value = 0;
    document.getElementById('custom-seconds').value = 0;
    if (this.presetMode !== 'minutes') {
      this.presetMode = 'minutes';
      this.buildPresetButtons('minutes');
    }
  },

  complete() {
    this.state = 'COMPLETED';
    this.remainingMs = 0;
    cancelAnimationFrame(this.animFrameId);
    this.updateControls();
    this.updateAllDisplays(0, 0);

    // 完了アニメーション
    document.getElementById('timer-area').classList.add('timer-complete');

    // ビジュアル完了アニメーションループ（GOAL!/WIN!のズームイン演出用）
    const animateCompletion = () => {
      if (this.state !== 'COMPLETED') return;
      this.updateVisualization(1);
      this.animFrameId = requestAnimationFrame(animateCompletion);
    };
    animateCompletion();

    // アラーム
    AlarmAudio.startAlarm();

    // 3秒後にアラーム停止してごほうび確認表示
    setTimeout(() => {
      AlarmAudio.stopAlarm();
      cancelAnimationFrame(this.animFrameId);
      Rewards.showCompletionOverlay();
    }, 3000);
  },

  // --- メインループ ---
  tick(timestamp) {
    if (this.state !== 'RUNNING') return;

    const elapsed = this.pausedElapsed + (timestamp - this.startTimestamp);
    this.remainingMs = Math.max(0, this.totalSeconds * 1000 - elapsed);

    const progress = 1 - this.remainingMs / (this.totalSeconds * 1000);

    // 時間表示更新
    const totalRemainingSec = Math.ceil(this.remainingMs / 1000);
    const mins = Math.floor(totalRemainingSec / 60);
    const secs = totalRemainingSec % 60;
    this.updateAllDisplays(mins, secs);

    // ビジュアル更新（現在のモードのみ）
    this.updateVisualization(progress);

    if (this.remainingMs <= 0) {
      this.complete();
      return;
    }

    this.animFrameId = requestAnimationFrame((t) => this.tick(t));
  },

  // --- ビジュアル更新 ---
  updateVisualization(progress) {
    switch (this.currentMode) {
      case 'circle':
        CircleTimer.update(progress);
        break;
      case 'hourglass':
        HourglassTimer.update(progress);
        break;
      case 'wakuwaku':
        WakuwakuManager.update(progress);
        break;
    }
  },

  updateAllDisplays(mins, secs) {
    CircleTimer.updateTimeDisplay(mins, secs);
    HourglassTimer.updateTimeDisplay(mins, secs);
    WakuwakuManager.updateTimeDisplay(mins, secs);
  },

  // --- モード切替 ---
  switchMode(mode) {
    // わくわくモード中に再タップ→サブモード選択に戻る
    if (mode === 'wakuwaku' && this.currentMode === 'wakuwaku') {
      WakuwakuManager.backToSelect();
      return;
    }
    this.currentMode = mode;
    localStorage.setItem('runrun-mode', mode);
    this.applyMode(mode);

    // 動作中なら現在の進捗を新モードに反映
    if (this.state === 'RUNNING' || this.state === 'PAUSED') {
      const progress = 1 - this.remainingMs / (this.totalSeconds * 1000);
      this.updateVisualization(progress);
    }
  },

  applyMode(mode) {
    document.querySelectorAll('.timer-vis').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.mode-tab').forEach((el) => el.classList.remove('active'));

    const containerId = mode === 'circle' ? 'circle-container'
      : mode === 'hourglass' ? 'hourglass-container'
      : 'wakuwaku-container';

    document.getElementById(containerId).classList.add('active');
    document.querySelector('[data-mode="' + mode + '"]').classList.add('active');

    if (mode === 'wakuwaku') {
      WakuwakuManager.onModeActivated();
    }
  },

  // --- 操作ボタン状態管理 ---
  updateControls() {
    const start = document.getElementById('btn-start');
    const pause = document.getElementById('btn-pause');
    const resume = document.getElementById('btn-resume');
    const reset = document.getElementById('btn-reset');
    const backToSelect = document.getElementById('btn-back-to-select');
    const presets = document.getElementById('presets');

    switch (this.state) {
      case 'IDLE':
        start.disabled = false; start.hidden = false;
        pause.hidden = true; resume.hidden = true;
        backToSelect.hidden = true;
        reset.disabled = true;
        presets.classList.remove('disabled');
        document.body.classList.remove('timer-active');
        break;
      case 'READY':
        start.disabled = false; start.hidden = false;
        pause.hidden = true; resume.hidden = true;
        backToSelect.hidden = true;
        reset.disabled = false;
        presets.classList.remove('disabled');
        document.body.classList.remove('timer-active');
        break;
      case 'RUNNING':
        start.hidden = true; pause.hidden = false;
        resume.hidden = true; backToSelect.hidden = true;
        reset.disabled = false;
        presets.classList.add('disabled');
        document.body.classList.add('timer-active');
        break;
      case 'PAUSED':
        start.hidden = true; pause.hidden = true;
        resume.hidden = false; backToSelect.hidden = false;
        reset.disabled = false;
        presets.classList.add('disabled');
        document.body.classList.add('timer-active');
        break;
      case 'COMPLETED':
        start.hidden = true; pause.hidden = true;
        resume.hidden = true; backToSelect.hidden = true;
        reset.disabled = false;
        presets.classList.remove('disabled');
        document.body.classList.remove('timer-active');
        break;
    }
  },

  // --- 集中モード ---
  enterFocusMode() {
    document.body.classList.add('focus-mode');
    document.getElementById('btn-exit-focus').hidden = false;

    // Fullscreen API対応の場合
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  },

  exitFocusMode() {
    document.body.classList.remove('focus-mode');
    document.getElementById('btn-exit-focus').hidden = true;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitFullscreenElement) {
      document.webkitExitFullscreen();
    }
  },

  // --- Screen Wake Lock ---
  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (e) {
        // 失敗しても無視
      }
    }
  },

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  },
};

// --- アプリ起動 ---
TimerApp.init();
