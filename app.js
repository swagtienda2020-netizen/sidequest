/* ==========================================================================
   SIDEQUEST - LÓGICA DE NEGOCIO Y RPG ENGINE (JUEGO DE LA VIDA REAL)
   ========================================================================== */

// --- CONFIGURACIÓN E INICIALIZACIÓN GENERAL ---
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// --- SISTEMA DE SONIDOS SINTÉTICOS (Web Audio API) ---
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('sidequest_sound') !== 'false';
    this.updateSoundBtnUI();
  }

  initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('sidequest_sound', this.enabled);
    this.updateSoundBtnUI();
    if (this.enabled) {
      this.initContext();
      this.playClick();
    }
  }

  updateSoundBtnUI() {
    const btn = document.getElementById('sound-icon');
    if (btn) {
      btn.textContent = this.enabled ? '🔊' : '🔇';
    }
  }

  playTone(freq, type, duration, gainStart, delay = 0) {
    if (!this.enabled) return;
    this.initContext();

    setTimeout(() => {
      try {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, this.ctx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        console.error('Audio play error:', e);
      }
    }, delay * 1000);
  }

  playClick() {
    // Tono rápido sutil
    this.playTone(800, 'sine', 0.08, 0.05);
  }

  playSuccess() {
    // Chime ascendente alegre (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'sine', 0.15, 0.08, idx * 0.08);
    });
  }

  playUnlock() {
    // Fanfarria de logro (G4, C5, E5, G5, E5, G5)
    const notes = [392.00, 523.25, 659.25, 783.99, 659.25, 987.77];
    const delays = [0, 0.1, 0.2, 0.3, 0.45, 0.6];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.3, 0.1, delays[idx]);
    });
  }

  playLevelUp() {
    // Arpegio veloz y fanfarria triunfal de nivel (C4, E4, G4, C5, E5, G5, C6 de fondo)
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'sine', 0.4, 0.06, idx * 0.06);
    });
    // Tono de soporte profundo
    this.playTone(523.25, 'triangle', 0.8, 0.1, 0.3);
    this.playTone(1046.50, 'sine', 1.0, 0.08, 0.45);
  }
}

// Instancia global
const Sound = new SoundManager();

