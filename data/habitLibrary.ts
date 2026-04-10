import { Category, Frequency, Priority } from '../types';

export interface PredefinedHabit {
  nombre: string;
  descripcion: string;
  categoria: Category;
  icono: string;
  colorHex: string;
  frecuencia: Frequency;
  nivelPrioridad: Priority;
}

export const habitLibrary: PredefinedHabit[] = [
  // SALUD
  {
    nombre: 'Beber 2L de agua',
    descripcion: 'Mantén tu cuerpo hidratado bebiendo al menos 2 litros de agua a lo largo del día.',
    categoria: Category.SALUD,
    icono: 'water-outline',
    colorHex: '#3b82f6', // blue-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.ESSENTIAL,
  },
  {
    nombre: 'Dormir 8 horas',
    descripcion: 'Asegura un descanso óptimo durmiendo entre 7 y 8 horas cada noche.',
    categoria: Category.SALUD,
    icono: 'bed-outline',
    colorHex: '#8b5cf6', // violet-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.ESSENTIAL,
  },
  {
    nombre: 'Comer 2 piezas de fruta',
    descripcion: 'Incorpora más vitaminas consumiendo fruta diariamente en el desayuno o la merienda.',
    categoria: Category.SALUD,
    icono: 'apple-outline',
    colorHex: '#ef4444', // red-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },
  {
    nombre: 'Tomar vitaminas/medicación',
    descripcion: 'Recuerda tomar las vitaminas o medicación recetada con la comida.',
    categoria: Category.SALUD,
    icono: 'medical-outline',
    colorHex: '#10b981', // emerald-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },

  // DEPORTE
  {
    nombre: '30 min de cardio',
    descripcion: 'Haz ejercicio cardiovascular moderado para cuidar tu corazón y ganar energía.',
    categoria: Category.DEPORTE,
    icono: 'fitness-outline',
    colorHex: '#f97316', // orange-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },
  {
    nombre: 'Estiramientos al despertar',
    descripcion: 'Rutina de 10 min de estiramientos para soltar los músculos y empezar el día.',
    categoria: Category.DEPORTE,
    icono: 'body-outline',
    colorHex: '#f59e0b', // amber-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.FLEXIBLE,
  },
  {
    nombre: 'Ir al gimnasio',
    descripcion: 'Asiste a tu rutina completa de pesas o maquinaria programada.',
    categoria: Category.DEPORTE,
    icono: 'barbell-outline',
    colorHex: '#64748b', // slate-500
    frecuencia: Frequency.WEEKLY,
    nivelPrioridad: Priority.ESSENTIAL,
  },
  {
    nombre: '10.000 pasos diarios',
    descripcion: 'Intenta caminar más durante el día hasta alcanzar el objetivo de 10 mil pasos.',
    categoria: Category.DEPORTE,
    icono: 'walk-outline',
    colorHex: '#22c55e', // green-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },

  // PRODUCTIVIDAD
  {
    nombre: 'Leer 20 páginas',
    descripcion: 'Lee un libro de no ficción, desarrollo personal o novela.',
    categoria: Category.PRODUCTIVIDAD,
    icono: 'book-outline',
    colorHex: '#6366f1', // indigo-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },
  {
    nombre: 'Planificar el día',
    descripcion: 'Dedica 10 minutos por la mañana a escribir las 3 tareas más importantes del día.',
    categoria: Category.PRODUCTIVIDAD,
    icono: 'calendar-outline',
    colorHex: '#0ea5e9', // sky-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.ESSENTIAL,
  },
  {
    nombre: 'Inbox Zero',
    descripcion: 'Revisa, contesta, archiva y deja la bandeja de entrada del correo a cero.',
    categoria: Category.PRODUCTIVIDAD,
    icono: 'mail-outline',
    colorHex: '#ef4444', // red-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.FLEXIBLE,
  },
  {
    nombre: 'Revisión semanal',
    descripcion: 'Revisa los objetivos logrados y planifica la siguiente semana.',
    categoria: Category.PRODUCTIVIDAD,
    icono: 'checkmark-done-outline',
    colorHex: '#14b8a6', // teal-500
    frecuencia: Frequency.WEEKLY,
    nivelPrioridad: Priority.ESSENTIAL,
  },

  // BIENESTAR
  {
    nombre: '10 min de meditación',
    descripcion: 'Tómate un descanso, siéntate en silencio y enfócate en tu respiración.',
    categoria: Category.BIENESTAR,
    icono: 'flower-outline',
    colorHex: '#d946ef', // fuchsia-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },
  {
    nombre: 'Escribir en mi diario',
    descripcion: 'Plasma en papel tus pensamientos, lo mejor del día y tus inquietudes.',
    categoria: Category.BIENESTAR,
    icono: 'journal-outline',
    colorHex: '#f43f5e', // rose-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.FLEXIBLE,
  },
  {
    nombre: 'Tiempo sin pantallas',
    descripcion: 'Apaga todos tus dispositivos electrónicos al menos 1 hora antes de dormir.',
    categoria: Category.BIENESTAR,
    icono: 'phone-portrait-outline',
    colorHex: '#64748b', // slate-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },
  {
    nombre: 'Dar las gracias',
    descripcion: 'Escribe 3 cosas concretas de ese mismo día por las que te sientas agradecido.',
    categoria: Category.BIENESTAR,
    icono: 'heart-outline',
    colorHex: '#ec4899', // pink-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.FLEXIBLE,
  },

  // FINANZAS
  {
    nombre: 'Registrar gastos del día',
    descripcion: 'Anota en tu app o cuaderno todas las compras y gastos menores.',
    categoria: Category.FINANZAS,
    icono: 'wallet-outline',
    colorHex: '#10b981', // emerald-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.ESSENTIAL,
  },
  {
    nombre: 'Día sin gastos',
    descripcion: 'No gastes dinero en absolutamente nada que no sea estrictamente vital hoy.',
    categoria: Category.FINANZAS,
    icono: 'cart-outline',
    colorHex: '#facc15', // yellow-400
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },
  {
    nombre: 'Revisar presupuesto',
    descripcion: 'Analiza tu estado de cuentas, gastos acumulados y categoriza todo.',
    categoria: Category.FINANZAS,
    icono: 'pie-chart-outline',
    colorHex: '#3b82f6', // blue-500
    frecuencia: Frequency.MONTHLY,
    nivelPrioridad: Priority.ESSENTIAL,
  },
  {
    nombre: 'Ingresar ahorro semanal',
    descripcion: 'Apartar una pequeña cantidad o transferir dinero a la cuenta de ahorro.',
    categoria: Category.FINANZAS,
    icono: 'cash-outline',
    colorHex: '#84cc16', // lime-500
    frecuencia: Frequency.WEEKLY,
    nivelPrioridad: Priority.NORMAL,
  },

  // APRENDIZAJE
  {
    nombre: 'Practicar un idioma',
    descripcion: '15 minutos de práctica de vocabulario, pronunciación o gramática.',
    categoria: Category.APRENDIZAJE,
    icono: 'language-outline',
    colorHex: '#3b82f6', // blue-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },
  {
    nombre: 'Avanzar curso online',
    descripcion: 'Visualizar las clases, leer y realizar los ejercicios del tema actual.',
    categoria: Category.APRENDIZAJE,
    icono: 'school-outline',
    colorHex: '#8b5cf6', // violet-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.NORMAL,
  },
  {
    nombre: 'Leer un artículo técnico',
    descripcion: 'Lee algo formativo o un blog sobre tu profesión/industria para estar al día.',
    categoria: Category.APRENDIZAJE,
    icono: 'document-text-outline',
    colorHex: '#64748b', // slate-500
    frecuencia: Frequency.DAILY,
    nivelPrioridad: Priority.FLEXIBLE,
  },
  {
    nombre: 'Escuchar podcast educativo',
    descripcion: 'Escucha una entrevista a un profesional o un podcast sobre un tema nuevo.',
    categoria: Category.APRENDIZAJE,
    icono: 'headset-outline',
    colorHex: '#f97316', // orange-500
    frecuencia: Frequency.WEEKLY,
    nivelPrioridad: Priority.FLEXIBLE,
  },
];
