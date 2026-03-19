/**
 * WTF-РУЛЕТКА — modal.js
 * Управление модальным окном с карточками заданий
 *
 * API: window.ModalController = { show(sector), hide() }
 * События:
 *   'taskAccepted' → { sector } — игрок выполнил задание
 *   'taskRefused'  → { sector } — игрок отказался
 *   'modalClosed'  → разблокировка кнопки (совместимость с app.js)
 */

window.ModalController = (function () {
  'use strict';

  // === Конфигурация карточек ===
  const CARD_CONFIG = {
    white: {
      cssClass: 'card--white',
      icon:     '🎭',
      badge:    'РАЗМИНКА',
      title:    'Лёгкое задание',
    },
    black: {
      cssClass: 'card--black',
      icon:     '🃏',
      badge:    'УЖЕ НЕ СМЕШНО',
      title:    'Средний треш',
    },
    red: {
      cssClass: 'card--red',
      icon:     '💀',
      badge:    'ТОТАЛЬНЫЙ ТРЕШ',
      title:    'Хардкор',
    },
  };

  // === DOM-элементы ===
  const modal      = document.getElementById('modal');
  const modalInner = modal?.querySelector('.modal__inner');
  const card       = document.getElementById('card');
  const cardBadge  = document.getElementById('card-badge');
  const cardIcon   = document.getElementById('card-icon');
  const cardTitle  = document.getElementById('card-title');
  const cardText   = document.getElementById('card-text');
  const rewardPts  = document.getElementById('reward-pts');
  const acceptBtn  = document.getElementById('card-accept-btn');
  const refuseBtn  = document.getElementById('card-refuse-btn');
  const overlay    = document.getElementById('modal-overlay');

  // Penalty-popup при отказе
  const penaltyModal = document.getElementById('penalty-modal');
  const penaltyOkBtn = document.getElementById('penalty-ok-btn');

  // Текущий тип сектора и текст задания
  let currentSector = null;
  let currentTaskText = '';

  // === Система неповторяющихся карточек ===
  const usedTasks = { white: new Set(), black: new Set(), red: new Set(), tiebreak: new Set() };

  function _pickTask(sector) {
    const tasks = window.TASKS?.[sector] || [];
    if (!tasks.length) return { text: 'Задания загружаются...' };

    const used = usedTasks[sector];

    // Если все задания исчерпаны — сброс
    if (used.size >= tasks.length) used.clear();

    // Выбираем случайный неиспользованный индекс
    let idx;
    let attempts = 0;
    do {
      idx = Math.floor(Math.random() * tasks.length);
      attempts++;
    } while (used.has(idx) && attempts < tasks.length * 2);

    used.add(idx);
    return tasks[idx];
  }

  function resetUsedTasks() {
    usedTasks.white.clear();
    usedTasks.black.clear();
    usedTasks.red.clear();
    usedTasks.tiebreak.clear();
  }

  // === Показ карточки ===
  function show(sector) {
    if (!modal || !card) {
      console.error('[Modal] Элементы модалки не найдены');
      return;
    }

    // Выбор неповторяющегося задания
    const task = _pickTask(sector);
    currentTaskText = task.text;

    const config = CARD_CONFIG[sector] || CARD_CONFIG.white;
    const pts    = window.PlayersController?.POINTS?.[sector] ?? 0;
    currentSector = sector;

    // Класс карточки
    card.className = 'card ' + config.cssClass;

    // Контент
    cardIcon.textContent  = config.icon;
    cardBadge.textContent = config.badge;
    cardTitle.textContent = config.title;
    cardText.textContent  = task.text;
    cardText.scrollTop    = 0;

    // Награда
    if (rewardPts) rewardPts.textContent = '+' + pts + ' очков';

    // Сброс анимации появления:
    // ВАЖНО: сначала показываем модалку (hidden = false),
    // затем сбрасываем — только так offsetWidth триггерит reflow
    // на видимом элементе и браузер начинает анимацию с 0% keyframe.
    modal.classList.remove('modal--closing');
    modal.hidden = false;

    if (modalInner) {
      modalInner.style.animation = 'none';
      void modalInner.offsetWidth;  // synchronous reflow — перезапускает анимацию
      modalInner.style.animation = '';
    }

    // Фокус
    acceptBtn?.focus();
  }

  // === Закрытие с анимацией ===
  function hide() {
    if (!modal || modal.hidden) return;

    modal.classList.add('modal--closing');

    setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove('modal--closing');
      currentSector = null;
      document.dispatchEvent(new CustomEvent('modalClosed', { bubbles: true }));
    }, 220);
  }

  // === Кнопка «✅ Выполнил!» ===
  acceptBtn?.addEventListener('click', () => {
    const sector = currentSector;
    const taskText = currentTaskText;
    hide();
    // Сообщаем об успешном выполнении
    document.dispatchEvent(new CustomEvent('taskAccepted', {
      bubbles: true,
      detail: { sector, taskText },
    }));
  });

  // === Кнопка «❌ Отказываюсь» ===
  refuseBtn?.addEventListener('click', () => {
    const sector = currentSector;
    hide();

    // ✅ BUG-008 FIX: СРАЗУ отправляем событие — разблокировка произойдёт мгновенно
    document.dispatchEvent(new CustomEvent('taskRefused', {
      bubbles: true,
      detail: { sector },
    }));

    // Penalty-modal показываем с небольшой задержкой (для визуального эффекта)
    setTimeout(() => {
      if (penaltyModal) {
        penaltyModal.hidden = false;
        penaltyOkBtn?.focus();
      }
    }, 100);  // Уменьшено с 260ms до 100ms
  });

  // === Закрытие penalty-popup ===
  penaltyOkBtn?.addEventListener('click', () => {
    if (penaltyModal) penaltyModal.hidden = true;
  });

  // === Клик по оверлею ===
  overlay?.addEventListener('click', () => {
    // Оверлей не закрывает карточку — игрок должен нажать одну из кнопок
    // (чтобы очки были корректно начислены)
  });

  // === ESC (для тестирования на десктопе) ===
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal?.hidden) hide();
  });

  // === Публичный API ===
  return { show, hide, resetUsedTasks };

})();