// --- SISTEMA DE PARTÍCULAS / CONFETTI ---
class ConfettiManager {
  constructor() {
    this.canvas = document.getElementById('confetti-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.active = false;
    
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    this.particles = [];
    this.active = true;
    this.resizeCanvas();

    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#ec4899'];
    
    // Generar 100 partículas en la parte inferior o centro
    for (let i = 0; i < 80; i++) {
      this.particles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 100,
        y: window.innerHeight * 0.7,
        vx: (Math.random() - 0.5) * 15,
        vy: -Math.random() * 15 - 5,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    this.loop();
  }

  loop() {
    if (!this.active) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let livingParticles = false;

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4; // Gravedad
      p.vx *= 0.98; // Resistencia
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.015;

      if (p.opacity > 0) {
        livingParticles = true;
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.globalAlpha = p.opacity;
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        this.ctx.restore();
      }
    });

    if (livingParticles) {
      requestAnimationFrame(() => this.loop());
    } else {
      this.active = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

// --- CLASE BASE DE DATOS Y PERSISTENCIA DE ARCHIVOS ---
const Database = {
  getQuests() {
    const data = localStorage.getItem('sidequest_quests');
    return data ? JSON.parse(data) : [];
  },

  saveQuests(quests) {
    localStorage.setItem('sidequest_quests', JSON.stringify(quests));
  },

  getCharacter() {
    const defaultChar = {
      level: 1,
      currentXP: 0,
      totalXP: 0,
      streak: 0,
      lastCompletedDate: null,
      attributes: {
        Curiosidad: 0,
        Carisma: 0,
        Disciplina: 0,
        Valentía: 0,
        Creatividad: 0,
        Perspectiva: 0,
        Sabiduría: 0,
        Resistencia: 0,
        Espontaneidad: 0,
        Empatía: 0
      }
    };
    const data = localStorage.getItem('sidequest_character');
    return data ? JSON.parse(data) : defaultChar;
  },

  saveCharacter(char) {
    localStorage.setItem('sidequest_character', JSON.stringify(char));
  },

  getAchievements() {
    const data = localStorage.getItem('sidequest_achievements');
    return data ? JSON.parse(data) : [];
  },

  saveAchievements(ach) {
    localStorage.setItem('sidequest_achievements', JSON.stringify(ach));
  },

  resetAll() {
    localStorage.removeItem('sidequest_quests');
    localStorage.removeItem('sidequest_character');
    localStorage.removeItem('sidequest_achievements');
    this.seedDefaultData();
  },

  seedDefaultData() {
    const initialQuests = [
      // CATEGORÍA I: EXPLORACIÓN URBANA
      {
        id: 'q1',
        name: 'Menú en Enigma',
        desc: 'Ve a comer a un restaurante de comida extranjera (asiática, árabe, etíope, etc.) donde no entiendas absolutamente nada del menú y pide un plato al azar sin preguntar qué es.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Sabiduría', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Sabiduría Culinaria | Desbloquea: Paladar Aventurero'
      },
      {
        id: 'q2',
        name: 'La Última Frontera',
        desc: 'Súbete al metro o colectivo, viaja hasta la última estación de la línea y dedica al menos 45 minutos a explorar los alrededores antes de regresar.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Curiosidad', 'Resistencia'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Orientación | Logro: Cartógrafo de la Ciudad'
      },
      {
        id: 'q3',
        name: 'El Caminante Desviado',
        desc: 'Sal de tu casa y camina 10 cuadras seguidas en una dirección que jamás elijas para tus rutas cotidianas. Hazlo sin mirar Google Maps.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Curiosidad', 'Espontaneidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+5 de Curiosidad | Descubrimiento de un callejón o rincón oculto'
      },
      {
        id: 'q4',
        name: 'Buscador de Reliquias',
        desc: 'Visita una feria de usados, mercado de pulgas o tienda de antigüedades y compra un objeto que sea total y absolutamente inútil, pero que tenga "mística".',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Carisma', 'Creatividad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Carisma Estético | Un nuevo iniciador de conversación para tu habitación'
      },
      {
        id: 'q5',
        name: 'Turista de las Sombras',
        desc: 'Visita el cementerio principal de tu ciudad en silencio. Camina sin prisa, lee las lápidas más antiguas e intenta imaginar cómo fueron las vidas de esas personas hace un siglo.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Perspectiva', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Perspectiva Existencial | Respeto por el pasado'
      },
      {
        id: 'q6',
        name: 'El Arte del Aburrimiento',
        desc: 'Ve a un museo de arte. Elige el cuadro que a primera vista te parezca más aburrido o incomprensible y quédate parado frente a él mirándolo fijamente durante 10 minutos cronometrados.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Disciplina', 'Perspectiva'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Paciencia | Habilidad: Atención Plena'
      },
      {
        id: 'q7',
        name: 'Cazador de Portadas',
        desc: 'Entra a una librería independiente. Compra un libro guiándote única y exclusivamente por el diseño de su portada. No leas la sinopsis ni busques opiniones en internet.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Perspectiva', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Intuición | Una lectura inesperada'
      },
      {
        id: 'q8',
        name: 'Ruta de Escape',
        desc: 'Súbete a un transporte público al azar. Mira por la ventana y bájate en el primer lugar cuyo paisaje o arquitectura capte tu atención por completo. Camina por ahí.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Espontaneidad', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Espontaneidad | Romper el bucle del algoritmo diario'
      },
      // CATEGORÍA II: DESARROLLO DE PERSONAJE
      {
        id: 'q9',
        name: 'El Nudo del Destino',
        desc: 'Aprende a hacer un nudo de corbata clásico y elegante (como el Windsor o el Pratt) a la perfección, incluso si no tienes planeado usar corbata en los próximos meses.',
        category: 'Desarrollo de Personaje',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Disciplina', 'Creatividad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Destreza | Logro: Caballero Improvisado'
      },
      {
        id: 'q10',
        name: 'El Alquimista Culinario',
        desc: 'Cocina un plato complejo desde cero que requiera más de 3 horas de preparación activa o pasiva (un estofado lento, pan de masa madre, ramen casero, etc.).',
        category: 'Desarrollo de Personaje',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Disciplina', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Disciplina | Habilidad: Soporte de Supervivencia'
      },
      {
        id: 'q11',
        name: 'Giro de Guion',
        desc: 'Lee un libro completo de un género literario que siempre hayas afirmado que detestas o que te parece aburrido (autoayuda, poesía, ciencia ficción dura, romance, etc.).',
        category: 'Desarrollo de Personaje',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Empatía', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+30 de Empatía Mental | Derribo de prejuicios'
      },
      {
        id: 'q12',
        name: 'Desintoxicación del Servidor',
        desc: 'Ejecuta un "ayuno de dopamina": pasa 12 horas seguidas despierto sin mirar una sola pantalla (celular, computadora, televisión, reloj inteligente).',
        category: 'Desarrollo de Personaje',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Disciplina', 'Perspectiva'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+40 de Paz Mental | Reinicio de receptores cerebrales'
      },
      {
        id: 'q13',
        name: 'El Arte de la Improvisación',
        desc: 'Inscríbete y asiste a una clase única de prueba de algo que te dé profunda vergüenza o timidez (teatro, improvisación, canto, baile o cerámica).',
        category: 'Desarrollo de Personaje',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Valentía', 'Carisma'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+50 de Confianza | Habilidad pasiva: Inmunidad al Ridículo'
      },
      {
        id: 'q14',
        name: 'Cine para Uno',
        desc: 'Ve al cine completamente solo. Compra tu entrada para una función en un horario poco concurrido y siéntate exactamente en la butaca del centro de la sala, como si fueras el dueño del lugar.',
        category: 'Desarrollo de Personaje',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Disciplina', 'Perspectiva'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Autonomía | Disfrute de la propia compañía'
      },
      {
        id: 'q15',
        name: 'Cazador de Luz',
        desc: 'Despiértate antes del amanecer, ve a un punto elevado de tu ciudad y mira la salida del sol completa, asegurándote de no haber pasado la noche anterior de fiesta (debes estar descansado).',
        category: 'Desarrollo de Personaje',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Resistencia', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Energía Vital | Sintonía con los ritmos naturales'
      },
      {
        id: 'q16',
        name: 'Silbido de Convocatoria',
        desc: 'Practica hasta aprender a silbar fuertemente utilizando los dedos de la mano. No puedes rendirte hasta que logres un sonido nítido y potente.',
        category: 'Desarrollo de Personaje',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Disciplina', 'Resistencia'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Coordinación | Un recurso acústico para emergencias'
      },
      // CATEGORÍA III: INTERACCIONES CON NPCs
      {
        id: 'q17',
        name: 'La Pregunta del Oráculo',
        desc: 'Mientras esperas en la parada del colectivo, metro o en una fila, hazle una pregunta existencial o inusual a un desconocido de forma natural (ej: "¿Qué es lo más raro que te pasó esta semana?" o "Si pudieras detener el tiempo, ¿qué harías primero?").',
        category: 'Interacciones con NPCs',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Carisma', 'Valentía'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+35 de Carisma | Desbloquea diálogos inusuales en la ciudad'
      },
      {
        id: 'q18',
        name: 'El Escudo Social',
        desc: 'Di "No" a un compromiso social al que realmente no quieras ir, de forma firme y educada, sin inventar una sola excusa, mentira piadosa o justificación.',
        category: 'Interacciones con NPCs',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Valentía', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Asertividad | Habilidad: Protección de Energía'
      },
      {
        id: 'q19',
        name: 'Aliado de los Olvidados',
        desc: 'Compra una ración de comida para perro de buena calidad, dásela a un perro de la calle y quédate a su lado haciéndole compañía en silencio mientras come.',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Empatía', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Karma | Alianza con la facción animalera'
      },
      {
        id: 'q20',
        name: 'Infiltrado de Élite',
        desc: 'Vístete bien, entra a una inmobiliaria de lujo y pregunta con total naturalidad por las características e información de una mansión o departamento costoso que sabes que no puedes pagar.',
        category: 'Interacciones con NPCs',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Valentía', 'Carisma'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+30 de Audacia | Logro: El Gran Simulador'
      },
      {
        id: 'q21',
        name: 'El Camino del Samurái Urbano',
        desc: 'Realiza un acto de bondad completamente anónimo durante el día (dejar pagado el café de la siguiente persona en la fila, dejar un libro genial con una nota en un banco de plaza, etc.).',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Empatía', 'Espontaneidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Karma | Sintonía con el universo'
      },
      {
        id: 'q22',
        name: 'Viento de Cambio',
        desc: 'Escríbele a un viejo amigo de la infancia o adolescencia con el que hayas perdido el contacto por completo. No mandes un simple "hola", cuéntale un recuerdo específico que tengas con él y pregúntale cómo va su vida.',
        category: 'Interacciones con NPCs',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Empatía', 'Carisma'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Conexión | Reactivación de antiguos lazos del clan'
      },
      {
        id: 'q23',
        name: 'Efecto Mariposa',
        desc: 'Durante una sola tarde, hazle 3 cumplidos sinceros, específicos y no invasivos a tres completos desconocidos en la calle (ej: "¡Qué buena energía transmite tu campera!" o "Tienes una sonrisa muy contagiosa").',
        category: 'Interacciones con NPCs',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Carisma', 'Empatía'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Confianza Social | Modificador de entorno positivo'
      },
      {
        id: 'q24',
        name: 'El Banquete del Mentor',
        desc: 'Invita a tus padres, abuelos o a un mentor de vida a una cita a solas (un café, almuerzo o paseo) pagada enteramente por ti, donde tu único rol sea escucharlos contar sus historias del pasado.',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Empatía', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Gratitud | Fortalecimiento del árbol familiar'
      },
      // CATEGORÍA IV: MISTICISMO Y DESCONEXIÓN
      {
        id: 'q25',
        name: 'Cápsula del Tiempo',
        desc: 'Escribe una carta detallada a mano dirigida a tu "yo" de dentro de 5 años. Cuéntale tus miedos actuales, tus victorias y tus dudas. Sella el sobre y escóndelo donde no lo veas a diario.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Perspectiva', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Autoconocimiento | Un regalo de viaje temporal'
      },
      {
        id: 'q26',
        name: 'Melómano Aventurero',
        desc: 'Busca un disco conceptual de una banda o artista que jamás hayas escuchado en tu vida. Apaga las luces, ponte auriculares y escúchalo completo, de principio a fin, sin saltarte ninguna canción y sin hacer otra tarea en paralelo.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Creatividad', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Apreciación Estética | Expansión del inventario musical'
      },
      {
        id: 'q27',
        name: 'La Playlist del Héroe',
        desc: 'Crea una playlist de exactamente 10 canciones que te hagan sentir invencible. Nómbrala "Arco del Protagonista" y escúchala únicamente cuando camines solo por la calle a paso lento.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Disciplina', 'Resistencia'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Motivación | Modificador de velocidad al caminar'
      },
      {
        id: 'q28',
        name: 'Desafío Zen',
        desc: 'Siéntate en silencio durante 15 minutos exactos a meditar, concentrándote solo en tu respiración. Si aparece en tu mente un pensamiento sobre deudas, trabajo o pendientes, debes reiniciar el cronómetro a cero.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Disciplina', 'Perspectiva'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+35 de Control Mental | Habilidad: Mente Fría'
      },
      {
        id: 'q29',
        name: 'Romantizar la Existencia',
        desc: 'Vive un día entero (24 horas) bajo la regla de "romantizar tu vida". Vístete con tu mejor ropa sin que haya un evento especial, camina despacio, pide tu bebida favorita y asume que eres el protagonista de una aclamada película independiente.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Perspectiva', 'Carisma'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+30 de Autoestima | Desbloquea el filtro visual: Cine de Autor'
      },
      {
        id: 'q30',
        name: 'Despertar del Modo Espera',
        desc: 'Comparte esta lista con un amigo o publícala en tus redes sociales. Elige a una persona específica y desafíala a completar al menos tres de estas misiones antes de que termine la semana.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Carisma', 'Valentía'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Liderazgo | Expansión del juego cooperativo en tu círculo'
      }
    ];

    const seededChar = {
      level: 1,
      currentXP: 0,
      totalXP: 0,
      streak: 0,
      lastCompletedDate: null,
      attributes: {
        Curiosidad: 0,
        Carisma: 0,
        Disciplina: 0,
        Valentía: 0,
        Creatividad: 0,
        Perspectiva: 0,
        Sabiduría: 0,
        Resistencia: 0,
        Espontaneidad: 0,
        Empatía: 0
      }
    };

    const initialAchievements = [];

    this.saveQuests(initialQuests);
    this.saveCharacter(seededChar);
    this.saveAchievements(initialAchievements);
  }
};

// Asegurar datos mínimos en primer inicio (usando versión de base de datos del PDF)
if (!localStorage.getItem('sidequest_quests_pdf_v2')) {
  Database.resetAll();
  localStorage.setItem('sidequest_quests_pdf_v2', 'true');
}

// --- CORE APP MODULE ---
const App = {
  quests: [],
  character: {},
  achievements: [],
  confetti: null,

  // Lista estática de logros disponibles
  achievementsList: [
    {
      id: 'achievement_first_step',
      name: 'Primer Paso',
      desc: 'Completa tu primera misión secundaria en el mundo real.',
      icon: '🌱',
      requirement: 'Completa 1 misión'
    },
    {
      id: 'achievement_urban_explorer',
      name: 'Aventurero Urbano',
      desc: 'Completa 5 misiones en la categoría de Exploración Urbana.',
      icon: '🗺️',
      requirement: '5 misiones de Exploración Urbana'
    },
    {
      id: 'achievement_curiosity_master',
      name: 'Maestro de la Curiosidad',
      desc: 'Lleva tu atributo de Curiosidad a Nivel 5 (40+ puntos).',
      icon: '🧠',
      requirement: 'Curiosidad Nivel 5'
    },
    {
      id: 'achievement_hero',
      name: 'Héroe Consagrado',
      desc: 'Completa 10 misiones secundarias en total.',
      icon: '👑',
      requirement: '10 misiones completadas'
    },
    {
      id: 'achievement_level_10',
      name: 'Héroe Nivel 10',
      desc: 'Alcanza el nivel de personaje 10.',
      icon: '🏅',
      requirement: 'Llegar a Nivel 10'
    },
    {
      id: 'achievement_level_25',
      name: 'Héroe Nivel 25',
      desc: 'Alcanza el nivel de personaje 25.',
      icon: '💎',
      requirement: 'Llegar a Nivel 25'
    },
    {
      id: 'achievement_living_legend',
      name: 'Leyenda Viviente',
      desc: 'Completa una misión Legendaria y alcanza el Nivel 15.',
      icon: '🔮',
      requirement: '1 misión Legendaria + Nivel 15'
    }
  ],

  // Frases motivacionales RPG
  quotes: [
    "\"El primer paso de cualquier misión es el más heroico.\"",
    "\"Incluso los héroes de nivel 99 comenzaron limpiando ratas en los sótanos.\"",
    "\"Tu mapa de aventuras aún tiene niebla de guerra. ¡Sal a explorar!\"",
    "\"Has descansado en una posada. Tu energía y motivación se han restablecido.\"",
    "\"¿Sientes cansancio? Es la barra de estamina regenerándose. Continúa lento pero constante.\"",
    "\"Un verdadero aventurero no le teme a su bitácora de pendientes.\"",
    "\"Las misiones más duras otorgan los mejores botines de atributos.\"",
    "\"Cada acción en el mundo físico es un golpe crítico a la procrastinación.\"",
    "\"Tus atributos crecen con constancia, no con perfección.\"",
    "\"La curiosidad es el camino que abre mapas inexplorados en tu vida.\""
  ],

  init() {
    this.confetti = new ConfettiManager();
    this.loadData();
    this.setupListeners();
    this.registerPWAInstallEvent();
    
    // Configurar e iniciar UI
    this.switchTab('dashboard');
    this.renderAll();
  },

  loadData() {
    this.quests = Database.getQuests();
    this.character = Database.getCharacter();
    this.achievements = Database.getAchievements();
  },

  saveAll() {
    Database.saveQuests(this.quests);
    Database.saveCharacter(this.character);
    Database.saveAchievements(this.achievements);
  },

  setupListeners() {
    // Sonido toggle
    document.getElementById('sound-toggle-btn').addEventListener('click', () => {
      Sound.toggle();
    });

    // Navegación (Bottom Nav)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        Sound.playClick();
        const tab = e.currentTarget.getAttribute('data-tab');
        
        // Quitar activos de botones
        navItems.forEach(i => i.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        this.switchTab(tab);
      });
    });

    // Filtros de misiones
    document.getElementById('search-input').addEventListener('input', () => this.renderQuests());
    document.getElementById('filter-category').addEventListener('change', () => { Sound.playClick(); this.renderQuests(); });
    document.getElementById('filter-difficulty').addEventListener('change', () => { Sound.playClick(); this.renderQuests(); });
    document.getElementById('filter-status').addEventListener('change', () => { Sound.playClick(); this.renderQuests(); });
    document.getElementById('filter-sort').addEventListener('change', () => { Sound.playClick(); this.renderQuests(); });

    // Reroll Daily Quest
    document.getElementById('reroll-daily-btn').addEventListener('click', () => {
      Sound.playClick();
      this.suggestDailyQuest(true);
    });

    // Modales: Editor de Misión
    const questModal = document.getElementById('quest-modal');
    document.getElementById('add-quest-btn').addEventListener('click', () => {
      Sound.playClick();
      this.openQuestEditor();
    });
    document.getElementById('close-quest-modal-btn').addEventListener('click', () => {
      Sound.playClick();
      this.closeModal(questModal);
    });
    document.getElementById('cancel-quest-btn').addEventListener('click', () => {
      Sound.playClick();
      this.closeModal(questModal);
    });

    // Formulario de Misión
    document.getElementById('quest-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Sound.playSuccess();
      this.saveQuestFromForm();
    });

