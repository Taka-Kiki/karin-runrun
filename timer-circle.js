/* ========================================
   みえるんタイマー - 円形モード
   ======================================== */

const CircleTimer = {
  pieEl: null,

  init() {
    this.pieEl = document.getElementById('circle-pie');
  },

  getColor(progress) {
    if (progress < 0.5) return 'var(--timer-green)';
    if (progress < 0.75) return 'var(--timer-yellow)';
    return 'var(--timer-red)';
  },

  update(progress) {
    const remaining = 1 - progress;
    const degrees = remaining * 360;
    const color = this.getColor(progress);

    if (remaining <= 0) {
      this.pieEl.style.background = 'var(--timer-track)';
    } else if (remaining >= 1) {
      this.pieEl.style.background = `conic-gradient(${color} 360deg, var(--timer-track) 360deg)`;
    } else {
      this.pieEl.style.background = `conic-gradient(${color} ${degrees}deg, var(--timer-track) ${degrees}deg)`;
    }
  },

  reset() {
    this.update(0);
  },

  updateTimeDisplay(minutes, seconds) {
    const el = document.getElementById('time-text');
    el.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  },
};
