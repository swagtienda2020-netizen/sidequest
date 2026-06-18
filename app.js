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
      // VOLUMEN I: EL DESPERTAR EN EL TRÓPICO (Misiones 1-30)
      // CATEGORÍA I: EXPLORACIÓN URBANA
      {
        id: 'q1',
        name: 'La Travesía del Magdalena',
        desc: 'Cruza a pie el histórico Puente Férreo o el Puente Ospina Pastrana hacia Flandes (Tolima). Una vez del otro lado, camina al menos 5 cuadras en territorio tolimense explorando sus calles antes de regresar a Girardot.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Curiosidad', 'Resistencia'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Orientación | Logro: Explorador Interestatal'
      },
      {
        id: 'q2',
        name: 'Alquimia de la Plaza',
        desc: 'Ve a la Plaza de Mercado de Girardot (el imponente edificio histórico diseñado por Leopoldo Rother) a las 7:00 AM. Busca un puesto de frutas y compra una fruta local que jamás hayas probado o que te parezca extraña (como el mangostino, caimito o níspero). Cómela ahí mismo.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Sabiduría', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Sabiduría Culinaria | Habilidad: Paladar Tropical'
      },
      {
        id: 'q3',
        name: 'El Caminante del Asfalto',
        desc: 'Sal de tu casa a una hora donde el sol ya haya bajado un poco (tipo 4:30 PM). Camina 15 cuadras seguidas en una dirección que jamás elijas para tus rutas cotidianas (evitando las vías principales como la Calle 20 o la Carrera 10). Hazlo sin mirar Google Maps.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Curiosidad', 'Espontaneidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Curiosidad | Descubrimiento de pasajes y sombras ocultas'
      },
      {
        id: 'q4',
        name: 'Reliquias del Camellón',
        desc: 'Recorre el Camellón del Comercio o una prendería/tienda de "cachivaches" del centro. Compra un objeto que sea total y absolutamente inútil, pero que tenga una mística "vintage" o artesanal digna de exhibir.',
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
        name: 'El Guardián de las Ruinas',
        desc: 'Visita la antigua Estación del Ferrocarril (frente al parque de la locomotora). Quédate de pie contemplando la estructura en silencio durante 10 minutos cronometrados, imaginando cómo era el bullicio de Girardot cuando era el puerto fluvial más importante del país.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Disciplina', 'Perspectiva'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Paciencia | Habilidad: Conexión Histórica'
      },
      {
        id: 'q6',
        name: 'Silencio en el Camposanto',
        desc: 'Visita el Cementerio Católico local en una tarde tranquila. Camina despacio por sus pasillos sombreados por árboles, lee las lápidas más antiguas e intenta descifrar las historias de los girardoteños de hace un siglo.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Perspectiva', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Perspectiva Existencial | Logro: Respeto por el Pasado'
      },
      {
        id: 'q7',
        name: 'Intuición de Papel',
        desc: 'Ve a una papelería antigua del centro o busca un puesto de revistas y libros usados cerca del Parque de Bolívar. Compra un libro guiándote única y exclusivamente por el diseño de su portada. No leas la sinopsis.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Perspectiva', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Intuición | Una lectura inesperada para las tardes calurosas'
      },
      {
        id: 'q8',
        name: 'La Ruta del Azar (En Buseta)',
        desc: 'Súbete a una buseta urbana de Girardot de una ruta que jamás uses (por ejemplo, una que vaya hacia Valle del Sol, Kennedy o Ricaurte). Mira por la ventana y bájate en el primer parque o esquina cuya arquitectura o árboles capten tu atención. Camina por ahí.',
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
        name: 'Elegancia bajo el Fuego',
        desc: 'Aprende a hacer un nudo de corbata clásico y elegante (como el Windsor o el Pratt) a la perfección. El verdadero reto: practicalo y manténlo puesto durante 20 minutos en tu casa sin encender el aire acondicionado ni el ventilador.',
        category: 'Desarrollo de Personaje',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Disciplina', 'Creatividad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Destreza | Logro: Caballero de Tierra Caliente'
      },
      {
        id: 'q10',
        name: 'El Alquimista del Río',
        desc: 'Cocina un plato complejo desde cero que requiera paciencia y técnica, idealmente un plato tradicional de la región como una Viuda de Capaz o un Sancocho de Gallina a fuego lento, comprando los ingredientes frescos en la plaza de mercado.',
        category: 'Desarrollo de Personaje',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Disciplina', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Disciplina | Habilidad: Soporte de Supervivencia Tolimense'
      },
      {
        id: 'q11',
        name: 'Lectura bajo la Acacia',
        desc: 'Lee un libro completo de un género literario que siempre hayas evitado (autoayuda, poesía, ciencia ficción dura) sentado bajo la sombra de un árbol en el Parque de Bolívar o en el Camellón.',
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
        name: 'Desconexión en el Oasis',
        desc: 'Pasa 12 horas seguidas despierto sin mirar una sola pantalla. Aprovecha para pasar la tarde en una piscina local (o río) disfrutando del agua y de la brisa de la tarde sin tomar una sola foto, selfie o mirar notificaciones.',
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
        name: 'El Arte de la Expresión',
        desc: 'Inscríbete o asiste a una clase única de prueba de algo que te dé profunda vergüenza o timidez (baile, teatro, canto o natación avanzada) en la Casa de la Cultura de Girardot o en las actividades del Banco de la República.',
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
        name: 'Cine para Uno (Modo VIP)',
        desc: 'Ve al cine completamente solo en Unicentro o en Oasis Plaza. Compra tu entrada para una función en un horario de la tarde (donde suele haber muy poca gente) y siéntate en la butaca del centro de la sala, disfrutando del aire acondicionado como si fuera tu sala privada.',
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
        name: 'El Centinela del Valle',
        desc: 'Despiértate antes del amanecer (5:00 AM), sube a un punto elevado de la ciudad (como el Alto de las Rosas o un mirador cercano) y observa cómo sale el sol sobre el valle del Río Magdalena antes de que empiece el calor fuerte.',
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
        name: 'Silbido de Llamada',
        desc: 'Practica hasta aprender a silbar fuertemente utilizando los dedos de la mano. No pares hasta lograr un sonido nítido y potente (un recurso acústico imprescindible para parar una buseta o llamar la atención en la calle).',
        category: 'Desarrollo de Personaje',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Disciplina', 'Resistencia'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Coordinación | Habilidad: Llamada del Asfalto'
      },
      // CATEGORÍA III: INTERACCIONES CON NPCs
      {
        id: 'q17',
        name: 'El Oráculo del Parque',
        desc: 'Mientras descansas bajo la sombra en el Parque de Bolívar o esperas en una fila, hazle una pregunta existencial o inusual a un desconocido de forma natural (ej: "¿Qué es lo que más extraña de la Girardot de hace 20 años?" o "Si pudiera viajar a cualquier lugar del mundo mañana mismo, ¿a dónde iría?").',
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
        name: 'El Escudo del Clima',
        desc: 'Di "No" a un plan social (por ejemplo, un paseo de olla o una tarde de piscina a la que realmente no tengas ganas de ir), de forma firme y educada, sin inventar una sola mentira piadosa o excusa médica.',
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
        name: 'Aliado del Refugio',
        desc: 'Compra una porción de comida para perro, busca un perrito de la calle (muy comunes cerca de las zonas comerciales o de la plaza de mercado) y acompáñalo en silencio bajo la sombra mientras se alimenta.',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Empatía', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Karma | Alianza con la facción canina'
      },
      {
        id: 'q20',
        name: 'El Gran Simulador en El Peñón',
        desc: 'Vístete con tu ropa más elegante para el calor (camisa de lino, buenas gafas de sol), entra a una inmobiliaria de lujo (o busca información sobre condominios en la zona exclusiva de El Peñón o Ricaurte) y pregunta con total naturalidad por las características de una propiedad que sabes que no puedes pagar.',
        category: 'Interacciones con NPCs',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Valentía', 'Carisma'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+30 de Audacia | Logro: Magnate por un Día'
      },
      {
        id: 'q21',
        name: 'El Camino del Samurái del "Raspado"',
        desc: 'Realiza un acto de bondad completamente anónimo durante el día: compra un raspado, un cholado o una avena helada en el centro y pídele al vendedor que le entregue otro gratis (pagado por ti) a la siguiente persona que compre o a alguien que veas que trabaja bajo el sol.',
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
        name: 'Reactivación del Clan',
        desc: 'Escríbele a un viejo amigo de la infancia o del colegio de Girardot con el que hayas perdido el contacto. Cuéntale un recuerdo muy específico (ej: "¿Te acuerdas cuando nos escapábamos a tomar avena a tal lado?") y pregúntale cómo va su vida.',
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
        name: 'Brisa de Buena Vibra',
        desc: 'Durante una sola tarde, hazle 3 cumplidos sinceros, específicos y no invasivos a tres completos desconocidos en la calle o en un local (ej: "¡Qué buena energía transmite su sombrero!" o "Usted prepara la avena más rica de la ciudad").',
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
        name: 'El Banquete del Recuerdo',
        desc: 'Invita a tus padres, abuelos o a un mentor de vida a tomar una avena fría con achiras o quesillo en Flandes o Ricaurte, pagada enteramente por ti, donde tu único rol sea escucharlos contar historias de su juventud.',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Empatía', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Gratitud | Fortalecimiento de lazos familiares'
      },
      // CATEGORÍA IV: MISTICISMO Y DESCONEXIÓN
      {
        id: 'q25',
        name: 'Cápsula del Tiempo Girandoteña',
        desc: 'Escribe una carta detallada a mano dirigida a tu "yo" de dentro de 5 años. Cuéntale tus miedos actuales, tus victorias y tus dudas. Sella el sobre y guárdalo en el rincón más oscuro de tu armario.',
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
        name: 'Melodías de la Tarde',
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
        name: 'Banda Sonora del Héroe',
        desc: 'Crea una playlist de exactamente 10 canciones que te hagan sentir invencible. Nómbrala "Arco del Protagonista en Girardot" y escúchala únicamente cuando camines solo por el Camellón del Comercio o cerca al río a paso lento, ignorando el ruido del tráfico.',
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
        name: 'Meditación de Fuego',
        desc: 'Siéntate en silencio durante 15 minutos exactos a meditar, concentrándote solo en tu respiración. Hazlo durante la "hora de la siesta" (entre la 1:00 PM y las 3:00 PM), cuando la ciudad parece detenerse por el calor extremo. Si piensas en pendientes, calor, deudas o tareas, reinicia el cronómetro.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Disciplina', 'Perspectiva'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+35 de Control Mental | Habilidad: Mente de Hielo'
      },
      {
        id: 'q29',
        name: 'Romantizar la Ciudad de las Acacias',
        desc: 'Vive un día entero (24 horas) bajo la regla de "romantizar tu vida". Vístete con tu mejor ropa veraniega, camina despacio, pide tu bebida favorita (un buen granizado o café frío), pasea por el puente peatonal y asume que eres el protagonista de una película de autor ambientada en el trópico colombiano.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Perspectiva', 'Carisma'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+30 de Autoestima | Desbloquea el filtro visual: Realismo Mágico'
      },
      {
        id: 'q30',
        name: 'Despertar del Modo Espera',
        desc: 'Comparte esta lista con un amigo de la zona o publícala en tus redes. Elige a una persona específica de Girardot, Flandes o Ricaurte y desafíala a completar al menos tres de estas misiones antes de que termine la semana.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Carisma', 'Valentía'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Liderazgo | Expansión del juego cooperativo en tu círculo'
      },
      // VOLUMEN II: EXPANSIÓN «MÁS ALLÁ DEL MAGDALENA» (Misiones 31-60)
      // CATEGORÍA V: RUTA TRANSFRONTERIZA
      {
        id: 'q31',
        name: 'El Cartógrafo de Ricaurte',
        desc: 'Cruza la frontera oriental de la ciudad y dirígete al municipio vecino de Ricaurte en buseta o bicicleta. Camina hasta el parque principal y tómate un raspado o come un helado artesanal mientras contemplas la iglesia local. El retorno debe ser antes del anochecer.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Curiosidad', 'Resistencia'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Exploración Geográfica | Logro: Viajero del Oriente'
      },
      {
        id: 'q32',
        name: 'El Desafío de la 14 en Hora Pico',
        desc: 'Recorre a pie toda la mítica Carrera 14 (el eje comercial peatonal más concurrido de Girardot) de punta a punta en plena hora pico (sábado a las 11:30 AM o 6:00 PM). El reto: hazlo a paso lento, con calma mental absoluta, esquivando el gentío y los puestos sin estresarte ni una sola vez.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Resistencia', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Destreza Urbana | Habilidad pasiva: Flujo de Agua'
      },
      {
        id: 'q33',
        name: 'Nocturlabio del Camellón',
        desc: 'Da una caminata por el Camellón del Comercio exactamente en el momento en que se encienden las luces del alumbrado público. Detente a leer con atención los monumentos históricos o placas conmemorativas que usualmente ignoras al pasar de afán.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Curiosidad', 'Perspectiva'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Conexión Histórica | Desbloqueo de lore local'
      },
      {
        id: 'q34',
        name: 'El Vórtice de las Dos Aguas',
        desc: 'Encuentra un punto seguro para observar la desembocadura del Río Bogotá en el majestuoso Río Magdalena (cerca de la zona de los puentes o caminos veredales accesibles). Quédate allí contemplando la unión de ambas corrientes en total silencio durante 5 minutos.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Empatía', 'Perspectiva'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Consciencia Ambiental | Modificador de serenidad natural'
      },
      {
        id: 'q35',
        name: 'Sabores de la Periferia',
        desc: 'Busca un puesto callejero de arepas de choclo, empanadas o patacones en un barrio residencial en el que nunca hayas estado (fuera del centro, por ejemplo, en El Alto de la Cruz, Primero de Mayo o Villampis). Compra algo sencillo y disfrútalo conversando brevemente con quien lo prepara.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Curiosidad', 'Espontaneidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Instinto Callejero | Descubrimiento de puntos de curación alternativos'
      },
      {
        id: 'q36',
        name: 'El Conquistador de la Colina',
        desc: 'Sube a pie, corriendo o en bicicleta hasta un mirador elevado o colina circundante en la vía que conduce hacia Nariño o por las veredas altas de la ciudad. Quédate arriba contemplando la inmensidad del valle caliente.',
        category: 'Exploración Urbana',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Resistencia', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+35 de Resistencia Física | Logro: Señor de las Alturas'
      },
      {
        id: 'q37',
        name: 'El Navegante Furtivo',
        desc: 'Ve al embarcadero del río Magdalena. Entabla conversación con un pescador o lanchero local. Pregúntale sobre las historias de las crecientes del río o cómo es navegar hacia el norte. (Misión opcional avanzada: contrata un viaje corto en lancha por el río).',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Valentía', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Audacia Fluvial | Habilidad: Pies de Agua'
      },
      {
        id: 'q38',
        name: 'Caza de Arte Callejero (Grafiti Hunter)',
        desc: 'Recorre la ciudad con el único propósito de encontrar e inmortalizar (con fotos) 5 murales artísticos o grafitis diferentes. Intenta descifrar el mensaje social o cultural detrás de cada uno de ellos.',
        category: 'Exploración Urbana',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Creatividad', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Percepción Visual | Logro: Galería Callejera'
      },
      // CATEGORÍA VI: DOMINIO FÍSICO Y TEMPLANZA TROPICAL
      {
        id: 'q39',
        name: 'El Herrero del Amanecer',
        desc: 'Despiértate a las 5:30 AM y realiza una sesión completa de estiramientos o yoga de 15 minutos en tu terraza, patio o balcón justo cuando la luz del día empieza a asomarse y la temperatura de la tierra aún es fresca.',
        category: 'Salud y Energía',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Resistencia', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Flexibilidad Corporal | Estado temporal: Cuerpo Ligero'
      },
      {
        id: 'q40',
        name: 'El Desafío Térmico del Glaciador',
        desc: 'En el pico de calor del día (entre la 1:30 PM y las 3:00 PM), prepárate un baño con agua lo más fría posible. Entra de golpe y permanece completamente inmóvil bajo el agua fría durante 5 minutos para dominar la respuesta de tu sistema sistema nervioso.',
        category: 'Salud y Energía',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Resistencia', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Templanza | Resistencia pasiva al calor aumentada'
      },
      {
        id: 'q41',
        name: 'Artesanía de la Acacia',
        desc: 'Recoge una semilla, una flor o una hoja bonita y seca de un árbol de Acacia. Úsala en casa para crear algo: un marcador de páginas para tus libros, un llavero o un elemento decorativo rústico para tu escritorio.',
        category: 'Creatividad',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Creatividad', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Destreza Creativa | Modificador estético de entorno'
      },
      {
        id: 'q42',
        name: 'El Banquete del Mediodía',
        desc: 'Aprende a preparar un almuerzo clásico de la región (un pescado sudado con yuca y plátano, o un arroz con coco bien estructurado) desde cero. Sírvelo al mediodía acompañado de una jarra de limonada natural con mucho hielo machacado.',
        category: 'Salud y Energía',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Disciplina', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+30 de Autosuficiencia | Habilidad: Nutrición del Guerrero'
      },
      {
        id: 'q43',
        name: 'Desintoxicación de Azúcar en el Trópico',
        desc: 'Pasa 24 horas continuas hidratándote única y exclusivamente con agua pura o agua de coco helada (comprada directamente a un vendedor de la calle en su coco original). Prohibidas las gaseosas, jugos empacados o tés azucarados por un día entero.',
        category: 'Salud y Energía',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Resistencia', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Vitalidad Pura | Efecto de estado: Purificación'
      },
      {
        id: 'q44',
        name: 'El Santuario de la Sabiduría (Modo Climatizado)',
        desc: 'Visita la Biblioteca del Banco de la República o la Casa de la Cultura de Girardot. Selecciona un libro sobre la historia del Tolima Grande, el río Magdalena o Cundinamarca y lee durante una hora ininterrumpida en sus silenciosos pasillos con aire acondicionado.',
        category: 'Aprendizaje',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Sabiduría', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Intelecto | Habilidad: Concentración Profunda'
      },
      {
        id: 'q45',
        name: 'Políglota de Emergencia',
        desc: 'Memoriza una frase de presentación completa y el cómo ordenar tu comida favorita en un idioma totalmente ajeno al tuyo (por ejemplo: japonés, alemán o ruso). Grábate en video o audio pronunciándolo a la perfección sin leer apuntes.',
        category: 'Aprendizaje',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Sabiduría', 'Creatividad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Agilidad Mental | Logro: Lingüista del Asfalto'
      },
      {
        id: 'q46',
        name: 'El Ritual de la Siesta Sagrada',
        desc: 'Toma una siesta de exactamente 20 minutos (con alarma estricta) en una hamaca, mecedora o silla cómoda durante las horas muertas del calor (2:00 PM). El reto es despertarte al instante en que suene la alarma y ponerte en acción, evitando el letargo del calor.',
        category: 'Salud y Energía',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Resistencia', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Recuperación de Energía | Habilidad: Reinicio Rápido'
      },
      // CATEGORÍA VII: REDES SOCIALES Y ALIANZAS CALLEJERAS
      {
        id: 'q47',
        name: 'El Cronista del Transporte Público',
        desc: 'Súbete a un taxi local para un trayecto corto. Entabla una conversación amigable con el conductor y hazle una pregunta abierta: “¿Cuál es la historia más loca, extraña o divertida que le ha tocado vivir manejando aquí en Girardot?”. Escucha con atención genuina.',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Carisma', 'Empatía'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Carisma Conversacional | Desbloqueo de anécdotas urbanas'
      },
      {
        id: 'q48',
        name: 'La Alianza de la Cosecha',
        desc: 'Ve a la plaza de mercado a comprar tu fruta o verdura de la semana. No pidas rebaja ni insistas en descuentos. En su lugar, pregúntale amablemente al vendedor de dónde traen los productos y cómo les afecta el clima actual de la región.',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Carisma', 'Empatía'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Diplomacia Comercial | Habilidad: Cliente de Oro'
      },
      {
        id: 'q49',
        name: 'Mecenas del Talento Urbano',
        desc: 'Cuando pases por el Parque de Bolívar, el Camellón o vayas en una buseta y veas a un músico, cuentero o artista callejero, detente a escucharlo durante al menos 3 minutos completos. Aplaude al terminar y apóyalo con un aporte económico generoso.',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Empatía', 'Carisma'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Empatía Humana | Logro: Patrocinador del Arte'
      },
      {
        id: 'q50',
        name: 'El Embajador de la Acogida',
        desc: 'Si en tus recorridos por las zonas hoteleras, terminal de transportes o centros comerciales ves a turistas o viajeros despistados que parezcan perdidos con sus maletas o buscando direcciones, acércate educadamente y ofréceles tu ayuda o recomiéndales un buen lugar local para comer.',
        category: 'Interacciones con NPCs',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Carisma', 'Valentía'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+35 de Liderazgo Social | Reputación local maximizada'
      },
      {
        id: 'q51',
        name: 'Lazos de Vecindario',
        desc: 'Saluda cordialmente por su nombre a tres vecinos, tenderos o trabajadores de tu cuadra con los que usualmente solo cruzas un "buenos días" frío. Hazles una pregunta rápida pero sincera sobre cómo va su semana.',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Carisma', 'Empatía'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Reputación en el Vecindario | Alianza con la facción residencial'
      },
      {
        id: 'q52',
        name: 'El Tablero Analógico',
        desc: 'Reúne a un grupo de familiares, amigos o vecinos en el patio, terraza o en una mesa en la acera al final de la tarde (cuando empieza a correr la brisa). Organiza un torneo de un juego tradicional (parqués, dominó o cartas) con una sola regla inquebrantable: todos los celulares deben estar apagados en una caja durante el juego.',
        category: 'Aventuras Sociales',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Empatía', 'Carisma'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Cohesión Grupal | Desconexión comunitaria'
      },
      {
        id: 'q53',
        name: 'El Legado Oral',
        desc: 'Siéntate con un adulto mayor de tu familia o de tu comunidad. Pídele que te enseñe a hacer algo de la forma tradicional en la que se hacía antes (por ejemplo: cómo curar una planta enferma, cómo reparar una prenda a mano o un truco casero contra las plagas del calor).',
        category: 'Aprendizaje',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Sabiduría', 'Empatía'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Sabiduría Ancestral | Habilidad pasiva: Respeto Intergeneracional'
      },
      {
        id: 'q54',
        name: 'El Impulsor Silencioso',
        desc: 'Elige tu restaurante local, panadería o negocio pequeño favorito de Girardot. Entra a Google Maps, déjales una reseña de 5 estrellas extremadamente detallada, sincera y positiva, destacando el trabajo de la gente. No les digas que fuiste tú.',
        category: 'Interacciones con NPCs',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Empatía', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Karma Positivo | Modificador: Soporte Comercial'
      },
      // CATEGORÍA VIII: LEYENDAS, MITOS Y ARCO INTERIOR
      {
        id: 'q55',
        name: 'El Ojo del Fotógrafo Tropical',
        desc: 'Sal a caminar por el centro o el río Magdalena durante 30 minutos con tu celular en "modo avión". Toma al menos 10 fotografías enfocadas exclusivamente en texturas del trópico colombiano: la corteza agrietada de un árbol, el reflejo del sol en el asfalto derretido, las tejas de barro coloniales, etc. No subas ninguna a redes sociales hoy.',
        category: 'Creatividad',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Creatividad', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Apreciación Estética | Desbloqueo del atributo: Foco de Artista'
      },
      {
        id: 'q56',
        name: 'El Susurro del Mohán',
        desc: 'Al final de la tarde, busca un lugar seguro y cómodo cerca de la orilla del río Magdalena. Colócate auriculares y escucha un audiolibro, podcast o video de mitos y leyendas del Tolima Grande (historias sobre el Mohán, la Patasola o la Madre Monte), sintiendo el viento del río golpear tu rostro.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Perspectiva', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Misticismo Regional | Conexión con el folklore ribereño'
      },
      {
        id: 'q57',
        name: 'El Guardián del Cosmos',
        desc: 'En una noche despejada, busca un lugar elevado o con baja contaminación lumínica (puede ser Ricaurte, una terraza alta o un patio oscuro). Apaga todas las luces que te rodeen, acuéstate boca arriba y contempla las estrellas durante 20 minutos seguidos sin interrupciones, intentando identificar constelaciones o el paso de satélites.',
        category: 'Misticismo y Desconexión',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Perspectiva', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Perspectiva Universal | Logro: Caminante Estelar'
      },
      {
        id: 'q58',
        name: 'El Ritual de la Ventilación Natural',
        desc: 'Pasa una tarde entera de fin de semana (al menos 3 horas continuas) sin encender ventiladores ni aire acondicionado. Abre todas las ventanas de par en par para que circule la brisa, ponte ropa de algodón o lino muy ligera, y dedícate a leer, escribir o dibujar como se hacía en la Girardot de mediados del siglo XX.',
        category: 'Desafíos Mentales',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Resistencia', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Resistencia Térmica | Habilidad: Adaptabilidad del Trópico'
      },
      {
        id: 'q59',
        name: 'El Manuscrito de las Acacias',
        desc: 'Consigue un cuaderno pequeño de hojas blancas. Durante una semana completa, escribe a mano una sola página al día al final de la tarde, justo cuando cantan las chicharras. Describe tus pensamientos de ese día, tus planes futuros o simplemente describe el calor que sientes en ese instante.',
        category: 'Desarrollo de Personaje',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Perspectiva', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Introspección | Fortalecimiento del autoconocimiento'
      },
      {
        id: 'q60',
        name: 'El Renacimiento del Protagonista',
        desc: 'Ejecuta un cambio radical en la distribución y estética de tu habitación o zona de estudio. Limpia a fondo, deshazte del desorden acumulado, cambia los muebles de lugar para refrescar la energía y decora con elementos (plantas veraniegas, cuadros, luces cálidas) que reflejen tu nueva identidad de "jugador activo" en el mundo real.',
        category: 'Creatividad',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Creatividad', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+45 de Evolución de Entorno | Desbloqueas: El Santuario Personal Renovado'
      },
      // VOLUMEN III: LA FORJA DEL CREADOR (Misiones 61-75)
      // CATEGORÍA IX: ALQUIMIA Y FORJA
      {
        id: 'q61',
        name: 'El Elíxir de las Acacias',
        desc: 'Crea una receta propia y única de granizado, limonada o infusión helada utilizando frutas frescas que compres en la plaza (como mango, maracuyá y un toque de menta o albahaca). Ponle un nombre de fantasía como si fuera una poción de maná de un juego de rol y dásela a probar a un amigo o familiar en una tarde calurosa.',
        category: 'Creatividad',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Creatividad', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Alquimia Culinaria | Habilidad pasiva: Bebida de Resistencia'
      },
      {
        id: 'q62',
        name: 'Forja de Madera Fluvial',
        desc: 'Ve a la orilla del río Magdalena o camina por una zona veredal sombreada y busca una rama seca, bonita y resistente, o un pedazo de madera arrastrado por el agua. Llévala a casa, lípiala, líjala un poco y conviértela en un objeto útil: un soporte rústico para tu celular, un perchero de pared o un soporte decorativo para tus audífonos.',
        category: 'Creatividad',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Creatividad', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Carpintería Artesanal | Logro: Artesano del Río'
      },
      {
        id: 'q63',
        name: 'El Codex de Supervivencia al Calor',
        desc: 'Diseña un pequeño fanzine (una revista artesanal hecha doblando una sola hoja de papel en 8 partes) titulado "Guía Secreta de Girardot para no Derretirse". Escribe consejos graciosos, dibuja un mapa básico de las mejores sombras de la ciudad y sácale al menos 2 fotocopias para regalárselas a amigos.',
        category: 'Creatividad',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Creatividad', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Diseño Analógico | Logro: Editor del Asfalto'
      },
      {
        id: 'q64',
        name: 'Modelado en Arcilla del Magdalena',
        desc: 'Compra un bloque pequeño de arcilla de secado al aire (o plastilina escolar). Dedica una tarde a moldear con tus propias manos una taza rústica, un cenicero, un portavelas o una figura inspirada en un mito local (como una pequeña canoa o una silueta del Mohán). Déjala secar al sol directo de Girardot.',
        category: 'Creatividad',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Creatividad', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Expresión Plástica | Modificador de paciencia manual'
      },
      {
        id: 'q65',
        name: 'Poción de Energía Solar Directa',
        desc: 'Prepara un té solar. Coloca agua fresca, bolsas de tu té favorito, rodajas de naranja o limón y una ramita de hierbabuena en un frasco de vidrio transparente bien sellado. Déjalo exactamente 3 horas en tu patio o ventana recibiendo la luz y el calor directo del sol del mediodía de Girardot para que se infusione de manera natural. Sírvelo con mucho hielo.',
        category: 'Creatividad',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Disciplina', 'Resistencia'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+10 de Paciencia Energética | Bebida cargada con el poder del Sol'
      },
      {
        id: 'q66',
        name: 'El Laberinto de Papel',
        desc: 'Diseña y dibuja en una hoja de papel un crucigrama, un laberinto o un acertijo de búsqueda de pistas basado enteramente en lugares icónicos, personajes conocidos o misterios de Girardot. Pon a prueba a un amigo o familiar para ver si logra resolverlo en menos de 10 minutos.',
        category: 'Creatividad',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Creatividad', 'Sabiduría'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Lógica y Creatividad | Logro: Diseñador de Calabozos'
      },
      {
        id: 'q67',
        name: 'Alquimia de Tintes Naturales',
        desc: 'Consigue una camiseta vieja de color blanco o claro que ya no uses. Realiza un teñido artesanal (estilo Tie-Dye o batik) utilizando un tinte orgánico que prepares en tu cocina hirviendo borra de café usado, cáscaras de cebolla morada o remolacha. Logra un patrón único y rústico.',
        category: 'Creatividad',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Creatividad', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+30 de Diseño Textil | Desbloqueas: Armadura Personalizada'
      },
      {
        id: 'q68',
        name: 'El Bodegón del Trópico',
        desc: 'Coloca sobre una mesa 3 objetos cotidianos que representen tu vida en Girardot (por ejemplo: un vaso de avena helada, una piedra del río, unas gafas de sol, un mango o una flor de acacia). Toma un cuaderno y dibuja el bodegón usando lápiz, carboncillo o colores, enfocándote en cómo cae la luz de la tarde sobre ellos.',
        category: 'Creatividad',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Creatividad', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Percepción Artística | Habilidad: Foco de Dibujante'
      },
      // CATEGORÍA X: EL SALTO DE FE
      {
        id: 'q69',
        name: 'El Idioma del Silencio',
        desc: 'Dedica una hora a aprender los conceptos básicos de la Lengua de Señas Colombiana (LSC): aprende a decir los saludos básicos, dar las gracias y deletrear tu propio nombre con las manos. Practica frente al espejo hasta que los movimientos sean fluidos.',
        category: 'Aprendizaje',
        difficulty: 'Bronce',
        xp: 10,
        attributes: ['Empatía', 'Carisma'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+15 de Empatía Comunicativa | Habilidad: Señales del Silencio'
      },
      {
        id: 'q70',
        name: 'El Ritmo Ajeno',
        desc: 'Visita un establecimiento, bar, festival o clase en la ciudad que ponga un género musical que usualmente evites por completo o que consideres ajeno a tus gustos (por ejemplo: si solo escuchas rock, ve a un lugar de salsa clásica; si solo oyes reggaetón, ve a escuchar jazz, música andina o rock en vivo). Quédate al menos 40 minutos analizando el ambiente y la energía de la gente.',
        category: 'Aprendizaje',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Empatía', 'Perspectiva'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+20 de Tolerancia Cultural | Expansión del mapa auditivo'
      },
      {
        id: 'q71',
        name: 'El Banquete del Guerrero Ciego',
        desc: 'Prepara una cena o un postre sencillo en tu cocina (como un sándwich bien estructurado o un plato de frutas picadas) con los ojos completamente vendados. Debes confiar únicamente en tu olfato, tu tacto y tu oído para ubicar los ingredientes y los utensilios (sin usar cuchillos afilados para evitar accidentes). Cómetelo con la venda puesta.',
        category: 'Desafíos Mentales',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Disciplina', 'Resistencia'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Agudeza Sensorial | Habilidad pasiva: Sentido de la Oscuridad'
      },
      {
        id: 'q72',
        name: 'El Documentalista del Magdalena',
        desc: 'Graba un mini-documental de 2 minutos utilizando tu celular (solo para ti, no necesitas publicarlo). Entrevista brevemente a un vendedor de raspados, a un lanchero o a un artesano del centro de Girardot. Hazle tres preguntas sobre cómo aprendió su oficio y qué es lo que más le gusta de trabajar en la calle.',
        category: 'Creatividad',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Carisma', 'Curiosidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+35 de Habilidades de Reportero | Logro: Cronista de la Ciudad'
      },
      {
        id: 'q73',
        name: 'La Hackatón de un Solo Día',
        desc: 'Dedica un sábado o domingo completo (8 horas seguidas con breves pausas para comer) a aprender los fundamentos absolutos de una herramienta digital o técnica de la que no tengas ni idea (como edición de video profesional en DaVinci, modelado 3D en Blender, desarrollo de apps sin código en Glide, o ilustración digital en Canva/Figma). Crea un micro-proyecto básico antes de que termine el día.',
        category: 'Aprendizaje',
        difficulty: 'Oro',
        xp: 50,
        attributes: ['Disciplina', 'Creatividad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+40 de Enfoque Profundo | Habilidad: Aprendizaje Acelerado'
      },
      {
        id: 'q74',
        name: 'El Explorador Rural (Ruta de la Tierra Alta)',
        desc: 'Sal de la zona urbana pavimentada de Girardot. Toma una ruta veredal de herradura o tierra (como el camino hacia la vereda Barzalosa, Piamonte o Agua Blanca) ya sea trotando, caminando a paso rápido o en bicicleta. Adéntrate al menos 2 kilómetros en el paisaje rural, respirando el aire del campo y observando la fauna local antes de regresar.',
        category: 'Exploración Urbana',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Resistencia', 'Disciplina'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+25 de Resistencia de Terreno | Logro: Caminante de Trocha'
      },
      {
        id: 'q75',
        name: 'El Reto del Avatar Inverso',
        desc: 'Durante un día completo (24 horas), cambia radicalmente un hábito estético, alimentario o de consumo que te define. Si eres muy carnívoro, come 100% vegetariano; si siempre te vistes de negro o colores oscuros, viste ropa de colores extremadamente vivos o claros; si eres 100% tecnológico, pasa el día entreteniéndote únicamente con pasatiempos analógicos como tejer, leer en papel o armar un rompecabezas.',
        category: 'Desafíos Mentales',
        difficulty: 'Plata',
        xp: 25,
        attributes: ['Perspectiva', 'Espontaneidad'],
        status: 'Disponible',
        dateCreated: new Date().toISOString(),
        dateFinished: null,
        notes: '',
        rewardText: '+30 de Plasticidad Mental | Efecto de estado: Identidad Flexible'
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
if (!localStorage.getItem('sidequest_quests_pdf_v3_girardot')) {
  Database.resetAll();
  localStorage.setItem('sidequest_quests_pdf_v3_girardot', 'true');
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
