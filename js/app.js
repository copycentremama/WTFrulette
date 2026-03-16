/**
 * WTF-РУЛЕТКА — app.js
 * Главный контроллер: setup → раунды → вылет → тайбрейк → победа + конфетти
 */

(function () {
  'use strict';

  // === Telegram Web App SDK ===
  const tg = window.Telegram?.WebApp;
  if (tg) { 
    tg.ready(); 
    tg.expand(); 
    
    // ТЕМА (Telegram + Ручное переключение)
    const themeBtn = document.getElementById('theme-btn');
    let currentTheme = localStorage.getItem('wt_theme') || tg.colorScheme || 'dark';

    const applyTheme = (theme) => {
      document.documentElement.className = theme === 'light' ? 'theme-light' : 'theme-dark';
      if (themeBtn) themeBtn.innerHTML = theme === 'light' ? '☀️' : '🌙';
      localStorage.setItem('wt_theme', theme);
      currentTheme = theme;
    };

    tg.onEvent('themeChanged', () => {
      if (!localStorage.getItem('wt_theme')) {
        applyTheme(tg.colorScheme);
      }
    });

    themeBtn?.addEventListener('click', () => {
      const next = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try { tg?.HapticFeedback?.impactOccurred('light'); } catch (_) {}
    });

    applyTheme(currentTheme);

    // ПРАВИЛА
    const rulesBtn = document.getElementById('rules-btn');
    const rulesBtnSetup = document.getElementById('rules-btn-setup');
    const rulesModal = document.getElementById('rules-modal');
    const rulesCloseBtn = document.getElementById('rules-close-btn');

    const openRules = () => {
      if (rulesModal) rulesModal.hidden = false;
      try { tg?.HapticFeedback?.impactOccurred('medium'); } catch (_) {}
    };

    rulesBtn?.addEventListener('click', openRules);
    rulesBtnSetup?.addEventListener('click', openRules);

    rulesCloseBtn?.addEventListener('click', () => {
      if (rulesModal) rulesModal.hidden = true;
    });

    // Устанавливаем статус экрана (для CSS)
    document.body.classList.add('setup-active');
  }

  // === Аудио (Sprint 6) ===
  if (window.AudioController) {
    window.AudioController.setup();
  }

  // === Задания ===
  if (!window.TASKS) {
    console.error('[App] window.TASKS не найден — data/tasks.js не загружен?');
    window.TASKS = { white: [], black: [], red: [] };
  }

  // === Состояние ===
  let isSpinning = false;
  const historyList = [];
  const historyEl   = document.getElementById('game-history');

  function _addHistory(name, color, task) {
    if (!historyEl) return;
    historyList.unshift({ name, color, task: task.slice(0, 45) + (task.length > 45 ? '...' : '') });
    if (historyList.length > 3) historyList.pop();

    historyEl.innerHTML = historyList.map(item => `
      <div class="history-item">
        <span class="history-dot" style="background:${item.color}"></span>
        <span class="history-name">${_escape(item.name)}:</span>
        <span class="history-task">${_escape(item.task)}</span>
      </div>
    `).join('');
  }

  // ╔══════════════════════════════════════════╗
  // ║  ЭКРАН НАСТРОЙКИ ИГРОКОВ                 ║
  // ╚══════════════════════════════════════════╝

  const setupScreen   = document.getElementById('setup-screen');
  const gameScreen    = document.getElementById('game-screen');
  const playerInput   = document.getElementById('player-name-input');
  const addPlayerBtn  = document.getElementById('add-player-btn');
  const playersList   = document.getElementById('players-list');
  const startGameBtn  = document.getElementById('start-game-btn');

  let playerNames = [];

  function addPlayer() {
    const name = playerInput.value.trim();
    if (!name || playerNames.length >= 8) return;
    playerNames.push(name);
    playerInput.value = '';
    playerInput.focus();
    _renderSetupList();
  }

  function removePlayer(index) {
    playerNames.splice(index, 1);
    _renderSetupList();
  }

  function _renderSetupList() {
    playersList.innerHTML = playerNames.map((name, i) => `
      <li class="player-item">
        <span class="player-item__num">${i + 1}</span>
        <span class="player-item__name">${_escape(name)}</span>
        <button class="player-item__remove" data-index="${i}" aria-label="Удалить">✕</button>
      </li>
    `).join('');
    startGameBtn.disabled = playerNames.length < 2;
    playerInput.disabled  = playerNames.length >= 8;
    addPlayerBtn.disabled = playerNames.length >= 8;
  }

  addPlayerBtn.addEventListener('click', addPlayer);
  playerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPlayer(); });
  playersList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-index]');
    if (btn) removePlayer(+btn.dataset.index);
  });

  // --- Старт игры ---
  startGameBtn.addEventListener('click', () => {
    if (playerNames.length < 2) return;

    // Считываем выбранный уровень
    const levelRadio = document.querySelector('input[name="game-level"]:checked');
    const level = levelRadio ? levelRadio.value : 'normal';

    if (level === '18plus' && window.TASKS_18PLUS) {
      window.TASKS = window.TASKS_18PLUS;
      // В 18+ нет своих заданий на тайбрейк — берем из базовой
      window.TASKS.tiebreak = window.TASKS_NORMAL?.tiebreak || [];
    } else {
      window.TASKS = window.TASKS_NORMAL;
    }

    const PC = window.PlayersController;
    PC.init(playerNames);
    PC.bindDOM(
      document.getElementById('turn-banner'),
      document.getElementById('scoreboard'),
    );

    // Сброс использованных карточек перед новой игрой
    window.ModalController?.resetUsedTasks();

    setupScreen.hidden = true;
    gameScreen.hidden  = false;
    document.body.classList.remove('setup-active');
    document.body.classList.add('game-active');

    // Инициализация колеса с правильными пропорциями для раунда 1
    if (window.WheelController) {
      WheelController.init('wheel');
      _updateWheelForRound();
    }

    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (_) {}
  });

  // ╔══════════════════════════════════════════╗
  // ║  ИГРОВОЕ ПОЛЕ                            ║
  // ╚══════════════════════════════════════════╝

  const spinBtn = document.getElementById('spin-btn');

  spinBtn.addEventListener('click', () => {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;
    try { tg?.HapticFeedback?.impactOccurred('medium'); } catch (_) {}
    if (window.WheelController) WheelController.spin();
  });

  // --- Колесо остановилось ---
  document.addEventListener('wheelStopped', (e) => {
    const sector = e.detail?.sector;
    window.AudioController?.stopDing();
    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (_) {}
    setTimeout(() => {
      window.AudioController?.popCard();
      if (window.ModalController) ModalController.show(sector);
    }, 350);
  });

  // --- Игрок выполнил задание ---
  document.addEventListener('taskAccepted', (e) => {
    const sector   = e.detail?.sector;
    const taskText = e.detail?.taskText || '...';
    const player   = window.PlayersController?.getCurrentPlayer();

    if (player) {
      _addHistory(player.name, player.color, taskText);
    }

    const pts    = window.PlayersController?.addPoints(sector) ?? 0;
    _flashScore('+' + pts);
    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (_) {}
    _afterTurn();
  });

  // --- Игрок отказался ---
  document.addEventListener('taskRefused', () => {
    const player = window.PlayersController?.getCurrentPlayer();
    if (player) {
      _addHistory(player.name, player.color, 'Отказ от задания ❌');
    }
    window.AudioController?.failBuzzer();
    try { tg?.HapticFeedback?.notificationOccurred('warning'); } catch (_) {}
    _afterTurn();
  });

  // ╔══════════════════════════════════════════╗
  // ║  ПОСЛЕ ХОДА — ПРОВЕРКА РАУНДА            ║
  // ╚══════════════════════════════════════════╝

  function _afterTurn() {
    const PC     = window.PlayersController;
    const result = PC.nextTurn();

    switch (result.type) {
      case 'nextTurn':
        _unlockSpin();
        break;

      case 'roundEnd':
        _showRoundEnd(result.eliminated, result.scores);
        break;

      case 'tiebreak':
        _showTiebreak(result.players);
        break;

      case 'winner':
        _showWinner(result.player);
        break;
    }
  }

  // ╔══════════════════════════════════════════╗
  // ║  ЭКРАН: ИТОГ РАУНДА                      ║
  // ╚══════════════════════════════════════════╝

  const roundModal     = document.getElementById('round-modal');
  const roundTitle     = document.getElementById('round-title');
  const roundElimName  = document.getElementById('round-elim-name');
  const roundContinue  = document.getElementById('round-continue-btn');

  function _showRoundEnd(eliminated, scores) {
    if (!roundModal) return;
    const PC = window.PlayersController;

    roundTitle.textContent = 'Итоги раунда ' + (PC.getRound() - 1);
    roundElimName.innerHTML =
      `<span style="color:${eliminated.color}">${_escape(eliminated.name)}</span> выбывает!` +
      `<br><small style="color:var(--color-text-muted)">Набрано за раунд: ${eliminated.score} очк.</small>`;

    roundModal.hidden = false;
  }

  roundContinue?.addEventListener('click', () => {
    roundModal.hidden = true;
    _updateWheelForRound();
    // Больше не сбрасываем usedTasks между раундами по просьбе:
    // "выпала один раз - больше не выпадает до конца всей игры"
    _unlockSpin();
  });

  // ╔══════════════════════════════════════════╗
  // ║  ЭКРАН: ТАЙБРЕЙК                         ║
  // ╚══════════════════════════════════════════╝

  const tiebreakModal  = document.getElementById('tiebreak-modal');
  const tiebreakNames  = document.getElementById('tiebreak-names');
  const tiebreakGoBtn  = document.getElementById('tiebreak-go-btn');

  function _showTiebreak(players) {
    if (!tiebreakModal) return;
    tiebreakNames.innerHTML = players.map(p =>
      `<span class="tiebreak-name" style="color:${p.color}">${_escape(p.name)}</span>`
    ).join(' vs ');
    tiebreakModal.hidden = false;
  }

  tiebreakGoBtn?.addEventListener('click', () => {
    tiebreakModal.hidden = true;
    _unlockSpin();
  });

  // ╔══════════════════════════════════════════╗
  // ║  ЭКРАН: ПОБЕДИТЕЛЬ + КОНФЕТТИ            ║
  // ╚══════════════════════════════════════════╝

  const winnerModal    = document.getElementById('winner-modal');
  const winnerName     = document.getElementById('winner-name');
  const winnerScore    = document.getElementById('winner-score');
  const winnerRestart  = document.getElementById('winner-restart-btn');

  function _showWinner(player) {
    if (!winnerModal || !player) return;

    winnerName.innerHTML = `<span style="color:${player.color}">${_escape(player.name)}</span>`;
    winnerScore.textContent = `${player.score} очков в финале`;
    winnerModal.hidden = false;

    window.AudioController?.winChord();

    _launchConfetti();
  }

  winnerRestart?.addEventListener('click', () => {
    winnerModal.hidden = true;
    _stopConfetti();
    // Возврат к setup
    gameScreen.hidden  = true;
    setupScreen.hidden = false;
    document.body.classList.remove('game-active');
    document.body.classList.add('setup-active');
    playerNames = [];
    _renderSetupList();
    playerInput.focus();
  });

  // ╔══════════════════════════════════════════╗
  // ║  КОНФЕТТИ (CSS-анимация)                  ║
  // ╚══════════════════════════════════════════╝

  let confettiContainer = null;

  function _launchConfetti() {
    _stopConfetti();
    confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    document.body.appendChild(confettiContainer);

    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1',
                    '#C62828', '#2B3AFF', '#F57F17', '#E91E63'];

    for (let i = 0; i < 80; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left     = Math.random() * 100 + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay    = (Math.random() * 2) + 's';
      piece.style.animationDuration = (2 + Math.random() * 3) + 's';
      piece.style.width  = (4 + Math.random() * 6) + 'px';
      piece.style.height = (8 + Math.random() * 12) + 'px';
      confettiContainer.appendChild(piece);
    }
  }

  function _stopConfetti() {
    if (confettiContainer) {
      confettiContainer.remove();
      confettiContainer = null;
    }
  }

  // ╔══════════════════════════════════════════╗
  // ║  УТИЛИТЫ                                  ║
  // ╚══════════════════════════════════════════╝

  function _updateWheelForRound() {
    const PC   = window.PlayersController;
    const prob = PC.getSectorProbabilities();
    if (window.WheelController?.rebuildSegments) {
      WheelController.rebuildSegments(prob.whiteCount, prob.blackCount, prob.redCount);
    }
  }

  function _unlockSpin() {
    isSpinning       = false;
    spinBtn.disabled = false;
  }

  function _flashScore(text) {
    const el = document.createElement('div');
    el.className = 'score-flash';
    el.textContent = text;
    document.getElementById('game-screen')?.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function _escape(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

})();
