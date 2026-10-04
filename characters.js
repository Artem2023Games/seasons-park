/* ============================================================
   Seasons Park — Night Shift
   © 2026 Artem2023. Все права защищены.
   Копирование и распространение без разрешения запрещены.
   ============================================================ */
// ============================================================
// SEASONS PARK — characters.js
// Аниматроники: ИИ, маршруты, атаки, джампскейры
// + Главная сцена: все стартуют там
// ============================================================

(function(){
  const CONFIG = {
    MIN_STEP_TIME: 2,
    MAX_STEP_TIME: 20,
    ATTACK_DELAY: 3,
    RETREAT_TIME: 5,
    // Сколько стоят на сцене перед началом (в секундах) — зависит от ночи
    STAGE_TIME: {
      1: 30,
      2: 25,
      3: 20,
      4: 15,
      5: 8,
      6: 5,
    },
    // Интервал между уходом со сцены (по одному)
    STAGE_INTERVAL: 4,
  };

  // ===== Аниматроники =====
  const ANIMATRONICS = {
    lion: {
      id: 'lion',
      name: 'Солнечный Лев',
      emoji: '🦁',
      color: '#fbbf24',
      type: 'door',
      door: 'left',
      route: ['main-stage', 'carousel', 'fountain', 'alley', 'door-left'],
      sound: 'roar',
    },
    owl: {
      id: 'owl',
      name: 'Мудрая Сова',
      emoji: '🦉',
      color: '#f97316',
      type: 'ceiling',
      door: null,
      route: ['main-stage', 'tree', 'roof', 'hall-ceiling'],
      sound: 'hoot',
    },
    wolf: {
      id: 'wolf',
      name: 'Ледяной Волк',
      emoji: '🐺',
      color: '#38bdf8',
      type: 'door',
      door: 'right',
      route: ['main-stage', 'slide', 'rink', 'tunnel', 'door-right'],
      sound: 'howl',
      freezes: true,
    },
    rabbit: {
      id: 'rabbit',
      name: 'Шаловливый Заяц',
      emoji: '🐰',
      color: '#f472b6',
      type: 'random',
      door: null,
      route: ['main-stage', 'flowerbed', 'maze', 'alley', 'random-door'],
      sound: 'giggle',
    },
  };

  // ===== Web Audio =====
  let audioCtx = null;

  function initAudio(){
    if (audioCtx) return;
    try{
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }catch(e){}
  }

  function playTone(freq, duration, type = 'sine', vol = 0.1){
    if (!audioCtx) return;
    try{
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    }catch(e){}
  }

  const SOUNDS = {
    roar:    () => { playTone(120, 0.5, 'sawtooth', 0.15); setTimeout(() => playTone(80, 0.3, 'sawtooth', 0.1), 200); },
    hoot:    () => { playTone(400, 0.2, 'sine', 0.1); setTimeout(() => playTone(350, 0.3, 'sine', 0.08), 250); },
    howl:    () => { playTone(600, 0.6, 'sine', 0.08); setTimeout(() => playTone(800, 0.4, 'sine', 0.06), 300); },
    giggle:  () => { playTone(1200, 0.1, 'square', 0.06); setTimeout(() => playTone(1400, 0.1, 'square', 0.06), 100); setTimeout(() => playTone(1100, 0.15, 'square', 0.06), 200); },
    step:    () => { playTone(80, 0.08, 'triangle', 0.05); },
    doorKnock: () => { playTone(150, 0.15, 'square', 0.1); },
    scream:  () => {
      playTone(800, 0.15, 'sawtooth', 0.2);
      setTimeout(() => playTone(600, 0.15, 'sawtooth', 0.2), 100);
      setTimeout(() => playTone(400, 0.3, 'sawtooth', 0.2), 200);
      setTimeout(() => playTone(200, 0.5, 'sawtooth', 0.15), 400);
    },
    stageExit: () => { playTone(300, 0.2, 'triangle', 0.08); setTimeout(() => playTone(200, 0.3, 'triangle', 0.06), 150); },
  };

  // ===== Класс аниматроника =====
  class Animatronic {
    constructor(config){
      this.id = config.id;
      this.name = config.name;
      this.emoji = config.emoji;
      this.color = config.color;
      this.type = config.type;
      this.door = config.door;
      this.route = config.route;
      this.routeIndex = 0;
      this.aggression = 0;
      this.state = 'idle';
      this.timer = 0;
      this.attackTimer = 0;
      this.retreatTimer = 0;
      this.active = false;
      this.frozen = false;
      this.frozenTimer = 0;
      this.sound = config.sound;
      this.freezes = config.freezes || false;
      // Сцена
      this.onStage = true;
      this.stageTimer = 0;
      this.stageExitTimer = 0;
    }

    get position(){
      return this.route[this.routeIndex];
    }

    get nextPosition(){
      return this.route[(this.routeIndex + 1) % this.route.length];
    }

    get stepTime(){
      if (this.aggression <= 0) return Infinity;
      const t = (20 - this.aggression) / 19;
      return CONFIG.MIN_STEP_TIME + t * (CONFIG.MAX_STEP_TIME - CONFIG.MIN_STEP_TIME);
    }

    setAggression(value){
      this.aggression = Math.max(0, Math.min(20, value || 0));
      this.active = this.aggression > 0;
    }

    // Сколько стоять на сцене (зависит от ночи)
    getStageTime(night){
      return CONFIG.STAGE_TIME[night] || 20;
    }

    // Начать уход со сцены
    startStageExit(night){
      if (!this.onStage) return;
      this.stageExitTimer = this.getStageTime(night) + (Math.random() * CONFIG.STAGE_INTERVAL);
    }

    update(dt, context){
      if (!this.active) return;
      if (this.frozen){
        this.frozenTimer -= dt;
        if (this.frozenTimer <= 0) this.frozen = false;
        return;
      }

      // Логика сцены
      if (this.onStage){
        this.stageExitTimer -= dt;
        if (this.stageExitTimer <= 0){
          this.onStage = false;
          this.routeIndex = 1; // переходим на следующую точку
          this.state = 'moving';
          this.timer = this.stepTime;
          context.onStageExit?.(this);
        }
        return;
      }

      switch(this.state){
        case 'idle':
        case 'moving':
          this.updateMoving(dt, context);
          break;
        case 'at-door':
          this.updateAtDoor(dt, context);
          break;
        case 'retreating':
          this.updateRetreating(dt);
          break;
      }
    }

    updateMoving(dt, context){
      this.timer -= dt;
      if (this.timer <= 0){
        if (Math.random() * 20 < this.aggression){
          this.routeIndex = (this.routeIndex + 1) % this.route.length;
          const pos = this.position;
          if (pos === 'door-left' || pos === 'door-right' || pos === 'hall-ceiling' || pos === 'random-door'){
            this.state = 'at-door';
            this.attackTimer = CONFIG.ATTACK_DELAY;
            if (this.type === 'random' && pos === 'random-door'){
              this.door = Math.random() < 0.5 ? 'left' : 'right';
            }
            context.onDoorKnock?.(this);
          } else {
            context.onStep?.(this);
          }
        }
        this.timer = this.stepTime * (0.7 + Math.random() * 0.6);
      }
    }

    updateAtDoor(dt, context){
      this.attackTimer -= dt;
      if (this.attackTimer <= 0){
        const canAttack = context.checkAttack ? context.checkAttack(this) : false;
        if (canAttack){
          this.state = 'attacking';
          context.onAttack?.(this);
        } else {
          this.state = 'retreating';
          this.retreatTimer = CONFIG.RETREAT_TIME;
          context.onRetreat?.(this);
        }
      }
    }

    updateRetreating(dt){
      this.retreatTimer -= dt;
      if (this.retreatTimer <= 0){
        this.routeIndex = 0;
        this.state = 'moving';
        this.timer = this.stepTime;
        this.door = ANIMATRONICS[this.id].door;
      }
    }

    reset(){
      this.routeIndex = 0;
      this.state = 'idle';
      this.timer = this.stepTime;
      this.attackTimer = 0;
      this.retreatTimer = 0;
      this.frozen = false;
      this.frozenTimer = 0;
      this.door = ANIMATRONICS[this.id].door;
      this.onStage = true;
      this.stageExitTimer = 0;
    }

    serialize(){
      return {
        id: this.id,
        routeIndex: this.routeIndex,
        state: this.state,
        aggression: this.aggression,
        active: this.active,
        door: this.door,
        onStage: this.onStage,
      };
    }
  }

  // ===== Менеджер =====
  const Manager = {
    list: [],
    night: 1,
    running: false,
    lastUpdate: Date.now(),
    jumpScare: null,
    onGameOver: null,
    stageStarted: false,
    stageStartTime: 0,

    init(night, customAI = null){
      this.night = night;
      this.list = [];
      this.stageStarted = false;

      let ai = { lion: 0, owl: 0, wolf: 0, rabbit: 0 };

      if (customAI){
        ai = { ...customAI };
      } else {
        switch(night){
          case 1: ai = { lion: 5,  owl: 0,  wolf: 0,  rabbit: 0 };  break;
          case 2: ai = { lion: 8,  owl: 6,  wolf: 0,  rabbit: 0 };  break;
          case 3: ai = { lion: 10, owl: 8,  wolf: 8,  rabbit: 0 };  break;
          case 4: ai = { lion: 12, owl: 10, wolf: 10, rabbit: 8 };  break;
          case 5: ai = { lion: 15, owl: 15, wolf: 15, rabbit: 15 }; break;
          case 6: ai = { lion: 20, owl: 18, wolf: 20, rabbit: 18 }; break;
        }
      }

      Object.keys(ANIMATRONICS).forEach(id => {
        const a = new Animatronic(ANIMATRONICS[id]);
        a.setAggression(ai[id] || 0);
        a.timer = a.stepTime;
        // Таймер ухода со сцены
        a.stageExitTimer = (CONFIG.STAGE_TIME[night] || 20) + (Math.random() * CONFIG.STAGE_INTERVAL);
        this.list.push(a);
      });

      this.running = true;
      this.lastUpdate = Date.now();
      this.stageStartTime = Date.now();
      console.log('🎭 Аниматроники активированы:', ai);
      console.log('🎭 Старт на сцене, время сцены:', CONFIG.STAGE_TIME[night] || 20, 'сек');
    },

    update(dt, hour){
      if (!this.running) return;

      const hourBonus = hour / 6;

      const context = {
        onStep: (a) => {
          SOUNDS.step();
        },
        onDoorKnock: (a) => {
          SOUNDS.doorKnock();
        },
        onAttack: (a) => {
          this.triggerAttack(a);
        },
        onRetreat: (a) => {},
        onStageExit: (a) => {
          SOUNDS.stageExit();
          console.log(`🎭 ${a.name} ушёл со сцены`);
        },
        checkAttack: (a) => {
          return window.SP_GAME ? window.SP_GAME.canAnimatronicAttack(a) : false;
        },
      };

      this.list.forEach(a => {
        if (!a.active) return;

        const currentAggression = a.aggression * (0.5 + hourBonus);
        const savedAggression = a.aggression;
        a.aggression = Math.min(20, currentAggression);

        a.update(dt, context);

        a.aggression = savedAggression;
      });
    },

    triggerAttack(a){
      this.running = false;
      this.jumpScare = { animatronic: a, time: Date.now() };
      SOUNDS.scream();
      if (this.onGameOver) this.onGameOver(a);
    },

    getPositions(){
      const result = {};
      this.list.forEach(a => {
        if (!a.active) return;
        result[a.id] = {
          position: a.position,
          state: a.state,
          door: a.door,
          emoji: a.emoji,
          color: a.color,
          onStage: a.onStage,
        };
      });
      return result;
    },

    // Кто на конкретной камере
    getAtCamera(camId){
      // На главной сцене — все, кто ещё onStage
      if (camId === 'main-stage'){
        return this.list.filter(a => a.active && a.onStage);
      }
      return this.list.filter(a => a.active && !a.onStage && a.position === camId);
    },

    // Кто на сцене
    getOnStage(){
      return this.list.filter(a => a.active && a.onStage);
    },

    // Кто ушёл со сцены
    getOffStage(){
      return this.list.filter(a => a.active && !a.onStage);
    },

    getAtDoor(side){
      return this.list.filter(a => a.active && a.state === 'at-door' && a.door === side);
    },

    reset(night, customAI){
      this.running = false;
      this.jumpScare = null;
      this.init(night, customAI);
    },
  };

  window.SP_CHARS = {
    Manager,
    Animatronic,
    ANIMATRONICS,
    SOUNDS,
    CONFIG,
    initAudio,
  };

  console.log('%c🎭 characters.js загружен','color:#a78bfa;font-weight:bold;');
  console.log('%cСцена добавлена: main-stage','color:#fbbf24;');
})();