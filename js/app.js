/**
 * WTF-РУЛЕТКА — app.js
 * Главный контроллер: setup → раунды → вылет → тайбрейк → победа + конфетти
 *
 * Спринт 12: Age/Code verification только при старте игры 21+
 */

(function () {
  'use strict';

  // === КОНСТАНТЫ ДОСТУПА (LUX) ===
  const LUX_CODE = 'LUX2026';
  const AGE_KEY = 'wt_age_verified';
  const CODE_KEY = 'wt_lux_code';
  const VERSION_KEY = 'wt_game_version';

  // === Telegram Web App SDK ===
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();

    // ТЕМА: Только тёмная (CR-001)
    document.documentElement.className = 'theme-dark';

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

  // === AGE VERIFICATION (21+) — модальные окна ===
  const ageGateModal = document.getElementById('age-gate-modal');
  const codeGateModal = document.getElementById('code-gate-modal');
  const accessDenied = document.getElementById('access-denied');
  const ageYesBtn = document.getElementById('age-yes-btn');
  const ageNoBtn = document.getElementById('age-no-btn');
  const codeSubmitBtn = document.getElementById('code-submit-btn');
  const codeCancelBtn = document.getElementById('code-cancel-btn');
  const codeInput = document.getElementById('lux-code-input');
  const codeError = document.getElementById('code-error');

  // Переменные для отложенного старта игры
  let pendingGameStart = false;
  let pendingPlayerNames = [];

  function showAgeGate() {
    if (ageGateModal) ageGateModal.hidden = false;
  }

  function showCodeGate() {
    if (codeGateModal) {
      codeGateModal.hidden = false;
      if (codeInput) codeInput.value = '';
      if (codeError) codeError.hidden = true;
      setTimeout(() => codeInput?.focus(), 100);
    }
  }

  function denyAccess() {
    if (ageGateModal) ageGateModal.hidden = true;
    if (codeGateModal) codeGateModal.hidden = true;
    if (accessDenied) accessDenied.hidden = false;
  }

  // Обработчик: "Да, мне есть 21"
  ageYesBtn?.addEventListener('click', () => {
    localStorage.setItem(AGE_KEY, 'true');
    if (ageGateModal) ageGateModal.hidden = true;

    // Если была попытка старта игры — продолжаем
    if (pendingGameStart) {
      showCodeGate();
    }

    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (_) {}
  });

  // Обработчик: "Нет, мне нет 21"
  ageNoBtn?.addEventListener('click', () => {
    denyAccess();
    try { tg?.HapticFeedback?.notificationOccurred('error'); } catch (_) {}
  });

  // Обработчик: Ввод кода
  codeSubmitBtn?.addEventListener('click', () => {
    const code = codeInput?.value.trim().toUpperCase();

    if (!code) {
      if (codeError) {
        codeError.textContent = 'Введите код доступа';
        codeError.hidden = false;
      }
      return;
    }

    if (code === LUX_CODE) {
      localStorage.setItem(CODE_KEY, code);
      if (codeGateModal) codeGateModal.hidden = true;

      // Если была попытка старта игры — запускаем
      if (pendingGameStart) {
        pendingGameStart = false;
        startGameWithVersion('lux');
      }

      try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (_) {}
    } else {
      if (codeError) {
        codeError.textContent = 'Неверный код. Обратитесь к организатору игры.';
        codeError.hidden = false;
      }
      try { tg?.HapticFeedback?.notificationOccurred('error'); } catch (_) {}
    }
  });

  // Обработчик: Отмена кода
  codeCancelBtn?.addEventListener('click', () => {
    if (codeGateModal) codeGateModal.hidden = true;
    pendingGameStart = false;
    pendingPlayerNames = [];
  });

  // Обработчик: Enter в поле ввода кода
  codeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      codeSubmitBtn?.click();
    }
  });

  // Функция запуска игры с выбранной версией
  function startGameWithVersion(version) {
    if (version === 'lux') {
      document.documentElement.classList.add('theme-lux');
      if (window.TASKS_21PLUS) {
        window.TASKS = window.TASKS_21PLUS;
        window.TASKS.tiebreak = window.TASKS_NORMAL?.tiebreak || [];
      } else {
        window.TASKS = window.TASKS_NORMAL;
      }
    } else if (version === '18plus') {
      document.documentElement.classList.remove('theme-lux');
      if (window.TASKS_18PLUS) {
        window.TASKS = window.TASKS_18PLUS;
        window.TASKS.tiebreak = window.TASKS_NORMAL?.tiebreak || [];
      } else {
        window.TASKS = window.TASKS_NORMAL;
      }
    } else {
      document.documentElement.classList.remove('theme-lux');
      window.TASKS = window.TASKS_NORMAL;
    }

    const PC = window.PlayersController;
    PC.init(pendingPlayerNames);
    PC.bindDOM(
      document.getElementById('turn-banner'),
      document.getElementById('scoreboard'),
    );

    // Сброс использованных карточек перед новой игрой
    window.ModalController?.resetUsedTasks();

    const setupScreen = document.getElementById('setup-screen');
    const gameScreen = document.getElementById('game-screen');
    setupScreen.hidden = true;
    gameScreen.hidden = false;
    document.body.classList.remove('setup-active');
    document.body.classList.add('game-active');

    // Инициализация колеса с правильными пропорциями для раунда 1
    if (window.WheelController) {
      WheelController.init('wheel');
      if (typeof _updateWheelForRound === 'function') {
        _updateWheelForRound();
      }
    }

    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (_) {}
  }

  // === Аудио ОТКЛЮЧЕНО (CR-002) ===
  // AudioController не используется — звуки удалены

  // === Задания ===
  if (!window.TASKS) {
    console.error('[App] window.TASKS не найден — data/tasks.js не загружен?');
    window.TASKS = { white: [], black: [], red: [] };
  }

  // === Состояние ===
  let isSpinning = false;
  const historyList = [];
  const historyEl = document.getElementById('game-history');

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

  const setupScreen = document.getElementById('setup-screen');
  const gameScreen = document.getElementById('game-screen');
  const playerInput = document.getElementById('player-name-input');
  const addPlayerBtn = document.getElementById('add-player-btn');
  const playersList = document.getElementById('players-list');
  const startGameBtn = document.getElementById('start-game-btn');

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
    playerInput.disabled = playerNames.length >= 8;
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

    // Сохраняем имена игроков для отложенного старта
    pendingPlayerNames = playerNames;

    if (level === '21plus') {
      // Проверяем возраст и код
      const ageVerified = localStorage.getItem(AGE_KEY) === 'true';
      const codeEntered = localStorage.getItem(CODE_KEY) === LUX_CODE;

      if (!ageVerified) {
        // Сначала подтверждаем возраст
        pendingGameStart = true;
        showAgeGate();
        return;
      }

      if (!codeEntered) {
        // Затем запрашиваем код
        pendingGameStart = true;
        showCodeGate();
        return;
      }

      // Всё подтверждено — запускаем
      startGameWithVersion('lux');
    } else if (level === '18plus') {
      startGameWithVersion('18plus');
    } else {
      startGameWithVersion('normal');
    }
  });

  // ╔══════════════════════════════════════════╗
  // ║  ИГРОВОЕ ПОЛЕ                            ║
  // ╚══════════════════════════════════════════╝

  const spinBtn = document.getElementById('spin-btn');

  spinBtn.addEventListener('click', () => {
    if (isSpinning) return;
    spinBtn.disabled = true;
    isSpinning = true;
    try { tg?.HapticFeedback?.impactOccurred('medium'); } catch (_) {}
    if (window.WheelController) WheelController.spin();
  });

  // --- Колесо остановилось ---
  document.addEventListener('wheelStopped', (e) => {
    const sector = e.detail?.sector;
    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (_) {}
    setTimeout(() => {
      if (window.ModalController) ModalController.show(sector);
    }, 350);
  });

  // --- Игрок выполнил задание ---
  document.addEventListener('taskAccepted', (e) => {
    const sector = e.detail?.sector;
    const taskText = e.detail?.taskText || '...';
    const player = window.PlayersController?.getCurrentPlayer();

    if (player) {
      _addHistory(player.name, player.color, taskText);
    }

    const pts = window.PlayersController?.addPoints(sector) ?? 0;
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
    try { tg?.HapticFeedback?.notificationOccurred('warning'); } catch (_) {}
    _afterTurn();
  });

  // ╔══════════════════════════════════════════╗
  // ║  ПОСЛЕ ХОДА — ПРОВЕРКА РАУНДА            ║
  // ╚══════════════════════════════════════════╝

  function _afterTurn() {
    const PC = window.PlayersController;
    const result = PC.nextTurn();

    switch (result.type) {
      case 'nextTurn':
        _unlockSpin();
        break;

      case 'roundEnd':
        _showRoundEnd(result.eliminated, result.scores);
        _unlockSpin();
        break;

      case 'tiebreak':
        _showTiebreak(result.players);
        _unlockSpin();
        break;

      case 'winner':
        _showWinner(result.player);
        break;
    }
  }

  // ╔══════════════════════════════════════════╗
  // ║  ЭКРАН: ИТОГ РАУНДА                      ║
  // ╚══════════════════════════════════════════╝

  const roundModal = document.getElementById('round-modal');
  const roundTitle = document.getElementById('round-title');
  const roundElimName = document.getElementById('round-elim-name');
  const roundContinue = document.getElementById('round-continue-btn');

  function _showRoundEnd(eliminated, scores) {
    if (!roundModal) return;
    const PC = window.PlayersController;

    roundTitle.textContent = 'Итоги раунда ' + (PC.getRound() - 1);
    roundElimName.innerHTML =
      `<span style="color:${eliminated.color}">${_escape(eliminated.name)}</span> выбывает!` +
      `<br><small style="color:var(--color-text-muted)">Набрано за раунд: ${eliminated.roundScore} очк.</small>`;

    roundModal.hidden = false;
  }

  roundContinue?.addEventListener('click', () => {
    roundModal.hidden = true;
    _updateWheelForRound();
    _unlockSpin();
  });

  // ╔══════════════════════════════════════════╗
  // ║  ЭКРАН: ТАЙБРЕЙК                         ║
  // ╚══════════════════════════════════════════╝

  const tiebreakModal = document.getElementById('tiebreak-modal');
  const tiebreakNames = document.getElementById('tiebreak-names');
  const tiebreakGoBtn = document.getElementById('tiebreak-go-btn');

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

  const winnerModal = document.getElementById('winner-modal');
  const winnerName = document.getElementById('winner-name');
  const winnerScore = document.getElementById('winner-score');
  const winnerRestart = document.getElementById('winner-restart-btn');

  function _showWinner(player) {
    if (!winnerModal || !player) return;

    winnerName.innerHTML = `<span style="color:${player.color}">${_escape(player.name)}</span>`;
    winnerScore.textContent = `${player.roundScore} очков в финале`;
    winnerModal.hidden = false;

    _launchConfetti();
  }

  winnerRestart?.addEventListener('click', () => {
    winnerModal.hidden = true;
    _stopConfetti();
    // Возврат к setup
    gameScreen.hidden = true;
    setupScreen.hidden = false;
    document.body.classList.remove('game-active');
    document.body.classList.add('setup-active');
    // Сбрасываем LUX-тему при рестарте
    document.documentElement.classList.remove('theme-lux');
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
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 2) + 's';
      piece.style.animationDuration = (2 + Math.random() * 3) + 's';
      piece.style.width = (4 + Math.random() * 6) + 'px';
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
    const PC = window.PlayersController;
    const round = PC.getRound();
    const playerCount = PC.getPlayerCount();

    const probs = WheelController.getSectorsForRound(round, playerCount);

    if (probs && WheelController.rebuildSegments) {
      WheelController.rebuildSegments(probs.whiteCount, probs.blackCount, probs.redCount);
    }
  }

  function _unlockSpin() {
    isSpinning = false;
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
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();