    // Cerrar Level Up Modal
    document.getElementById('levelup-close-btn').addEventListener('click', () => {
      Sound.playClick();
      this.closeModal(document.getElementById('levelup-modal'));
    });

    // Configuración: Resetear, importar y exportar
    document.getElementById('export-btn').addEventListener('click', () => {
      Sound.playClick();
      this.exportProgress();
    });
    
    document.getElementById('import-file').addEventListener('change', (e) => {
      this.importProgress(e);
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
      Sound.playTone(200, 'sawtooth', 0.5, 0.15);
      if (confirm('¿ESTÁS SEGURO? Se borrará todo tu historial de misiones, niveles y logros permanentemente del almacenamiento local.')) {
        Database.resetAll();
        this.loadData();
        this.renderAll();
        alert('Animus reiniciado. Tu bitácora de misiones se ha restablecido a los valores por defecto.');
      }
    });
  },

  // Manejar cambio de pestañas de navegación
  switchTab(tabId) {
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => panel.classList.remove('active'));
    
    const activePanel = document.getElementById(`tab-${tabId}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // Acciones especiales al entrar a pestañas específicas
    if (tabId === 'dashboard') {
      this.suggestDailyQuest();
      this.updateMotivationalQuote();
    } else if (tabId === 'stats') {
      this.renderCharts();
    }
  },

  closeModal(modal) {
    modal.classList.remove('active');
  },

  openModal(modal) {
    modal.classList.add('active');
  },

  // --- PROGRESS ENGINE (MÁTEMATICA RPG) ---
  
  getXPForLevel(lvl) {
    // Fórmula de nivel: Math.round(100 * Math.pow(lvl, 1.5))
    return Math.round(100 * Math.pow(lvl, 1.5));
  },

  getXPFromDifficulty(difficulty) {
    switch(difficulty) {
      case 'Bronce': return 10;
      case 'Plata': return 25;
      case 'Oro': return 50;
      case 'Épica': return 100;
      case 'Legendaria': return 250;
      default: return 10;
    }
  },

  getAttrPointsFromDifficulty(difficulty) {
    switch(difficulty) {
      case 'Bronce': return 1;
      case 'Plata': return 2;
      case 'Oro': return 4;
      case 'Épica': return 8;
      case 'Legendaria': return 20;
      default: return 1;
    }
  },

  getCharacterTitle(level) {
    if (level < 5) return 'Explorador Novato';
    if (level < 10) return 'Aventurero del Gremio';
    if (level < 15) return 'Cazador Urbano';
    if (level < 20) return 'Caballero de la Sabiduría';
    if (level < 25) return 'Héroe del Animus';
    return 'Leyenda Inmortal';
  },

  getCharacterAvatarEmoji(level) {
    if (level < 5) return '🎒';
    if (level < 10) return '🛡️';
    if (level < 15) return '⚔️';
    if (level < 20) return '🔮';
    if (level < 25) return '👑';
    return '🐉';
  },

  // --- MANEJO DE MISIONES ---

  openQuestEditor(questId = null) {
    const modal = document.getElementById('quest-modal');
    const form = document.getElementById('quest-form');
    const modalTitle = document.getElementById('modal-title');
    
    form.reset();
    document.getElementById('quest-id-input').value = '';
    
    // Desmarcar todos los checkboxes de atributos
    const checkboxes = document.querySelectorAll('input[name="quest-attributes"]');
    checkboxes.forEach(cb => cb.checked = false);

    if (questId) {
      const q = this.quests.find(x => x.id === questId);
      if (q) {
        modalTitle.textContent = 'Editar Misión';
        document.getElementById('quest-id-input').value = q.id;
        document.getElementById('quest-name-input').value = q.name;
        document.getElementById('quest-desc-input').value = q.desc;
        document.getElementById('quest-category-input').value = q.category;
        document.getElementById('quest-difficulty-input').value = q.difficulty;
        document.getElementById('quest-notes-input').value = q.notes || '';
        
        // Cargar atributos marcados
        q.attributes.forEach(attr => {
          const cb = document.querySelector(`input[name="quest-attributes"][value="${attr}"]`);
          if (cb) cb.checked = true;
        });
      }
    } else {
      modalTitle.textContent = 'Crear Nueva Misión';
    }

    this.openModal(modal);
  },

  saveQuestFromForm() {
    const id = document.getElementById('quest-id-input').value;
    const name = document.getElementById('quest-name-input').value;
    const desc = document.getElementById('quest-desc-input').value;
    const category = document.getElementById('quest-category-input').value;
    const difficulty = document.getElementById('quest-difficulty-input').value;
    const notes = document.getElementById('quest-notes-input').value;

    // Obtener atributos seleccionados
    const checkboxes = document.querySelectorAll('input[name="quest-attributes"]:checked');
    const selectedAttributes = Array.from(checkboxes).map(cb => cb.value);

    if (selectedAttributes.length === 0) {
      alert('Debes seleccionar al menos un atributo RPG que esta misión potencie.');
      return;
    }

    const xp = this.getXPFromDifficulty(difficulty);

    if (id) {
      // Editar
      const qIndex = this.quests.findIndex(x => x.id === id);
      if (qIndex !== -1) {
        this.quests[qIndex].name = name;
        this.quests[qIndex].desc = desc;
        this.quests[qIndex].category = category;
        this.quests[qIndex].difficulty = difficulty;
        this.quests[qIndex].xp = xp;
        this.quests[qIndex].attributes = selectedAttributes;
        this.quests[qIndex].notes = notes;
      }
    } else {
      // Crear nueva
      const newQuest = {
        id: 'q_' + Date.now(),
        name,
        desc,
        category,
        difficulty,
        xp,
        attributes: selectedAttributes,
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes
      };
      this.quests.push(newQuest);
    }

    this.saveAll();
    this.closeModal(document.getElementById('quest-modal'));
    this.renderAll();
  },

  duplicateQuest(questId) {
    const q = this.quests.find(x => x.id === questId);
    if (q) {
      const newQuest = {
        ...q,
        id: 'q_' + Date.now(),
        name: `${q.name} (Duplicada)`,
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: ''
      };
      this.quests.push(newQuest);
      this.saveAll();
      this.renderAll();
    }
  },

  deleteQuest(questId) {
    if (confirm('¿Quieres eliminar esta misión de tu bitácora?')) {
      this.quests = this.quests.filter(x => x.id !== questId);
      this.saveAll();
      this.renderAll();
    }
  },

  startQuest(questId) {
    const q = this.quests.find(x => x.id === questId);
    if (q) {
      q.status = 'En progreso';
      this.saveAll();
      this.renderAll();
    }
  },

  archiveQuest(questId) {
    const q = this.quests.find(x => x.id === questId);
    if (q) {
      q.status = 'Archivada';
      this.saveAll();
      this.renderAll();
    }
  },

  restoreQuest(questId) {
    const q = this.quests.find(x => x.id === questId);
    if (q) {
      q.status = 'Disponible';
      this.saveAll();
      this.renderAll();
    }
  },

  completeQuest(questId) {
    const q = this.quests.find(x => x.id === questId);
    if (!q) return;

    // Sonidos y efectos
    Sound.playSuccess();
    this.confetti.start();

    // Actualizar datos de misión
    q.status = 'Completada';
    q.dateFinished = new Date().toISOString();

    // Notas de compleción rápidas si se desea
    const promptNotes = prompt('¡Felicidades por completar la misión! Escribe alguna reflexión, nota o aprendizaje rápido en tu bitácora (opcional):', q.notes || '');
    if (promptNotes !== null) {
      q.notes = promptNotes;
    }

    // Calcular incremento de Racha (Streaks)
    this.updateStreaks();

    // Procesar experiencia ganada
    const xpEarned = q.xp;
    this.awardXP(xpEarned);

    // Otorgar puntos a los atributos involucrados
    const pointsAwarded = this.getAttrPointsFromDifficulty(q.difficulty);
    q.attributes.forEach(attr => {
      if (this.character.attributes[attr] !== undefined) {
        const oldLevel = Math.floor(this.character.attributes[attr] / 10) + 1;
        this.character.attributes[attr] += pointsAwarded;
        const newLevel = Math.floor(this.character.attributes[attr] / 10) + 1;

        // Disparar flash visual si sube nivel de atributo
        if (newLevel > oldLevel) {
          setTimeout(() => {
            const attrCard = document.querySelector(`[data-attr="${attr}"]`);
            if (attrCard) {
              attrCard.classList.add('level-up-flash');
              setTimeout(() => attrCard.classList.remove('level-up-flash'), 1200);
            }
          }, 600);
        }
      }
    });

    this.saveAll();
    this.checkAchievements();
    this.renderAll();
  },

  revertQuest(questId) {
    const q = this.quests.find(x => x.id === questId);
    if (!q || q.status !== 'Completada') return;

    if (confirm(`¿Quieres desmarcar esta misión? Se restarán ${q.xp} XP y los puntos de atributos obtenidos.`)) {
      q.status = 'Disponible';
      q.dateFinished = null;
      q.notes = '';

      // Restar XP
      this.character.currentXP -= q.xp;
      this.character.totalXP = Math.max(0, this.character.totalXP - q.xp);

      // Si el XP actual es menor que cero, bajar niveles
      while (this.character.currentXP < 0 && this.character.level > 1) {
        this.character.level -= 1;
        const xpNeeded = this.getXPForLevel(this.character.level);
        this.character.currentXP += xpNeeded;
      }
      if (this.character.level === 1 && this.character.currentXP < 0) {
        this.character.currentXP = 0;
      }

      // Restar puntos a atributos
      const pointsToSubtract = this.getAttrPointsFromDifficulty(q.difficulty);
      q.attributes.forEach(attr => {
        if (this.character.attributes[attr] !== undefined) {
          this.character.attributes[attr] = Math.max(0, this.character.attributes[attr] - pointsToSubtract);
        }
      });

      // Recalcular logros obtenidos
      this.recalculateAchievements();

      this.saveAll();
      this.renderAll();
      Sound.playClick();
    }
  },

  recalculateAchievements() {
    const completed = this.quests.filter(q => q.status === 'Completada');
    const newAchievements = [];

    this.achievementsList.forEach(ach => {
      let met = false;
      switch (ach.id) {
        case 'achievement_first_step':
          met = completed.length >= 1;
          break;
        case 'achievement_urban_explorer':
          const urbanQuests = completed.filter(q => q.category === 'Exploración Urbana');
          met = urbanQuests.length >= 5;
          break;
        case 'achievement_curiosity_master':
          const curPoints = this.character.attributes['Curiosidad'] || 0;
          const curLevel = Math.floor(curPoints / 10) + 1;
          met = curLevel >= 5;
          break;
        case 'achievement_hero':
          met = completed.length >= 10;
          break;
        case 'achievement_level_10':
          met = this.character.level >= 10;
          break;
        case 'achievement_level_25':
          met = this.character.level >= 25;
          break;
        case 'achievement_living_legend':
          const completedLegendary = completed.some(q => q.difficulty === 'Legendaria');
          met = completedLegendary && this.character.level >= 15;
          break;
      }
      if (met) {
        newAchievements.push(ach.id);
      }
    });

    this.achievements = newAchievements;
  },

  updateStreaks() {
    const today = new Date().toDateString();
    const lastCompleted = this.character.lastCompletedDate;

    if (!lastCompleted) {
      this.character.streak = 1;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();

      if (lastCompleted === today) {
        // Ya completó una misión hoy, la racha se mantiene igual
      } else if (lastCompleted === yesterdayStr) {
        // Racha consecutiva
        this.character.streak += 1;
      } else {
        // Se rompió la racha anterior
        this.character.streak = 1;
      }
    }
    this.character.lastCompletedDate = today;
  },

  awardXP(amount) {
    this.character.currentXP += amount;
    this.character.totalXP += amount;

    let xpNeeded = this.getXPForLevel(this.character.level);
    let leveledUp = false;
    const oldLevel = this.character.level;

    while (this.character.currentXP >= xpNeeded) {
      this.character.currentXP -= xpNeeded;
      this.character.level += 1;
      xpNeeded = this.getXPForLevel(this.character.level);
      leveledUp = true;
    }

    if (leveledUp) {
      this.triggerLevelUpCelebration(oldLevel, this.character.level);
    }
  },

  triggerLevelUpCelebration(oldLvl, newLvl) {
    setTimeout(() => {
      Sound.playLevelUp();
      this.confetti.start();

      document.getElementById('levelup-old-level-val').textContent = oldLvl;
      document.getElementById('levelup-new-level-val').textContent = newLvl;
      
      const rank = this.getCharacterTitle(newLvl);
      document.getElementById('levelup-rank-val').textContent = rank;

      // Actualizar visual de avatar
      const emoji = this.getCharacterAvatarEmoji(newLvl);
      const avatarDiv = document.getElementById('character-avatar-img');
      if (avatarDiv) avatarDiv.textContent = emoji;

      this.openModal(document.getElementById('levelup-modal'));
    }, 800);
  },

  // --- LOGROS AUTO CHECKER ---

  checkAchievements() {
    let newlyUnlocked = [];

    this.achievementsList.forEach(ach => {
      if (this.achievements.includes(ach.id)) return; // Ya desbloqueado

      let isConditionMet = false;

      // Calcular número de misiones completadas
      const completed = this.quests.filter(q => q.status === 'Completada');

      switch (ach.id) {
        case 'achievement_first_step':
          isConditionMet = completed.length >= 1;
          break;
        case 'achievement_urban_explorer':
          const urbanQuests = completed.filter(q => q.category === 'Exploración Urbana');
          isConditionMet = urbanQuests.length >= 5;
          break;
        case 'achievement_curiosity_master':
          const curPoints = this.character.attributes['Curiosidad'] || 0;
          const curLevel = Math.floor(curPoints / 10) + 1;
          isConditionMet = curLevel >= 5;
          break;
        case 'achievement_hero':
          isConditionMet = completed.length >= 10;
          break;
        case 'achievement_level_10':
          isConditionMet = this.character.level >= 10;
          break;
        case 'achievement_level_25':
          isConditionMet = this.character.level >= 25;
          break;
        case 'achievement_living_legend':
          const completedLegendary = completed.some(q => q.difficulty === 'Legendaria');
          isConditionMet = completedLegendary && this.character.level >= 15;
          break;
      }

      if (isConditionMet) {
        this.achievements.push(ach.id);
        newlyUnlocked.push(ach);
      }
    });

    if (newlyUnlocked.length > 0) {
      this.saveAll();
      // Mostrar toast secuencialmente
      newlyUnlocked.forEach((ach, index) => {
        setTimeout(() => {
          this.showAchievementToast(ach);
        }, index * 4000);
      });
    }
  },

  showAchievementToast(achievement) {
    Sound.playUnlock();
    const toast = document.getElementById('achievement-toast');
    document.getElementById('toast-achievement-name').textContent = achievement.name;

    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 3500);
  },

  // --- RENDERIZADO DE INTERFAZ (UI RENDERING) ---

  renderAll() {
    this.renderHeader();
    this.renderDashboard();
    this.renderQuests();
    this.renderAttributes();
    this.renderAchievements();
  },

  renderHeader() {
    document.getElementById('streak-count').textContent = this.character.streak || 0;
    document.getElementById('header-level').textContent = this.character.level;
    
    // XP progress in header
    const xpNeeded = this.getXPForLevel(this.character.level);
    const xpPercent = Math.min(100, (this.character.currentXP / xpNeeded) * 100);
    document.getElementById('header-xp-bar').style.width = `${xpPercent}%`;
  },

  updateMotivationalQuote() {
    const idx = Math.floor(Math.random() * this.quotes.length);
    document.getElementById('motivational-quote').textContent = this.quotes[idx];
  },

  renderDashboard() {
    // Hoja del Personaje
    document.getElementById('char-level').textContent = this.character.level;
    document.getElementById('char-xp-current').textContent = this.character.currentXP;
    
    const xpNeeded = this.getXPForLevel(this.character.level);
    document.getElementById('char-xp-next').textContent = xpNeeded;
    document.getElementById('char-xp-diff').textContent = Math.max(0, xpNeeded - this.character.currentXP);
    
    const xpPercent = Math.min(100, (this.character.currentXP / xpNeeded) * 100);
    document.getElementById('char-xp-fill').style.width = `${xpPercent}%`;
    
    const rank = this.getCharacterTitle(this.character.level);
    document.getElementById('character-rank').textContent = rank;

    const emoji = this.getCharacterAvatarEmoji(this.character.level);
    document.getElementById('character-avatar-img').textContent = emoji;

    // Panel Resumen de Estadísticas
    const completed = this.quests.filter(q => q.status === 'Completada').length;
    const active = this.quests.filter(q => q.status === 'Disponible' || q.status === 'En progreso').length;
    const achs = this.achievements.length;
    
    document.getElementById('stat-completed-quests').textContent = completed;
    document.getElementById('stat-active-quests').textContent = active;
    document.getElementById('stat-unlocked-achievements').textContent = achs;
    document.getElementById('stat-total-xp').textContent = this.character.totalXP;
  },

  suggestDailyQuest(forceNew = false) {
    const container = document.getElementById('daily-quest-container');
    const available = this.quests.filter(q => q.status === 'Disponible' || q.status === 'En progreso');
    
    if (available.length === 0) {
      container.innerHTML = '<p class="empty-state">No tienes misiones activas en tu bitácora. ¡Crea una nueva aventura en la pestaña de Misiones!</p>';
      return;
    }

    // Usar una clave de racha diaria persistente para congelar la misión sugerida del día, excepto si se fuerza el Reroll
    let chosenId = localStorage.getItem('sidequest_daily_quest_id');
    const savedDay = localStorage.getItem('sidequest_daily_quest_day');
    const today = new Date().toDateString();

    const stillAvailable = chosenId && available.some(q => q.id === chosenId);

    if (forceNew || !stillAvailable || savedDay !== today) {
      const idx = Math.floor(Math.random() * available.length);
      chosenId = available[idx].id;
      localStorage.setItem('sidequest_daily_quest_id', chosenId);
      localStorage.setItem('sidequest_daily_quest_day', today);
    }

    const q = this.quests.find(x => x.id === chosenId);

    if (q) {
      const difficultyClass = 'diff-' + q.difficulty.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const attrBadges = q.attributes.map(a => `<span class="attr-tag">${a}</span>`).join(' ');
      const actionButton = q.status === 'Disponible' 
        ? `<button class="primary-btn btn-complete" onclick="App.startQuest('${q.id}')">Iniciar ⚔️</button>`
        : `<button class="primary-btn btn-complete" onclick="App.completeQuest('${q.id}')">Completar 🏆</button>`;
      
      const rewardHTML = q.rewardText ? `<div class="quest-reward-text" style="margin-bottom: 0.5rem;">🎁 Recompensa: ${q.rewardText}</div>` : '';

      container.innerHTML = `
        <div class="quest-card ${difficultyClass}" style="margin-top: 0.5rem; background: rgba(255,255,255,0.01);">
          <div class="quest-badges">
            <span class="badge badge-difficulty">${q.difficulty}</span>
            <span class="badge badge-category">${q.category}</span>
            <span class="badge badge-xp">+${q.xp} XP</span>
          </div>
          <div class="quest-main-info">
            <h4 class="quest-title">${q.name}</h4>
            <p class="quest-desc">${q.desc}</p>
            ${rewardHTML}
            <div class="quest-affected-attrs">
              ${attrBadges}
            </div>
          </div>
          <div class="quest-actions" style="border: none; padding-top: 0.25rem;">
            ${actionButton}
            <button class="secondary-btn btn-complete" style="background: none; border-color: rgba(255,255,255,0.1); color: var(--text-secondary);" onclick="App.completeQuest('${q.id}')">Completar Directo ✓</button>
          </div>
        </div>
      `;
    }
  },

  renderQuests() {
    const grid = document.getElementById('quests-grid');
    const emptyState = document.getElementById('quests-empty-state');
    
    // Obtener filtros
    const searchVal = document.getElementById('search-input').value.toLowerCase();
    const catVal = document.getElementById('filter-category').value;
    const diffVal = document.getElementById('filter-difficulty').value;
    const statusVal = document.getElementById('filter-status').value;
    const sortVal = document.getElementById('filter-sort').value;

    let filtered = [...this.quests];

    // Búsqueda
    if (searchVal.trim() !== '') {
      filtered = filtered.filter(q => 
        q.name.toLowerCase().includes(searchVal) || 
        q.desc.toLowerCase().includes(searchVal)
      );
    }

    // Categoría
    if (catVal !== 'all') {
      filtered = filtered.filter(q => q.category === catVal);
    }

    // Dificultad
    if (diffVal !== 'all') {
      filtered = filtered.filter(q => q.difficulty === diffVal);
    }

    // Estado
    if (statusVal === 'active') {
      filtered = filtered.filter(q => q.status === 'Disponible' || q.status === 'En progreso');
    } else if (statusVal !== 'all') {
      filtered = filtered.filter(q => q.status === statusVal);
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      if (sortVal === 'newest') {
        return new Date(b.dateCreated) - new Date(a.dateCreated);
      } else if (sortVal === 'oldest') {
        return new Date(a.dateCreated) - new Date(b.dateCreated);
      } else if (sortVal === 'xp-desc') {
        return b.xp - a.xp;
      } else if (sortVal === 'xp-asc') {
        return a.xp - b.xp;
      }
      return 0;
    });

    // Limpiar grid
    grid.innerHTML = '';

    if (filtered.length === 0) {
      grid.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');

    filtered.forEach(q => {
      const difficultyClass = 'diff-' + q.difficulty.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const statusClass = 'status-' + q.status.toLowerCase().replace(' ', '-');
      const attrBadges = q.attributes.map(a => `<span class="attr-tag">${a}</span>`).join(' ');
      
      let dateHTML = '';
      if (q.status === 'Completada' && q.dateFinished) {
        const finishedDate = new Date(q.dateFinished).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        dateHTML = `<span class="quest-date-finished">Finalizada: ${finishedDate}</span>`;
      } else {
        const createdDate = new Date(q.dateCreated).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        dateHTML = `<span class="quest-date-created">Creada: ${createdDate}</span>`;
      }

      // Botón principal de acción según el estado
      let primaryActionHTML = '';
      if (q.status === 'Disponible') {
        primaryActionHTML = `
          <button class="btn-start" onclick="App.startQuest('${q.id}')">Iniciar ⚔️</button>
          <button class="btn-complete" onclick="App.completeQuest('${q.id}')">Completar 🏆</button>
        `;
      } else if (q.status === 'En progreso') {
        primaryActionHTML = `
          <button class="btn-complete" onclick="App.completeQuest('${q.id}')">Completar 🏆</button>
        `;
      } else if (q.status === 'Completada') {
        primaryActionHTML = `
          <button class="btn-start" style="color: var(--text-muted); border-color: rgba(255,255,255,0.05); background: none;" onclick="App.revertQuest('${q.id}')">Desmarcar ↩️</button>
          <button class="btn-start" style="color: var(--text-muted); border-color: rgba(255,255,255,0.05); background: none;" onclick="App.archiveQuest('${q.id}')">Archivar 📁</button>
        `;
      } else if (q.status === 'Archivada') {
        primaryActionHTML = `
          <button class="btn-start" style="color: var(--text-muted); border-color: rgba(255,255,255,0.05); background: none;" onclick="App.restoreQuest('${q.id}')">Desarchivar 📂</button>
        `;
      }

      // Notas personales
      const notesHTML = q.notes ? `<div class="quest-notes-preview">✍️ ${q.notes}</div>` : '';
      const rewardHTML = q.rewardText ? `<div class="quest-reward-text" style="margin-bottom: 0.5rem;">🎁 Recompensa: ${q.rewardText}</div>` : '';

      const card = document.createElement('div');
      card.className = `glass-card quest-card ${difficultyClass} ${statusClass}`;
      card.innerHTML = `
        <div class="quest-badges">
          <span class="badge badge-difficulty">${q.difficulty}</span>
          <span class="badge badge-category">${q.category}</span>
          <span class="badge badge-xp">+${q.xp} XP</span>
          <span class="badge badge-status ${q.status.toLowerCase().replace(' ', '-')}">${q.status}</span>
        </div>

        <div class="quest-main-info">
          <h3 class="quest-title">${q.name}</h3>
          <p class="quest-desc">${q.desc}</p>
          ${rewardHTML}
          <div class="quest-affected-attrs">
            ${attrBadges}
          </div>
        </div>

        ${notesHTML}

        <div class="quest-dates">
          ${dateHTML}
        </div>

        <div class="quest-actions">
          <div class="quest-actions-left">
            ${primaryActionHTML}
          </div>
          <div class="quest-actions-right">
            <button class="btn-card-action" onclick="App.openQuestEditor('${q.id}')" title="Editar">✏️</button>
            <button class="btn-card-action" onclick="App.duplicateQuest('${q.id}')" title="Duplicar">📋</button>
            <button class="btn-card-action btn-delete" onclick="App.deleteQuest('${q.id}')" title="Eliminar">🗑️</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  },

  renderAttributes() {
    const container = document.getElementById('attributes-grid-container');
    container.innerHTML = '';

    const attrIcons = {
      Curiosidad: '🔍',
      Carisma: '🗣️',
      Disciplina: '🛡️',
      Valentía: '⚔️',
      Creatividad: '🎨',
      Perspectiva: '👁️',
      Sabiduría: '📖',
      Resistencia: '🏃',
      Espontaneidad: '🌀',
      Empatía: '❤️'
    };

    const attrDescriptions = {
      Curiosidad: 'Tu deseo de explorar y hacer nuevas preguntas.',
      Carisma: 'Tu influencia social y facilidad de conexión.',
      Disciplina: 'Fuerza de voluntad y control sobre tus hábitos.',
      Valentía: 'Valor para salir de la zona de confort.',
      Creatividad: 'Capacidad de inventiva artística y resolución lateral.',
      Perspectiva: 'Profundidad de visión y análisis de situaciones.',
      Sabiduría: 'Tu conocimiento y lecciones de vida asimiladas.',
      Resistencia: 'Fortaleza física y aguante en tareas exigentes.',
      Espontaneidad: 'Apertura al cambio y decisiones impulsivas sanas.',
      Empatía: 'Sintonía emocional y soporte a otros seres vivos.'
    };

    Object.keys(this.character.attributes).forEach(attrName => {
      const points = this.character.attributes[attrName] || 0;
      
      // Atributo Nivel: Cada 10 puntos = 1 nivel
      const level = Math.floor(points / 10) + 1;
      const progressInLevel = points % 10;
      const progressPercent = progressInLevel * 10; // 0 a 90%
      
      const card = document.createElement('div');
      card.className = 'glass-card attribute-card';
      card.setAttribute('data-attr', attrName);
      card.innerHTML = `
        <div class="attr-icon-box">${attrIcons[attrName] || '💎'}</div>
        <div class="attr-info-box">
          <div class="attr-header">
            <span class="attr-name-lbl">${attrName}</span>
            <span class="attr-level-lbl">NIVEL <span>${level}</span></span>
          </div>
          <div class="attr-bar-outer" title="${points} puntos totales">
            <div class="attr-bar-inner" style="width: ${progressPercent}%;"></div>
          </div>
          <div class="attr-subtext">
            <span>${attrDescriptions[attrName] || ''}</span>
            <span>${progressInLevel}/10 pts</span>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  },

  renderAchievements() {
    const container = document.getElementById('achievements-container');
    container.innerHTML = '';

    this.achievementsList.forEach(ach => {
      const isUnlocked = this.achievements.includes(ach.id);
      const card = document.createElement('div');
      card.className = `glass-card achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
      
      let badgeInfo = '';
      if (isUnlocked) {
        // Encontrar una fecha aproximada de compleción
        badgeInfo = `<span class="achievement-date">Reclamado 🏆</span>`;
      } else {
        badgeInfo = `<span class="achievement-date" style="color: var(--text-muted);">Requisito: ${ach.requirement}</span>`;
      }

      card.innerHTML = `
        <div class="achievement-medal">${ach.icon}</div>
        <div class="achievement-info">
          <h3 class="achievement-name">${ach.name}</h3>
          <p class="achievement-desc">${ach.desc}</p>
          ${badgeInfo}
        </div>
      `;
      container.appendChild(card);
    });
  },

  // --- MOTOR DE GRÁFICOS SVG DINÁMICOS ---

  renderCharts() {
    this.renderXPHistoryChart();
    this.renderCategoryDistributionChart();
    this.renderFavoriteAttributePanel();
  },

  renderXPHistoryChart() {
    const container = document.getElementById('xp-history-chart-container');
    container.innerHTML = '';

    // Agrupar XP ganada en los últimos 6 meses
    const now = new Date();
    const monthsData = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsData.push({
        monthName: d.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
        year: d.getFullYear(),
        monthNum: d.getMonth(),
        xp: 0
      });
    }

    // Calcular XP de misiones completadas por mes
    const completedQuests = this.quests.filter(q => q.status === 'Completada' && q.dateFinished);
    
    completedQuests.forEach(q => {
      const finishDate = new Date(q.dateFinished);
      monthsData.forEach(m => {
        if (finishDate.getMonth() === m.monthNum && finishDate.getFullYear() === m.year) {
          m.xp += q.xp;
        }
      });
    });

    // Encontrar valor máximo para escalar el gráfico
    const maxXP = Math.max(...monthsData.map(m => m.xp), 50); // Mínimo de 50 para la escala visual

    // Crear SVG
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 500 200");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    // Definición de Gradiente para las barras
    const defs = document.createElementNS(svgNS, "defs");
    defs.innerHTML = `
      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6366f1" />
        <stop offset="100%" stop-color="#a855f7" />
      </linearGradient>
    `;
    svg.appendChild(defs);

    // Eje X e Y, líneas de guía
    const gridColor = "rgba(255, 255, 255, 0.05)";
    for (let l = 0; l <= 4; l++) {
      const yVal = 20 + l * 35;
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", "40");
      line.setAttribute("y1", yVal);
      line.setAttribute("x2", "480");
      line.setAttribute("y2", yVal);
      line.setAttribute("stroke", gridColor);
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);
    }

    const barWidth = 40;
    const spacing = 70;
    const startX = 60;

    monthsData.forEach((m, idx) => {
      const x = startX + idx * spacing;
      const barHeight = (m.xp / maxXP) * 140; // Max altura de barra es 140px
      const y = 160 - barHeight;

      // Dibujar barra
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width", barWidth);
      rect.setAttribute("height", Math.max(2, barHeight)); // Mínimo 2px para que se note si es > 0
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", "url(#barGrad)");
      rect.setAttribute("filter", "drop-shadow(0 0 5px rgba(99, 102, 241, 0.3))");
      
      // Animación de llenado SVG
      const anim = document.createElementNS(svgNS, "animate");
      anim.setAttribute("attributeName", "height");
      anim.setAttribute("from", "0");
      anim.setAttribute("to", Math.max(2, barHeight));
      anim.setAttribute("dur", "0.8s");
      anim.setAttribute("fill", "freeze");
      rect.appendChild(anim);

      const animY = document.createElementNS(svgNS, "animate");
      animY.setAttribute("attributeName", "y");
      animY.setAttribute("from", "160");
      animY.setAttribute("to", y);
      animY.setAttribute("dur", "0.8s");
      animY.setAttribute("fill", "freeze");
      rect.appendChild(animY);

      svg.appendChild(rect);

      // Texto de valor encima de la barra
      const textVal = document.createElementNS(svgNS, "text");
      textVal.setAttribute("x", x + barWidth / 2);
      textVal.setAttribute("y", y - 6);
      textVal.setAttribute("fill", m.xp > 0 ? "#f8fafc" : "#64748b");
      textVal.setAttribute("font-size", "10");
      textVal.setAttribute("font-family", "Outfit");
      textVal.setAttribute("font-weight", "bold");
      textVal.setAttribute("text-anchor", "middle");
      textVal.textContent = m.xp + " XP";
      svg.appendChild(textVal);

      // Texto de Mes debajo del eje
      const textLabel = document.createElementNS(svgNS, "text");
      textLabel.setAttribute("x", x + barWidth / 2);
      textLabel.setAttribute("y", 182);
      textLabel.setAttribute("fill", "#94a3b8");
      textLabel.setAttribute("font-size", "10");
      textLabel.setAttribute("font-family", "Outfit");
      textLabel.setAttribute("text-anchor", "middle");
      textLabel.textContent = m.monthName;
      svg.appendChild(textLabel);
    });

    container.appendChild(svg);
  },

  renderCategoryDistributionChart() {
    const container = document.getElementById('category-pie-chart-container');
    container.innerHTML = '';

    const completed = this.quests.filter(q => q.status === 'Completada');
    
    if (completed.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay suficientes misiones completadas para generar gráficos de distribución.</p>';
      return;
    }

    // Agrupar conteo de misiones por categoría
    const categoriesCount = {};
    completed.forEach(q => {
      categoriesCount[q.category] = (categoriesCount[q.category] || 0) + 1;
    });

    const categoriesArray = Object.keys(categoriesCount).map(cat => {
      return {
        name: cat,
        count: categoriesCount[cat],
        percent: (categoriesCount[cat] / completed.length) * 100
      };
    });

    // Ordenar de mayor a menor frecuencia
    categoriesArray.sort((a, b) => b.count - a.count);

    // Renderizar una barra radial limpia o lista estilizada con barra de progreso
    // Al ser un diseño mobile-first y offline, las barras de progreso apiladas son ultra legibles, limpias y elegantes.
    const colors = {
      'Exploración Urbana': '#6366f1',
      'Desarrollo de Personaje': '#a855f7',
      'Aventuras Sociales': '#ec4899',
      'Desafíos Mentales': '#ef4444',
      'Creatividad': '#f59e0b',
      'Salud y Energía': '#10b981',
      'Aprendizaje': '#06b6d4'
    };

    const listContainer = document.createElement('div');
    listContainer.className = 'category-stat-list';
    listContainer.style.width = '100%';
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = '0.75rem';

    categoriesArray.forEach(cat => {
      const color = colors[cat.name] || '#94a3b8';
      const item = document.createElement('div');
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.2rem;">
          <span style="font-weight: 600;">${cat.name}</span>
          <span style="color: var(--text-secondary);">${cat.count} misiones (${Math.round(cat.percent)}%)</span>
        </div>
        <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
          <div style="width: ${cat.percent}%; height: 100%; background: ${color}; box-shadow: 0 0 6px ${color}; border-radius: 3px;"></div>
        </div>
      `;
      listContainer.appendChild(item);
    });

    container.appendChild(listContainer);
  },

  renderFavoriteAttributePanel() {
    const panel = document.getElementById('favorite-attribute-panel');
    panel.innerHTML = '';

    // Encontrar atributo con mayor puntaje
    let favAttr = '';
    let maxPts = -1;

    Object.keys(this.character.attributes).forEach(attr => {
      const pts = this.character.attributes[attr] || 0;
      if (pts > maxPts) {
        maxPts = pts;
        favAttr = attr;
      }
    });

    if (maxPts <= 0) {
      panel.innerHTML = '<p class="empty-state">Continúa completando misiones secundarias para potenciar tus atributos RPG.</p>';
      return;
    }

    const attrIcons = {
      Curiosidad: '🔍',
      Carisma: '🗣️',
      Disciplina: '🛡️',
      Valentía: '⚔️',
      Creatividad: '🎨',
      Perspectiva: '👁️',
      Sabiduría: '📖',
      Resistencia: '🏃',
      Espontaneidad: '🌀',
      Empatía: '❤️'
    };

    const level = Math.floor(maxPts / 10) + 1;

    panel.innerHTML = `
      <div class="fav-attr-badge">${attrIcons[favAttr] || '💎'}</div>
      <div class="fav-attr-name">${favAttr}</div>
      <div class="fav-attr-details">
        Has acumulado un total de <strong>${maxPts} puntos</strong> de experiencia en este atributo. <br>
        Es tu estadística de nivel de personaje más dominante actual (Nivel ${level}).
      </div>
    `;
  },

  // --- COPIAS DE RESPALDO (EXPORT / IMPORT JSON) ---

  exportProgress() {
    const progressData = {
      version: '1.0',
      character: this.character,
      quests: this.quests,
      achievements: this.achievements,
      timestamp: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(progressData));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sidequest_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  importProgress(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Validación mínima
        if (data.character && data.quests && data.achievements) {
          this.character = data.character;
          this.quests = data.quests;
          this.achievements = data.achievements;
          
          this.saveAll();
          this.renderAll();
          alert('¡Progreso importado con éxito! Se ha restablecido tu hoja de personaje y bitácora de misiones.');
          window.location.reload(); // Recargar para sincronizar totalmente
        } else {
          alert('El archivo no tiene el formato válido de respaldo de SideQuest.');
        }
      } catch (err) {
        console.error('Error al importar archivo:', err);
        alert('Error al leer el archivo. Asegúrate de importar un archivo JSON válido exportado de SideQuest.');
      }
    };
    reader.readAsText(file);
  },

  // Evento especial de instalación PWA
  registerPWAInstallEvent() {
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      // Evitar que aparezca el prompt por defecto de Chrome
      e.preventDefault();
      deferredPrompt = e;
      
      // Se podría mostrar un banner personalizado aquí
      console.log('SideQuest está lista para ser instalada en tu pantalla de inicio.');
    });
  }
};
