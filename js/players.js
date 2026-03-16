/**
 * WTF-РУЛЕТКА — players.js
 * Управление игроками: раунды, очки, вылет, тайбрейк
 *
 * Логика раундов:
 *   - Каждый раунд = N кругов (N = количество активных игроков × SPINS_PER_PLAYER)
 *   - Каждый активный игрок крутит колесо SPINS_PER_PLAYER раз за раунд
 *   - После раунда — выбывает игрок с минимальным счётом
 *   - Если ничья — тайбрейк (дополнительные задания)
 *   - Когда остаётся 1 игрок — победа
 */

window.PlayersController = (function () {
  'use strict';

  // === Константы ===
  const POINTS            = { white: 25, black: 50, red: 100 };
  const SPINS_PER_PLAYER  = 3;  // Сколько раз каждый игрок крутит за раунд

  const AVATAR_COLORS = [
    '#2B3AFF', '#C62828', '#2E7D32', '#F57F17',
    '#6A1B9A', '#00838F', '#AD1457', '#37474F',
  ];

  // === Состояние ===
  let allPlayers       = [];   // [{name, score, roundScore, color, eliminated}]
  let activePlayers    = [];   // Только неисключённые
  let currentIndex     = 0;
  let round            = 0;
  let spinInRound      = 0;    // Сколько кручений уже прошло в текущем раунде
  let totalSpinsInRound = 0;   // Всего кручений в раунде

  // Тайбрейк
  let tiebreakMode     = false;
  let tiebreakPlayers  = [];   // Игроки в тайбрейке
  let tiebreakIndex    = 0;

  // DOM
  let turnEl       = null;
  let scoreboardEl = null;

  // =============================================
  //  ИНИЦИАЛИЗАЦИЯ
  // =============================================
  function init(names) {
    allPlayers = names.map((name, i) => ({
      name:       name.trim() || 'Игрок ' + (i + 1),
      score:      0,
      roundScore: 0,
      color:      AVATAR_COLORS[i % AVATAR_COLORS.length],
      eliminated: false,
    }));
    activePlayers = allPlayers.filter(p => !p.eliminated);
    currentIndex  = 0;
    round         = 1;
    spinInRound   = 0;
    totalSpinsInRound = activePlayers.length * SPINS_PER_PLAYER;
    tiebreakMode  = false;
    _render();
  }

  // =============================================
  //  ТЕКУЩЕЕ СОСТОЯНИЕ
  // =============================================
  function getCurrentPlayer() {
    if (tiebreakMode) return tiebreakPlayers[tiebreakIndex] || null;
    return activePlayers[currentIndex] || null;
  }

  function getRound()     { return round; }
  function getSpinInfo()  { return { current: spinInRound, total: totalSpinsInRound }; }
  function isInTiebreak() { return tiebreakMode; }
  function getActiveCount() { return activePlayers.length; }

  // =============================================
  //  НАЧИСЛИТЬ ОЧКИ
  // =============================================
  function addPoints(sector) {
    const pts    = POINTS[sector] || 0;
    const player = getCurrentPlayer();
    if (player) {
      player.score      += pts;
      player.roundScore += pts;
    }
    return pts;
  }

  // =============================================
  //  СЛЕДУЮЩИЙ ХОД (вызывается app.js после карточки)
  //  Возвращает объект-событие:
  //    { type: 'nextTurn' }
  //    { type: 'roundEnd', eliminated, scores }
  //    { type: 'tiebreak', players }
  //    { type: 'winner', player }
  // =============================================
  function nextTurn() {
    // --- Тайбрейк ---
    if (tiebreakMode) {
      tiebreakIndex++;
      if (tiebreakIndex >= tiebreakPlayers.length) {
        // Все игроки тайбрейка отыграли — определяем проигравшего
        return _resolveTiebreak();
      }
      _render();
      return { type: 'nextTurn' };
    }

    // --- Обычный раунд ---
    spinInRound++;

    // Переход к следующему игроку
    currentIndex = (currentIndex + 1) % activePlayers.length;

    // Раунд закончился?
    if (spinInRound >= totalSpinsInRound) {
      return _endRound();
    }

    _render();
    return { type: 'nextTurn' };
  }

  // =============================================
  //  КОНЕЦ РАУНДА
  // =============================================
  function _endRound() {
    // Собираем результаты раунда
    const scores = activePlayers.map(p => ({ name: p.name, roundScore: p.roundScore, color: p.color }));

    // Находим минимальный roundScore
    const minScore = Math.min(...activePlayers.map(p => p.roundScore));
    const losers   = activePlayers.filter(p => p.roundScore === minScore);

    // Ничья?
    if (losers.length > 1 && losers.length < activePlayers.length) {
      // Тайбрейк!
      tiebreakMode    = true;
      tiebreakPlayers = losers.map(p => {
        p.roundScore = 0; // Обнуляем за тайбрейк-раунд
        return p;
      });
      tiebreakIndex   = 0;
      _render();
      return { type: 'tiebreak', players: losers.map(p => ({ name: p.name, color: p.color })) };
    }

    // Вылет!
    const eliminated = losers[0];
    eliminated.eliminated = true;
    activePlayers = allPlayers.filter(p => !p.eliminated);

    // Победитель?
    if (activePlayers.length <= 1) {
      _render();
      return { type: 'winner', player: activePlayers[0] || eliminated };
    }

    // Готовим следующий раунд
    _startNewRound();

    return {
      type: 'roundEnd',
      eliminated: { name: eliminated.name, color: eliminated.color, score: eliminated.score },
      scores,
    };
  }

  // =============================================
  //  ТАЙБРЕЙК
  // =============================================
  function _resolveTiebreak() {
    const minScore = Math.min(...tiebreakPlayers.map(p => p.roundScore));
    const losers   = tiebreakPlayers.filter(p => p.roundScore === minScore);

    // Всё ещё ничья? Ещё один тайбрейк
    if (losers.length > 1 && losers.length === tiebreakPlayers.length) {
      // Все набрали одинаково — повтор тайбрейка
      tiebreakPlayers.forEach(p => p.roundScore = 0);
      tiebreakIndex = 0;
      _render();
      return { type: 'tiebreak', players: tiebreakPlayers.map(p => ({ name: p.name, color: p.color })) };
    }

    // Если ≥2 проигравших с min, но не все — повтор тайбрейка среди них
    if (losers.length > 1) {
      tiebreakPlayers = losers;
      tiebreakPlayers.forEach(p => p.roundScore = 0);
      tiebreakIndex = 0;
      _render();
      return { type: 'tiebreak', players: losers.map(p => ({ name: p.name, color: p.color })) };
    }

    // Вылет проигравшего
    const eliminated = losers[0];
    eliminated.eliminated = true;
    activePlayers = allPlayers.filter(p => !p.eliminated);
    tiebreakMode  = false;

    if (activePlayers.length <= 1) {
      _render();
      return { type: 'winner', player: activePlayers[0] || eliminated };
    }

    _startNewRound();

    return {
      type: 'roundEnd',
      eliminated: { name: eliminated.name, color: eliminated.color, score: eliminated.score },
      scores: activePlayers.map(p => ({ name: p.name, roundScore: p.roundScore, color: p.color })),
    };
  }

  // =============================================
  //  НОВЫЙ РАУНД
  // =============================================
  function _startNewRound() {
    round++;
    spinInRound       = 0;
    currentIndex      = 0;
    totalSpinsInRound = activePlayers.length * SPINS_PER_PLAYER;

    // Обнуляем roundScore
    activePlayers.forEach(p => p.roundScore = 0);

    _render();
  }

  // =============================================
  //  ВЕРОЯТНОСТИ СЕКТОРОВ (зависят от раунда)
  //
  //  Раунд 1: white 65%, black 30%, red  5%
  //  Каждый раунд шанс чёрного +5%, красного +5%, макс red = 50%
  //  Раунд 2: white 55%, black 35%, red 10%
  //  Раунд 5: white 25%, black 50%, red 25%
  //  Раунд 10+: white 0%, black 50%, red 50%
  // =============================================
  function getSectorProbabilities() {
    const r = round - 1; // 0-based
    let redPct   = Math.min(5  + r * 5, 50);
    let blackPct = Math.min(30 + r * 5, 50);
    let whitePct = 100 - blackPct - redPct;
    if (whitePct < 0) whitePct = 0;

    // Пересчитываем на 20 сегментов
    const total = 20;
    let redCount   = Math.round(total * redPct   / 100);
    let blackCount = Math.round(total * blackPct / 100);
    let whiteCount = total - blackCount - redCount;
    if (whiteCount < 0) { whiteCount = 0; blackCount = total - redCount; }

    return { whiteCount, blackCount, redCount };
  }

  // =============================================
  //  РЕНДЕР
  // =============================================
  function _render() {
    const cur = getCurrentPlayer();
    if (!cur) return;

    if (turnEl) {
      const prefix = tiebreakMode ? '⚔️ ТАЙБРЕЙК — ' : '';
      turnEl.innerHTML =
        `<span class="turn-avatar" style="background:${cur.color}">` +
        _initials(cur.name) +
        `</span>` +
        `<span class="turn-name">${prefix}${_escape(cur.name)}</span>` +
        `<span class="turn-round">Раунд ${round}</span>`;
    }

    if (scoreboardEl) {
      scoreboardEl.innerHTML = activePlayers.map((p, i) => {
        const isActive = (tiebreakMode ? p === tiebreakPlayers[tiebreakIndex] : i === currentIndex);
        return `
          <div class="score-row ${isActive ? 'score-row--active' : ''}">
            <span class="score-avatar" style="background:${p.color}">${_initials(p.name)}</span>
            <span class="score-name">${_escape(p.name)}</span>
            <span class="score-round-pts">${p.roundScore}</span>
            <span class="score-pts">${p.score} <small>очк.</small></span>
          </div>`;
      }).join('');
    }
  }

  function bindDOM(turnElement, scoreboardElement) {
    turnEl       = turnElement;
    scoreboardEl = scoreboardElement;
    _render();
  }

  function getAll() {
    return activePlayers.map((p, i) => ({ ...p, isActive: i === currentIndex }));
  }

  // === Утилиты ===
  function _initials(name) { return name.trim().slice(0, 2).toUpperCase(); }
  function _escape(str)    { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // === API ===
  return {
    POINTS,
    init,
    getCurrentPlayer,
    addPoints,
    nextTurn,
    getAll,
    bindDOM,
    getRound,
    getSpinInfo,
    isInTiebreak,
    getActiveCount,
    getSectorProbabilities,
  };

})();
