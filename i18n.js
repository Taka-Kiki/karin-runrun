/* ========================================
   みえるんタイマー - テキストモード管理
   ひらがな / 漢字 / English 切替
   ======================================== */

const I18n = {
  mode: 'hiragana', // 'hiragana' | 'kanji' | 'english'

  texts: {
    'app-title':           { hiragana: 'みえるんタイマー',           kanji: 'みえるんタイマー',       english: 'Peek-a-Timer' },
    'theme-toggle':        { hiragana: 'テーマきりかえ',             kanji: 'テーマ切替',             english: 'Toggle theme' },
    'rewards-toggle':      { hiragana: 'ごほうび',                   kanji: 'ごほうび',               english: 'Rewards' },
    'ticket-toggle':       { hiragana: 'チケット',                   kanji: 'チケット',               english: 'Tickets' },
    'focus-mode':          { hiragana: 'しゅうちゅうモード',         kanji: '集中モード',             english: 'Focus mode' },
    'mode-circle':         { hiragana: 'まる',                       kanji: '円形',                   english: 'Circle' },
    'mode-hourglass':      { hiragana: 'すなどけい',                 kanji: '砂時計',                 english: 'Hourglass' },
    'mode-wakuwaku':       { hiragana: 'わくわく',                   kanji: 'わくわく',               english: 'Fun' },
    'wakuwaku-title':      { hiragana: 'どのモードであそぶ？',       kanji: 'どのモードで遊ぶ？',     english: 'Pick a mode!' },
    'submode-feeding':     { hiragana: 'もぐもぐ',                   kanji: 'もぐもぐ',               english: 'Feeding' },
    'submode-battle':      { hiragana: 'たたかい',                   kanji: '戦い',                   english: 'Battle' },
    'submode-adventure':   { hiragana: 'ぼうけん',                   kanji: '冒険',                   english: 'Adventure' },
    'animal-title':        { hiragana: 'どのどうぶつにする？',       kanji: 'どの動物にする？',       english: 'Pick an animal!' },
    'animal-hamster':      { hiragana: 'ハムスター',                 kanji: 'ハムスター',             english: 'Hamster' },
    'animal-rabbit':       { hiragana: 'うさぎ',                     kanji: 'うさぎ',                 english: 'Rabbit' },
    'animal-dog':          { hiragana: 'いぬ',                       kanji: '犬',                     english: 'Dog' },
    'animal-cat':          { hiragana: 'ねこ',                       kanji: '猫',                     english: 'Cat' },
    'btn-back-select':     { hiragana: 'もどる',                     kanji: '戻る',                   english: 'Back' },
    'presets-label':       { hiragana: 'なんぷん？',                 kanji: '何分？',                 english: 'How many minutes?' },
    'presets-label-sec':   { hiragana: 'なんびょう？',               kanji: '何秒？',                 english: 'How many seconds?' },
    'custom-label':        { hiragana: 'じかん:',                    kanji: '時間:',                  english: 'Time:' },
    'unit-min':            { hiragana: 'ふん',                       kanji: '分',                     english: 'min' },
    'unit-sec':            { hiragana: 'びょう',                     kanji: '秒',                     english: 'sec' },
    'btn-set':             { hiragana: 'セット',                     kanji: 'セット',                 english: 'Set' },
    'btn-start':           { hiragana: 'スタート',                   kanji: 'スタート',               english: 'Start' },
    'btn-pause':           { hiragana: 'とめる',                     kanji: '一時停止',               english: 'Pause' },
    'btn-resume':          { hiragana: 'つづける',                   kanji: '再開',                   english: 'Resume' },
    'btn-back':            { hiragana: 'じかんをえらぶ',             kanji: '時間を選ぶ',             english: 'Choose time' },
    'btn-reset':           { hiragana: 'リセット',                   kanji: 'リセット',               english: 'Reset' },
    'completion-msg':      { hiragana: 'じかんになったよ！',         kanji: '時間になりました！',     english: "Time's up!" },
    'completion-question': { hiragana: 'がんばれたかな？',           kanji: 'がんばれましたか？',     english: 'Did you do well?' },
    'btn-reward-yes':      { hiragana: 'がんばった！',               kanji: 'がんばった！',           english: 'I did it!' },
    'btn-skip':            { hiragana: 'スキップ',                   kanji: 'スキップ',               english: 'Skip' },
    'hint-reward':         { hiragana: '+1 ポイント',                kanji: '+1 ポイント',            english: '+1 point' },
    'hint-skip':           { hiragana: 'ポイントはもらわない',        kanji: 'ポイントはもらわない',    english: 'No points' },
    'panel-title':         { hiragana: 'ごほうびポイント',           kanji: 'ごほうびポイント',       english: 'Reward Points' },
    'unit-point':          { hiragana: 'ポイント',                   kanji: 'ポイント',               english: 'points' },
    'reward-label':        { hiragana: 'ごほうびの　ないよう:',      kanji: 'ごほうびの内容:',        english: 'Reward:' },
    'reward-placeholder':  { hiragana: '（れい）アイスをたべる',     kanji: '（例）アイスを食べる',   english: 'e.g. Ice cream' },
    'goal-label':          { hiragana: 'もくひょう　ポイント:',      kanji: '目標ポイント:',          english: 'Goal points:' },
    'history-title':       { hiragana: 'きろく',                     kanji: '記録',                   english: 'History' },
    'btn-reset-points':    { hiragana: 'ポイントをリセット',         kanji: 'ポイントをリセット',     english: 'Reset points' },
    'celebration-msg':     { hiragana: 'おめでとう！',               kanji: 'おめでとう！',           english: 'Congratulations!' },
    'celebration-sub':     { hiragana: 'ごほうびの　じかんだよ！',   kanji: 'ごほうびの時間です！',   english: 'Reward time!' },
    'btn-celebrate':       { hiragana: 'やったー！',                 kanji: 'やったー！',             english: 'Hooray!' },
    'btn-back-focus':      { hiragana: 'もどる',                     kanji: '戻る',                   english: 'Back' },
    'no-history':          { hiragana: 'まだ きろくが ありません',   kanji: 'まだ記録がありません',   english: 'No history yet' },
    'achieved':            { hiragana: 'ごほうびたっせい！',         kanji: 'ごほうび達成！',         english: 'Reward achieved!' },
    'reward-fallback':     { hiragana: 'ごほうび！',                 kanji: 'ごほうび！',             english: 'Reward!' },
    'confirm-reset':       { hiragana: 'ポイントをリセットしますか？', kanji: 'ポイントをリセットしますか？', english: 'Reset points?' },
    'ticket-get':          { hiragana: 'ごほうびチケット ゲット！',   kanji: 'ごほうびチケット GET！', english: 'Reward Ticket Get!' },
    'ticket-title':        { hiragana: 'チケット',                   kanji: 'チケット',               english: 'Tickets' },
    'ticket-use':          { hiragana: 'つかう',                     kanji: '使う',                   english: 'Use' },
    'ticket-used':         { hiragana: 'つかった',                   kanji: '使用済み',               english: 'Used' },
    'ticket-none':         { hiragana: 'まだ チケットは ありません', kanji: 'まだチケットはありません', english: 'No tickets yet' },
    'ticket-tap-close':    { hiragana: 'タップしてとじる',           kanji: 'タップして閉じる',       english: 'Tap to close' },
    'ticket-next-hint':    { hiragana: 'つぎのごほうびをきめよう！', kanji: '次のごほうびを決めよう！', english: 'Set your next reward!' },
    'history-show-more':   { hiragana: 'もっとみる',                 kanji: 'もっと見る',             english: 'Show more' },
    'history-show-less':   { hiragana: 'とじる',                     kanji: '閉じる',                 english: 'Show less' },
    'enemy-slime':         { hiragana: 'スライム',                   kanji: 'スライム',               english: 'Slime' },
    'enemy-golem':         { hiragana: 'ゴーレム',                   kanji: 'ゴーレム',               english: 'Golem' },
    'enemy-dragon':        { hiragana: 'ドラゴン',                   kanji: 'ドラゴン',               english: 'Dragon' },
    'enemy-demon':         { hiragana: 'まおう',                     kanji: '魔王',                   english: 'Demon King' },
    'enemy-defeated':      { hiragana: 'を たおした！',              kanji: 'を倒した！',             english: ' defeated!' },
  },

  init() {
    this.mode = localStorage.getItem('runrun-textMode') || 'hiragana';
    this.apply();
    this.updateToggleButton();
  },

  get(key) {
    const entry = this.texts[key];
    if (!entry) return key;
    return entry[this.mode] || entry.hiragana;
  },

  toggle() {
    const modes = ['hiragana', 'kanji', 'english'];
    const idx = modes.indexOf(this.mode);
    this.mode = modes[(idx + 1) % modes.length];
    localStorage.setItem('runrun-textMode', this.mode);
    this.apply();
    this.updateToggleButton();
  },

  apply() {
    // textContent
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.get(el.dataset.i18n);
    });
    // aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', this.get(el.dataset.i18nAria));
    });
    // title
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', this.get(el.dataset.i18nTitle));
    });
    // placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = this.get(el.dataset.i18nPlaceholder);
    });
    // <title>
    document.title = this.get('app-title');
  },

  updateToggleButton() {
    const btn = document.getElementById('btn-text-mode');
    if (!btn) return;
    const icon = btn.querySelector('.text-mode-icon');
    if (icon) {
      const icons = { hiragana: 'あ', kanji: '漢', english: 'A' };
      icon.textContent = icons[this.mode] || 'あ';
    }
  },
};
