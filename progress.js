/* ============================================================
   Seasons Park — Night Shift
   © 2026 Artem2023. Все права защищены.
   Копирование и распространение без разрешения запрещены.
   ============================================================ */
// ============================================================
// SEASONS PARK — progress.js
// Общий файл прогресса для всех страниц игры
// Хранит: пройденные ночи, звёзды, текущую ночь,
//         настройки кастомной ночи, рекорды
// ============================================================

(function(){
  const STORAGE_KEY = 'sp_progress';

  // ===== Прогресс по умолчанию =====
  const DEFAULT_PROGRESS = {
    night1: false,
    night2: false,
    night3: false,
    night4: false,
    night5: false,
    night6: false,
    customUnlocked: false,
    stars: 0,
    currentNight: 1,
    customAI: {
      lion: 10,
      owl: 10,
      wolf: 10,
      rabbit: 10,
    },
    records: {
      night1: { best: null, attempts: 0 },
      night2: { best: null, attempts: 0 },
      night3: { best: null, attempts: 0 },
      night4: { best: null, attempts: 0 },
      night5: { best: null, attempts: 0 },
      night6: { best: null, attempts: 0 },
    },
    settings: {
      volume: 'mid',
      difficulty: 'normal',
      effects: 'mid',
    },
    // Мета
    firstLaunch: Date.now(),
    lastPlayed: Date.now(),
    totalPlayTime: 0,
  };

  // ===== Загрузка =====
  function getProgress(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(DEFAULT_PROGRESS);
      const data = JSON.parse(raw);
      // Мержим с дефолтными, чтобы не потерять новые поля
      return mergeDeep(deepClone(DEFAULT_PROGRESS), data);
    }catch(e){
      console.warn('progress.js: ошибка загрузки, сброс к дефолту', e);
      return deepClone(DEFAULT_PROGRESS);
    }
  }

  // ===== Сохранение =====
  function saveProgress(data){
    try{
      data.lastPlayed = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    }catch(e){
      console.error('progress.js: ошибка сохранения', e);
      return false;
    }
  }

  // ===== Сброс =====
  function resetProgress(keepStars = true){
    const old = getProgress();
    const fresh = deepClone(DEFAULT_PROGRESS);
    if (keepStars){
      fresh.stars = old.stars;
    }
    saveProgress(fresh);
    return fresh;
  }

  // ===== Ночи =====
  function completeNight(n){
    const p = getProgress();
    if (n >= 1 && n <= 6){
      p['night' + n] = true;
      // Обновляем currentNight на следующую, если она ещё не пройдена
      if (n < 6 && !p['night' + (n+1)]){
        p.currentNight = n + 1;
      } else if (n === 5 && !p.night6){
        // После 5-й — открываем 6-ю
        p.currentNight = 6;
      } else if (n === 6){
        // После 6-й — открываем кастомную
        p.customUnlocked = true;
        p.currentNight = 1;
      }
      p.records['night' + n].attempts++;
      saveProgress(p);
    }
    return p;
  }

  function isNightCompleted(n){
    const p = getProgress();
    return p['night' + n] === true;
  }

  function isNightUnlocked(n){
    const p = getProgress();
    if (n === 1) return true;
    if (n >= 2 && n <= 5){
      return p['night' + (n-1)] === true;
    }
    if (n === 6){
      // Ночь 6 — только после прохождения всех 5
      return p.night1 && p.night2 && p.night3 && p.night4 && p.night5;
    }
    return false;
  }

  function isNightSecret(n){
    return n === 6;
  }

  function isCustomUnlocked(){
    const p = getProgress();
    return p.customUnlocked === true;
  }

  function unlockCustom(){
    const p = getProgress();
    p.customUnlocked = true;
    saveProgress(p);
    return p;
  }

  function getCurrentNight(){
    const p = getProgress();
    return p.currentNight || 1;
  }

  function setCurrentNight(n){
    const p = getProgress();
    p.currentNight = n;
    saveProgress(p);
    return p;
  }

  // ===== Звёзды =====
  function addStars(count = 1){
    const p = getProgress();
    p.stars += count;
    saveProgress(p);
    return p.stars;
  }

  function getStars(){
    const p = getProgress();
    return p.stars || 0;
  }

  function setStars(count){
    const p = getProgress();
    p.stars = count;
    saveProgress(p);
    return p.stars;
  }

  // ===== Рекорды =====
  function recordTime(night, timeMs){
    const p = getProgress();
    const rec = p.records['night' + night];
    if (!rec) return;
    if (rec.best === null || timeMs < rec.best){
      rec.best = timeMs;
    }
    saveProgress(p);
    return rec.best;
  }

  function getRecord(night){
    const p = getProgress();
    return p.records['night' + night] || { best: null, attempts: 0 };
  }

  // ===== Кастомная ночь =====
  function getCustomAI(){
    const p = getProgress();
    return { ...p.customAI };
  }

  function setCustomAI(ai){
    const p = getProgress();
    p.customAI = { ...p.customAI, ...ai };
    saveProgress(p);
    return p.customAI;
  }

  function getCustomSum(){
    const ai = getCustomAI();
    return (ai.lion || 0) + (ai.owl || 0) + (ai.wolf || 0) + (ai.rabbit || 0);
  }

  function getCustomDifficulty(){
    const sum = getCustomSum();
    if (sum === 0) return { level: 'Прогулка', stars: 1, emoji: '😴' };
    if (sum <= 20) return { level: 'Разминка', stars: 1, emoji: '😌' };
    if (sum <= 40) return { level: 'Серьёзно', stars: 2, emoji: '😐' };
    if (sum <= 60) return { level: 'Хардкор', stars: 3, emoji: '😨' };
    if (sum <= 79) return { level: 'Кошмар', stars: 4, emoji: '💀' };
    return { level: '20/20/20/20', stars: 5, emoji: '👑' };
  }

  // ===== Настройки =====
  function getSettings(){
    const p = getProgress();
    return { ...p.settings };
  }

  function setSetting(key, value){
    const p = getProgress();
    p.settings[key] = value;
    saveProgress(p);
    return p.settings;
  }

  // ===== Утилиты =====
  function deepClone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeDeep(target, source){
    for (const key in source){
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])){
        if (!target[key]) target[key] = {};
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // ===== Экспорт в window =====
  window.SP = {
    // Прогресс
    get: getProgress,
    save: saveProgress,
    reset: resetProgress,

    // Ночи
    completeNight,
    isNightCompleted,
    isNightUnlocked,
    isNightSecret,
    getCurrentNight,
    setCurrentNight,

    // Кастомная
    isCustomUnlocked,
    unlockCustom,
    getCustomAI,
    setCustomAI,
    getCustomSum,
    getCustomDifficulty,

    // Звёзды
    addStars,
    getStars,
    setStars,

    // Рекорды
    recordTime,
    getRecord,

    // Настройки
    getSettings,
    setSetting,

    // Утилиты
    STORAGE_KEY,
  };

  console.log('%c📊 progress.js загружен','color:#4ade80;font-weight:bold;');
  console.log('%cТекущий прогресс:', 'color:#38bdf8;', getProgress());
})();