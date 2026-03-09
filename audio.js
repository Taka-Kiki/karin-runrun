/* ========================================
   みえるんタイマー - オーディオ管理
   ======================================== */

const AlarmAudio = {
  audioCtx: null,
  isPlaying: false,
  alarmIntervalId: null,

  ensureContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  },

  beep(frequency, duration, type) {
    this.ensureContext();
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  },

  startAlarm() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const playPattern = () => {
      this.beep(660, 0.15, 'sine');
      setTimeout(() => this.beep(880, 0.15, 'sine'), 200);
      setTimeout(() => this.beep(1100, 0.2, 'sine'), 400);
    };

    playPattern();
    this.alarmIntervalId = setInterval(playPattern, 1200);
  },

  stopAlarm() {
    this.isPlaying = false;
    if (this.alarmIntervalId) {
      clearInterval(this.alarmIntervalId);
      this.alarmIntervalId = null;
    }
  },

  playRewardSound() {
    this.ensureContext();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.beep(freq, 0.2, 'sine'), i * 120);
    });
  },

  playCelebrationSound() {
    this.ensureContext();
    const melody = [
      { f: 523, d: 0.15 },
      { f: 659, d: 0.15 },
      { f: 784, d: 0.15 },
      { f: 1047, d: 0.3 },
      { f: 784, d: 0.15 },
      { f: 1047, d: 0.4 },
    ];
    let delay = 0;
    melody.forEach((note) => {
      setTimeout(() => this.beep(note.f, note.d, 'sine'), delay);
      delay += note.d * 700;
    });
  },
};
