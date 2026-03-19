/**
 * КОЛЕСО ТРЕША — wheel.js
 * Canvas-рендер колеса фортуны + логика вращения + определение сектора
 *
 * Спринт 8: Новая механика (CR-002-002)
 *
 * Архитектура:
 *   - 10 сегментов: динамическое соотношение белых/чёрных/красных
 *   - Вероятности меняются каждый раунд
 *   - К финалу: 0% белых, только чёрные и красные
 *   - Указатель находится сверху → финальный угол читается от -90°
 *   - Событие 'wheelStopped' с { detail: { sector } } после остановки
 */

window.WheelController = (function () {
  'use strict';

  // === Конфигурация секторов (мутабельная — перестраивается каждый раунд) ===
  // Спринт 8: 10 секторов вместо 20
  let SEGMENTS = [
    'white', 'white', 'black', 'white', 'black',
    'white', 'red', 'white', 'black', 'white',
  ];

  let TOTAL = SEGMENTS.length;
  let ARC   = (2 * Math.PI) / TOTAL;

  // ╔══════════════════════════════════════════╗
  // ║  Спринт 8: ДИНАМИЧЕСКИЕ ВЕРОЯТНОСТИ      ║
  // ╚══════════════════════════════════════════╝

  // Прогрессия вероятностей по раундам (для 10 секторов)
  // Раунд 1: 6W / 3B / 1R (60% / 30% / 10%)
  // Раунд 2: 5W / 4B / 1R (50% / 40% / 10%)
  // Раунд 3: 4W / 4B / 2R (40% / 40% / 20%)
  // Раунд 4: 3W / 5B / 2R (30% / 50% / 20%)
  // Раунд 5: 2W / 5B / 3R (20% / 50% / 30%)
  // Финал:  0W / 6B / 4R (0% / 60% / 40%)
  const ROUND_PROGRESSION = [
    { w: 6, b: 3, r: 1 }, // Раунд 1
    { w: 5, b: 4, r: 1 }, // Раунд 2
    { w: 4, b: 4, r: 2 }, // Раунд 3
    { w: 3, b: 5, r: 2 }, // Раунд 4
    { w: 2, b: 5, r: 3 }, // Раунд 5
    { w: 0, b: 6, r: 4 }, // Финал (максимум)
  ];

  /**
   * Расчёт секторов для текущего раунда
   * @param {number} roundNum - номер раунда (1-based)
   * @param {number} playerCount - количество игроков (2-8)
   * @returns {object} { whiteCount, blackCount, redCount }
   */
  function getSectorsForRound(roundNum, playerCount) {
    // Выбор прогрессии в зависимости от раунда
    const index = Math.min(roundNum - 1, ROUND_PROGRESSION.length - 1);
    const baseProbs = ROUND_PROGRESSION[index];

    // Адаптация от числа игроков:
    // 2 игрока: прогрессия быстрее (x1.3)
    // 3-4 игрока: стандарт (x1.0)
    // 5-8 игроков: прогрессия медленнее (x0.8)
    let multiplier = 1.0;
    if (playerCount === 2) {
      multiplier = 1.3;
    } else if (playerCount >= 5) {
      multiplier = 0.8;
    }

    // Корректировка с округлением
    let whiteCount = Math.round(baseProbs.w / multiplier);
    let blackCount = Math.round(baseProbs.b * multiplier);
    let redCount = Math.round(baseProbs.r * multiplier);

    // Гарантируем сумму = 10
    const total = whiteCount + blackCount + redCount;
    if (total !== 10) {
      const diff = 10 - total;
      // Добавляем/вычитаем из наибольшей категории
      if (diff > 0) {
        if (blackCount >= whiteCount && blackCount >= redCount) {
          blackCount += diff;
        } else if (whiteCount >= blackCount && whiteCount >= redCount) {
          whiteCount += diff;
        } else {
          redCount += diff;
        }
      } else {
        if (whiteCount >= blackCount && whiteCount >= redCount) {
          whiteCount += diff; // diff отрицательный
        } else if (blackCount >= whiteCount && blackCount >= redCount) {
          blackCount += diff;
        } else {
          redCount += diff;
        }
      }
    }

    // Финал: гарантированно 0 белых
    if (roundNum >= ROUND_PROGRESSION.length) {
      whiteCount = 0;
      // Перераспределяем белые между чёрными и красными
      const extra = blackCount + redCount;
      blackCount = Math.round(extra * 0.6); // 60% чёрных
      redCount = extra - blackCount;        // 40% красных
    }

    return { whiteCount, blackCount, redCount };
  }

  // Перестройка секторов по заданным количествам.
  // Гарантирует: max 2 одинаковых сектора подряд (включая wrap по кольцу).
  function rebuildSegments(whiteCount, blackCount, redCount) {
    const total = whiteCount + blackCount + redCount;

    // Бакеты: сколько каждого типа осталось разместить
    const buckets = { white: whiteCount, black: blackCount, red: redCount };
    const order   = ['white', 'black', 'red']; // приоритет при выборе
    const result  = [];

    for (let i = 0; i < total; i++) {
      // Последние 2 элемента
      const prev1 = result[i - 1];
      const prev2 = result[i - 2];

      // Выбираем тип: тот, у которого осталось больше всего,
      // но НЕ совпадает с двумя предыдущими подряд
      let best = null;
      let bestCount = -1;

      for (const type of order) {
        if (buckets[type] <= 0) continue;
        // Запрещаем 3 подряд
        if (prev1 === type && prev2 === type) continue;
        if (buckets[type] > bestCount) {
          bestCount = buckets[type];
          best = type;
        }
      }

      // Fallback — если все запрещены (теоретически не должно быть)
      if (!best) {
        for (const type of order) {
          if (buckets[type] > 0) { best = type; break; }
        }
      }

      result.push(best);
      buckets[best]--;
    }

    // Проверка wrap-around: result[0] и result[total-1] и result[total-2]
    // Если 3 подряд на стыке — свапаем
    if (total >= 3) {
      const last  = result[total - 1];
      const prev  = result[total - 2];
      const first = result[0];
      if (last === prev && last === first) {
        // Ищем ячейку для swap
        for (let j = 1; j < total - 2; j++) {
          if (result[j] !== last && result[j - 1] !== last && result[j + 1] !== last) {
            [result[total - 1], result[j]] = [result[j], result[total - 1]];
            break;
          }
        }
      }
    }

    SEGMENTS = result;
    TOTAL    = SEGMENTS.length;
    ARC      = (2 * Math.PI) / TOTAL;

    if (ctx) draw(currentAngle);
  }

  // Цветы сегментов — пластиковый стиль
  const COLORS = {
    white: { fill: '#DCDDE6', stroke: 'rgba(255,255,255,0.6)'  },  // Светлый пластик
    black: { fill: '#1C1D26', stroke: 'rgba(80,85,110,0.5)'    },  // Тёмный оникс
    red:   { fill: '#C62828', stroke: 'rgba(220,60,60,0.6)'    },  // Насыщенный алый
  };

  // Глубокие оттенки для объёма
  const GRADIENT_DARK = {
    white: '#B8BAC8',   // Холодный серый (тень)
    black: '#0F1018',   // Глубокий чёрный
    red:   '#8B1A1A',   // Тёмно-красный
  };

  // Цвет разделительных линий (единый для всех)
  const DIVIDER_COLOR = 'rgba(201, 168, 76, 0.55)'; // Золотой разделитель

  // === Состояние ===
  let canvas, ctx;
  let currentAngle = 0;     // Текущий угол поворота колеса (рад)
  let animationId  = null;
  let isSpinning   = false;

  // === Пересчёт размера канваса ===
  function resizeCanvas() {
    if (!canvas) return;
    const container = canvas.parentElement;
    const size = (container && container.offsetWidth > 0)
      ? container.offsetWidth
      : 320;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';

    // Сбрасываем трансформацию и заново масштабируем
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Перерисовываем с текущим углом
    draw(currentAngle);
  }

  // === Инициализация ===
  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('[Wheel] Canvas #' + canvasId + ' не найден');
      return;
    }
    ctx = canvas.getContext('2d');

    // BUG-002 FIX: читаем реальный размер контейнера вместо CSS-переменной min(Xpx, Ypx)
    // parseInt('min(80vw, 340px)') → NaN, поэтому используем offsetWidth
    const container = canvas.parentElement;
    const size = (container && container.offsetWidth > 0)
      ? container.offsetWidth
      : 320;

    // Учитываем devicePixelRatio для чёткости на Retina
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    // Первичная отрисовка
    draw(currentAngle);

    // Idle-анимация: лёгкое покачивание
    startIdleAnimation();

    // === Адаптив: пересчёт при повороте экрана / изменении размера ===
    // ResizeObserver следит за контейнером (точнее, чем window resize)
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (!isSpinning) resizeCanvas();
      });
      ro.observe(container);
    } else {
      // Fallback для старых браузеров
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!isSpinning) resizeCanvas();
        }, 150);
      });
    }
  }

  // =====================
  // Отрисовка колеса
  // =====================
  function draw(angle) {
    if (!ctx) return;
    const size   = canvas.width  / (window.devicePixelRatio || 1);
    const cx     = size / 2;
    const cy     = size / 2;
    const radius = size / 2 - 4; // Отступ для обводки

    // BUG-007 FIX: clearRect должен очищать весь canvas с учётом DPR
    // size = логический размер, canvas.width = size * DPR
    // После ctx.scale(dpr, dpr) clearRect(0,0,size,size) покрывает весь логический размер — OK
    ctx.clearRect(0, 0, size, size);

    // --- 1. Тень под колесом ---
    ctx.save();
    ctx.shadowColor   = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur    = 28;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#13141A';
    ctx.fill();
    ctx.restore();

    // --- 2. Сегменты ---
    for (let i = 0; i < TOTAL; i++) {
      const startAngle = angle + i * ARC - Math.PI / 2;
      const endAngle   = startAngle + ARC;
      const type       = SEGMENTS[i];

      ctx.save();

      // Сектор-путь
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // Радиальный градиент для объёма
      const midAngle = startAngle + ARC / 2;
      const gx = cx + (radius * 0.5) * Math.cos(midAngle);
      const gy = cy + (radius * 0.5) * Math.sin(midAngle);
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.15, gx, gy, radius * 0.8);
      grad.addColorStop(0,   COLORS[type].fill);
      grad.addColorStop(0.6, COLORS[type].fill);
      grad.addColorStop(1,   GRADIENT_DARK[type]);

      ctx.fillStyle = grad;
      ctx.fill();

      // Разделительная линия — золотой разделитель
      ctx.strokeStyle = DIVIDER_COLOR;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      ctx.restore();
    }

    // --- 3. Внешнее кольцо — золотая металлическая обводка ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#C9A84C';  // Золотой
    ctx.lineWidth   = 4;
    ctx.shadowColor = 'rgba(201, 168, 76, 0.5)';
    ctx.shadowBlur  = 8;
    ctx.stroke();
    ctx.restore();

    // Внутренняя тонкая обводка
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 5, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(201,168,76,0.25)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();

    // --- 4. Центральный хаб — золотой металлический ---
    const centerR = radius * 0.16;

    // Фон хаба — золотой градиент
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, 2 * Math.PI);
    const centerGrad = ctx.createRadialGradient(cx - centerR*0.3, cy - centerR*0.3, 0, cx, cy, centerR);
    centerGrad.addColorStop(0, '#F0D070');   // Светлое золото
    centerGrad.addColorStop(0.45, '#C9A84C'); // Среднее золото
    centerGrad.addColorStop(1,    '#7A6020');  // Тёмное золото
    ctx.fillStyle = centerGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur  = 12;
    ctx.fill();
    ctx.restore();

    // Внешняя обводка хаба
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, 2 * Math.PI);
    ctx.strokeStyle = '#E8C96A';
    ctx.lineWidth   = 2;
    ctx.shadowColor = 'rgba(201, 168, 76, 0.4)';
    ctx.shadowBlur  = 6;
    ctx.stroke();
    ctx.restore();

    // Внутреннее кольцо хаба (декор)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerR * 0.6, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();

  }


  // =====================
  // Idle-анимация: покачивание ±2°
  // =====================
  let idleAnimationId = null;
  let idleStartTime   = null;

  function startIdleAnimation() {
    if (isSpinning) return;
    idleStartTime = performance.now();

    function idleTick(now) {
      // BUG-006 FIX: отменяем RAF явно, а не bare return (иначе утечка фреймов)
      if (isSpinning) {
        idleAnimationId = null;
        return;
      }
      const elapsed  = now - idleStartTime;
      const wobble   = Math.sin(elapsed / 1200) * (2 * Math.PI / 180); // ±2°
      draw(currentAngle + wobble);
      idleAnimationId = requestAnimationFrame(idleTick);
    }

    idleAnimationId = requestAnimationFrame(idleTick);
  }

  function stopIdleAnimation() {
    if (idleAnimationId) {
      cancelAnimationFrame(idleAnimationId);
      idleAnimationId = null;
    }
  }

  // =====================
  // Вращение колеса
  // =====================
  function spin() {
    if (isSpinning) return;
    isSpinning = true;
    stopIdleAnimation();

    // Рассчитываем целевой угол:
    // 6–10 полных оборотов + случайный сдвиг в пределах полного круга
    const fullRotations   = (6 + Math.random() * 4) * 2 * Math.PI;
    const extraAngle      = Math.random() * 2 * Math.PI;
    const totalRotation   = fullRotations + extraAngle;
    const targetAngle     = currentAngle + totalRotation;
    const duration        = 3500 + Math.random() * 1500; // 3.5–5 сек
    const startAngle      = currentAngle;
    const startTime       = performance.now();

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    let lastTickAngle = Math.floor(startAngle / ARC);

    function tick(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = easeOut(progress);

      currentAngle = startAngle + (targetAngle - startAngle) * eased;
      draw(currentAngle);

      // Проверка пересечения границы сектора для звука тиканья
      const currentTickAngle = Math.floor(currentAngle / ARC);
      if (currentTickAngle !== lastTickAngle) {
        window.AudioController?.tick();
        try { tg?.HapticFeedback?.selectionChanged(); } catch (_) {}
        lastTickAngle = currentTickAngle;
      }

      if (progress < 1) {
        animationId = requestAnimationFrame(tick);
      } else {
        // Нормализуем угол в диапазон [0, 2π]
        currentAngle = currentAngle % (2 * Math.PI);
        if (currentAngle < 0) currentAngle += 2 * Math.PI;

        onSpinComplete();
      }
    }

    animationId = requestAnimationFrame(tick);
  }

  // =====================
  // Определение результата
  // =====================
  function onSpinComplete() {
    isSpinning = false;

    const sector = detectSector();
    console.log('[Wheel] Остановился на секторе:', sector);

    // Запускаем idle снова
    startIdleAnimation();

    // Генерируем событие для app.js и modal.js
    const event = new CustomEvent('wheelStopped', {
      detail: { sector },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }

  /**
   * Определяет тип сектора под указателем (стрелка сверху = -π/2 в Canvas).
   *
   * МАТЕМАТИКА (доказательство):
   *   Сегмент i рисуется от: (currentAngle + i*ARC - π/2)
   *   Указатель = -π/2
   *   Ищем i: currentAngle + i*ARC - π/2 <= -π/2 < currentAngle + (i+1)*ARC - π/2
   *   → currentAngle + i*ARC <= 0 < currentAngle + (i+1)*ARC
   *   → i*ARC <= -currentAngle < (i+1)*ARC
   *   → i = floor((-currentAngle) / ARC)  [с нормализацией в [0, 2π)]
   *
   *   ВАЖНО: -π/2 из функции рисования уже сокращается с -π/2 указателя.
   *   В формуле детекции -π/2 НЕ должен присутствовать.
   */
  function detectSector() {
    // Нормализуем -currentAngle в диапазон [0, 2π)
    const norm = ((-currentAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    // Какой сегмент находится под указателем
    const segmentIndex = Math.floor(norm / ARC) % TOTAL;

    const result = SEGMENTS[segmentIndex];
    console.log('[Wheel] angle=', currentAngle.toFixed(3),
                'norm=', norm.toFixed(3),
                'idx=', segmentIndex,
                'sector=', result);
    return result; // 'white' | 'black' | 'red'
  }

  // === Публичный API ===
  return {
    init,
    spin,
    rebuildSegments,
    getSectorsForRound,  // Спринт 8: публичный метод для расчёта вероятностей
    getAngleDeg: () => ((currentAngle * 180 / Math.PI) % 360).toFixed(1),
    currentSector: detectSector,
  };

})();
