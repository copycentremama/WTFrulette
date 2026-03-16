/**
 * КОЛЕСО ТРЕША — audio.js
 * Синтез звуков через Web Audio API (без внешних файлов).
 * Сохраняет состояние Mute в localStorage.
 */

window.AudioController = (function() {
  let ctx = null;
  let isMuted = localStorage.getItem('koleso_muted') === 'true';

  // Инициализация контекста (вызывать по клику пользователя)
  function _init() {
    if (ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      ctx = new AudioContext();
    }
  }

  // --- Базовый генератор звука ---
  function _playTone(freq, type, duration, vol, decayTime = 0.1) {
    if (isMuted || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + decayTime);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  // Шум для карточек (белый шум + фильтр)
  function _playNoise(duration, vol) {
    if (isMuted || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Фильтр для глухого "взмаха"
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(100, ctx.currentTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  // --- Публичные методы (звуки) ---

  // Тиканье при прохождении сектора
  function tick() {
    _playTone(800, 'triangle', 0.05, 0.2, 0.05);
  }

  // Остановка: приятный колокольчик
  function stopDing() {
    _playTone(1200, 'sine',     0.8, 0.4, 0.5);
    _playTone(1600, 'triangle', 0.8, 0.2, 0.5);
  }

  // Появление карточки: глухой шорох + легкий тон
  function popCard() {
    _playNoise(0.2, 0.8);
    _playTone(300, 'sine', 0.1, 0.3, 0.1);
  }
  
  // Победа: веселый аккорд
  function winChord() {
    const time = ctx ? ctx.currentTime : 0;
    setTimeout(() => _playTone(523.25, 'triangle', 1.0, 0.3, 1), 0);   // C5
    setTimeout(() => _playTone(659.25, 'triangle', 1.0, 0.3, 1), 100); // E5
    setTimeout(() => _playTone(783.99, 'triangle', 1.0, 0.3, 1), 200); // G5
    setTimeout(() => _playTone(1046.50,'sine',     1.5, 0.4, 1.5),300);// C6
  }

  // Отказ: грустный бас
  function failBuzzer() {
    _playTone(150, 'sawtooth', 0.4, 0.4, 0.3);
    setTimeout(() => _playTone(130, 'sawtooth', 0.5, 0.4, 0.4), 200);
  }

  // --- Управление ---
  function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('koleso_muted', isMuted);
    _updateUI();
  }
  
  function getIsMuted() {
    return isMuted;
  }

  function _updateUI() {
    const btn = document.getElementById('mute-btn');
    if (!btn) return;
    btn.innerHTML = isMuted ? '🔇' : '🔊';
    btn.classList.toggle('muted', isMuted);
    
    // При клике на unmute - инитим аудио
    if (!isMuted && !ctx) _init();
  }

  // Инициализация при старте (привязка кнопки)
  function setup() {
    const btn = document.getElementById('mute-btn');
    if (btn) {
      btn.addEventListener('click', toggleMute);
    }
    _updateUI();

    // Пробуем инитить аудио при первом клике на экран (политика браузеров)
    document.addEventListener('click', _init, { once: true });
    document.addEventListener('touchstart', _init, { once: true });
  }

  return {
    setup,
    tick,
    stopDing,
    popCard,
    winChord,
    failBuzzer,
    toggleMute,
    getIsMuted
  };
})();
