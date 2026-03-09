/* ========================================
   みえるんタイマー - ごほうびポイント管理
   ======================================== */

const Rewards = {
  data: {
    points: 0,
    goalPoints: 10,
    goalText: '',
    history: [],       // [{ date: 'YYYY-MM-DD', points: 1, type: 'earn' | 'achieved' }]
    tickets: [],       // [{ id, text, date, used, usedDate }]
  },

  init() {
    this.load();
    this.bindEvents();
    this.renderPanel();
    this.updateBadge();
    this.updateTicketBadge();
  },

  load() {
    const saved = localStorage.getItem('runrun-rewards');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.data = { ...this.data, ...parsed };
      } catch (e) {
        // ignore
      }
    }
  },

  save() {
    localStorage.setItem('runrun-rewards', JSON.stringify(this.data));
  },

  bindEvents() {
    // パネル開閉
    document.getElementById('btn-rewards-toggle').addEventListener('click', () => {
      this.togglePanel();
    });
    document.getElementById('btn-ticket-toggle').addEventListener('click', () => {
      this.togglePanel();
    });
    document.getElementById('btn-close-rewards').addEventListener('click', () => {
      this.closePanel();
    });
    document.getElementById('rewards-panel-backdrop').addEventListener('click', () => {
      this.closePanel();
    });

    // 目標テキスト変更
    document.getElementById('reward-goal-text').addEventListener('change', (e) => {
      this.data.goalText = e.target.value;
      this.save();
    });

    // 目標ポイント変更
    document.getElementById('reward-goal-count').addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0 && val <= 100) {
        this.data.goalPoints = val;
        this.save();
        this.renderPanel();
      }
    });

    // リセット
    document.getElementById('btn-reward-reset').addEventListener('click', () => {
      if (confirm(I18n.get('confirm-reset'))) {
        this.data.points = 0;
        this.save();
        this.renderPanel();
        this.updateBadge();
      }
    });

    // タイマー完了時の「がんばった！」ボタン
    document.getElementById('btn-reward-yes').addEventListener('click', () => {
      this.addPoint();
      this.hideCompletionOverlay();
    });

    // スキップ
    document.getElementById('btn-reward-skip').addEventListener('click', () => {
      this.hideCompletionOverlay();
    });

    // お祝いオーバーレイ閉じる → チケット発行
    document.getElementById('btn-celebration-close').addEventListener('click', () => {
      document.getElementById('goal-achieved-overlay').hidden = true;
      const ticket = this.createTicket();
      this.data.points = 0;
      // ごほうび内容をクリア（次のごほうび用に）
      this.data.goalText = '';
      this.addHistoryEntry('achieved');
      this.save();
      this.renderPanel();
      this.updateBadge();
      this.updateTicketBadge();
      this.showTicketOverlay(ticket);
    });

    // チケットオーバーレイ：どこをクリックしても閉じる（アニメーション付き）
    const ticketOverlay = document.getElementById('ticket-overlay');
    ticketOverlay.addEventListener('click', () => {
      // チケットアイコンに向かって飛ぶアニメーション
      const ticketBtn = document.getElementById('btn-ticket-toggle');
      this.flyToBadge(document.querySelector('.ticket-stub'), '\uD83C\uDFAB', () => {
        this.updateTicketBadge();
      }, ticketBtn);
      ticketOverlay.hidden = true;
    });

    // 「つぎのごほうびをきめよう！」→ ごほうびパネルを開く
    document.querySelector('.ticket-next-hint').addEventListener('click', (e) => {
      e.stopPropagation();
      const ticketBtn = document.getElementById('btn-ticket-toggle');
      this.flyToBadge(document.querySelector('.ticket-stub'), '\uD83C\uDFAB', () => {
        this.updateTicketBadge();
      }, ticketBtn);
      ticketOverlay.hidden = true;
      this.togglePanel();
    });
  },

  addPoint() {
    this.data.points++;
    this.addHistoryEntry('earn');
    this.save();
    this.renderPanel();

    AlarmAudio.playRewardSound();

    // 星1つがバッジへ飛ぶアニメーション → バッジ更新
    this.flyToBadge(document.getElementById('btn-reward-yes'), '\u2B50', () => {
      this.updateBadge();
    });

    // 目標達成チェック
    if (this.data.points >= this.data.goalPoints) {
      setTimeout(() => this.showCelebration(), 500);
    }
  },

  addHistoryEntry(type) {
    const today = new Date().toISOString().split('T')[0];
    this.data.history.push({ date: today, type: type });
    // 最新100件のみ保持
    if (this.data.history.length > 100) {
      this.data.history = this.data.history.slice(-100);
    }
    this.save();
  },

  showCompletionOverlay() {
    document.getElementById('completion-overlay').hidden = false;
  },

  hideCompletionOverlay() {
    document.getElementById('completion-overlay').hidden = true;
    TimerApp.onRewardDismissed();
  },

  showCelebration() {
    const overlay = document.getElementById('goal-achieved-overlay');
    const goalText = document.getElementById('celebration-goal-text');
    goalText.textContent = this.data.goalText || I18n.get('reward-fallback');
    overlay.hidden = false;

    AlarmAudio.playCelebrationSound();
    this.startConfetti();
  },

  togglePanel() {
    const panel = document.getElementById('rewards-panel');
    const backdrop = document.getElementById('rewards-panel-backdrop');
    panel.hidden = !panel.hidden;
    backdrop.hidden = panel.hidden;
    if (!panel.hidden) {
      this.renderPanel();
    }
  },

  closePanel() {
    document.getElementById('rewards-panel').hidden = true;
    document.getElementById('rewards-panel-backdrop').hidden = true;
  },

  updateBadge() {
    document.getElementById('points-badge').textContent = this.data.points;
  },

  updateTicketBadge() {
    const unused = this.data.tickets.filter((t) => !t.used).length;
    document.getElementById('ticket-badge').textContent = unused;
  },

  renderPanel() {
    // ポイント表示
    document.getElementById('reward-current-points').textContent = this.data.points;
    document.getElementById('reward-goal-points').textContent = this.data.goalPoints;
    document.getElementById('reward-goal-text').value = this.data.goalText;
    document.getElementById('reward-goal-count').value = this.data.goalPoints;

    // プログレスバー
    const pct = Math.min((this.data.points / this.data.goalPoints) * 100, 100);
    document.getElementById('reward-progress-fill').style.width = pct + '%';

    // 星表示
    const starsEl = document.getElementById('reward-stars');
    const filled = Math.min(this.data.points, this.data.goalPoints);
    const empty = Math.max(this.data.goalPoints - this.data.points, 0);
    let starsHtml = '';
    for (let i = 0; i < filled; i++) starsHtml += '\u2B50';
    for (let i = 0; i < empty; i++) starsHtml += '\u2606';
    starsEl.textContent = starsHtml;

    // チケット
    this.renderTickets();

    // 履歴
    this.renderHistory();
  },

  // --- チケット機能 ---
  createTicket() {
    const ticket = {
      id: Date.now(),
      text: this.data.goalText || I18n.get('reward-fallback'),
      date: new Date().toISOString().split('T')[0],
      used: false,
      usedDate: null,
    };
    this.data.tickets.push(ticket);
    this.save();
    return ticket;
  },

  showTicketOverlay(ticket) {
    document.getElementById('ticket-overlay-text').textContent = ticket.text;
    document.getElementById('ticket-overlay-date').textContent = ticket.date;
    document.getElementById('ticket-overlay').hidden = false;
    I18n.apply();
  },

  useTicket(id) {
    const ticket = this.data.tickets.find((t) => t.id === id);
    if (ticket && !ticket.used) {
      ticket.used = true;
      ticket.usedDate = new Date().toISOString().split('T')[0];
      this.save();
      this.renderTickets();
      this.updateTicketBadge();
    }
  },

  renderTickets() {
    const container = document.getElementById('reward-tickets');
    const unused = this.data.tickets.filter((t) => !t.used);
    const used = this.data.tickets.filter((t) => t.used);

    // 未使用バッジ更新
    const badge = document.getElementById('ticket-unused-badge');
    if (unused.length > 0) {
      badge.textContent = unused.length;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }

    if (this.data.tickets.length === 0) {
      container.innerHTML = '<div class="ticket-empty">' + I18n.get('ticket-none') + '</div>';
      return;
    }

    let html = '';

    // 未使用チケット（新しい順）
    unused.slice().reverse().forEach((t) => {
      html += '<div class="ticket-item">'
        + '<div class="ticket-item-info">'
        + '<span class="ticket-item-emoji">&#127915;</span>'
        + '<span class="ticket-item-text">' + this.escapeHtml(t.text) + '</span>'
        + '<span class="ticket-item-date">' + t.date + '</span>'
        + '</div>'
        + '<button class="ticket-use-btn" data-ticket-id="' + t.id + '">' + I18n.get('ticket-use') + '</button>'
        + '</div>';
    });

    // 使用済みチケット（新しい順）
    used.slice().reverse().forEach((t) => {
      html += '<div class="ticket-item used">'
        + '<div class="ticket-item-info">'
        + '<span class="ticket-item-emoji">&#127915;</span>'
        + '<span class="ticket-item-text">' + this.escapeHtml(t.text) + '</span>'
        + '<span class="ticket-item-date">' + t.date + '</span>'
        + '</div>'
        + '<span class="ticket-used-stamp">' + I18n.get('ticket-used') + '</span>'
        + '</div>';
    });

    container.innerHTML = html;

    // 「つかう」ボタンのイベント
    container.querySelectorAll('.ticket-use-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.useTicket(parseInt(btn.dataset.ticketId, 10));
      });
    });
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  renderHistory() {
    const container = document.getElementById('reward-history');
    if (this.data.history.length === 0) {
      container.innerHTML = '<div class="history-item"><span class="history-date">' + I18n.get('no-history') + '</span></div>';
      return;
    }

    // 日付ごとに集計
    const byDate = {};
    const achievements = [];
    this.data.history.forEach((entry) => {
      if (entry.type === 'achieved') {
        achievements.push(entry.date);
      } else {
        byDate[entry.date] = (byDate[entry.date] || 0) + 1;
      }
    });

    // 全エントリを配列に構築（達成→ポイント順）
    const items = [];
    achievements.forEach((date) => {
      items.push('<div class="history-item"><span class="history-date">' + date + '</span><span class="history-achieved">' + I18n.get('achieved') + '</span></div>');
    });
    const dates = Object.keys(byDate).sort().reverse().slice(0, 14);
    dates.forEach((date) => {
      items.push('<div class="history-item"><span class="history-date">' + date + '</span><span class="history-points">+' + byDate[date] + ' ' + I18n.get('unit-point') + '</span></div>');
    });

    const VISIBLE = 2;
    let html = items.slice(0, VISIBLE).join('');

    if (items.length > VISIBLE) {
      html += '<div id="history-older" class="history-older" hidden>'
        + items.slice(VISIBLE).join('')
        + '</div>'
        + '<button id="btn-history-toggle" class="history-toggle-btn">'
        + I18n.get('history-show-more')
        + '</button>';
    }

    container.innerHTML = html;

    // 開閉ボタン
    const btn = document.getElementById('btn-history-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const older = document.getElementById('history-older');
        const expanded = !older.hidden;
        older.hidden = expanded;
        btn.textContent = expanded ? I18n.get('history-show-more') : I18n.get('history-show-less');
      });
    }
  },

  // 1つのアイテムがバッジに吸い込まれるアニメーション
  flyToBadge(sourceEl, emoji, onComplete, targetEl) {
    const badge = targetEl || document.getElementById('btn-rewards-toggle');
    if (!badge || !sourceEl) {
      if (onComplete) onComplete();
      return;
    }

    const badgeRect = badge.getBoundingClientRect();
    const sourceRect = sourceEl.getBoundingClientRect();

    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const endX = badgeRect.left + badgeRect.width / 2;
    const endY = badgeRect.top + badgeRect.height / 2;

    const el = document.createElement('div');
    el.className = 'fly-star';
    el.textContent = emoji;
    el.style.left = startX + 'px';
    el.style.top = startY + 'px';

    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.left = endX + 'px';
      el.style.top = endY + 'px';
      el.style.opacity = '0';
      el.style.transform = 'scale(0.2)';
    });

    setTimeout(() => {
      el.remove();
      badge.classList.add('badge-bounce');
      setTimeout(() => badge.classList.remove('badge-bounce'), 400);
      if (onComplete) onComplete();
    }, 620);
  },

  // 紙吹雪アニメーション
  startConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    canvas.width = parent.offsetWidth;
    canvas.height = parent.offsetHeight;

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FDCB6E', '#6C5CE7', '#FF85A2', '#00B894'];
    const pieces = [];

    for (let i = 0; i < 60; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: 1 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 2,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    let frameId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;
      pieces.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotSpeed;
        if (p.y < canvas.height + 20) active = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (active) {
        frameId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    animate();
  },
};
