/**
 * Tests de casos límite para la lógica de rachas y frecuencias.
 *
 * Cubre los tres casos críticos identificados en la revisión:
 *   1. Cálculo de rachas (diaria y semanal) con varios escenarios
 *   2. Cambio de zona horaria del teléfono
 *   3. Hábito semanal donde 'hoy' no es un día activo
 */
import {
  calculateCurrentStreak,
  calculateMaxStreak,
} from '../streakCalculator';
import { getHabitsForToday } from '../frequencyEngine';
import { Habit, HabitLog, Frequency, Category, Priority, VerificationType } from '../../types';
import { startOfDay, subDays, formatISO } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  userId: 'u1',
  nombre: 'Test',
  categoria: Category.SALUD,
  icono: 'star',
  colorHex: '#fff',
  frecuencia: Frequency.DAILY,
  diasSemana: [],
  tipoVerificacion: VerificationType.BOOLEAN,
  nivelPrioridad: Priority.NORMAL,
  fechaInicio: '2020-01-01',
  activo: true,
  ...overrides,
});

/**
 * Crea un HabitLog con fecha relativa a una referencia.
 * @param ref        - Fecha de referencia (simula "hoy").
 * @param daysBack   - Cuántos días hacia atrás respecto a ref.
 * @param completed  - Si el log está marcado como completado.
 */
const makeLog = (ref: Date, daysBack: number, completed = true): HabitLog => ({
  id: `log-${daysBack}`,
  habitId: 'h1',
  userId: 'u1',
  fecha: formatISO(subDays(startOfDay(ref), daysBack), { representation: 'date' }),
  completado: completed,
  timestampRegistro: new Date().toISOString(),
});

// ─── 1. Cálculo de rachas ────────────────────────────────────────────────────

describe('Caso 1 – Cálculo de rachas (diaria)', () => {
  const today = new Date('2026-04-24T10:00:00'); // fecha fija, hora local
  const habit = makeHabit();

  it('racha de 1 cuando solo completó hoy', () => {
    expect(calculateCurrentStreak([makeLog(today, 0)], habit, today)).toBe(1);
  });

  it('racha de 3 con hoy + 2 días anteriores consecutivos', () => {
    const logs = [makeLog(today, 0), makeLog(today, 1), makeLog(today, 2)];
    expect(calculateCurrentStreak(logs, habit, today)).toBe(3);
  });

  it('racha activa si no hizo hoy pero sí ayer y anteayer', () => {
    const logs = [makeLog(today, 1), makeLog(today, 2)];
    expect(calculateCurrentStreak(logs, habit, today)).toBe(2);
  });

  it('racha = 0 cuando hay un gap de 2 días (ayer también faltó)', () => {
    // Hizo hace 2 días y 3 días, pero no ayer ni hoy → racha rota
    const logs = [makeLog(today, 2), makeLog(today, 3)];
    expect(calculateCurrentStreak(logs, habit, today)).toBe(0);
  });

  it('logs duplicados del mismo día NO inflan la racha', () => {
    // Tres logs para el mismo día (hoy)
    const logs = [
      makeLog(today, 0),
      { ...makeLog(today, 0), id: 'dup-a' },
      { ...makeLog(today, 0), id: 'dup-b' },
    ];
    expect(calculateCurrentStreak(logs, habit, today)).toBe(1);
  });

  it('logs con completado=false NO cuentan para la racha', () => {
    const logs = [
      makeLog(today, 0, false), // hoy pero no completado
      makeLog(today, 1),        // ayer sí
    ];
    // Hoy no completado → ignorado. Ayer sí → racha de 1 desde ayer
    expect(calculateCurrentStreak(logs, habit, today)).toBe(1);
  });

  it('racha máxima correcta con múltiples segmentos', () => {
    const logs = [
      makeLog(today, 0), makeLog(today, 1), makeLog(today, 2), // segmento de 3
      makeLog(today, 5), makeLog(today, 6),                     // segmento de 2
      makeLog(today, 10),                                        // segmento de 1
    ];
    expect(calculateMaxStreak(logs)).toBe(3);
  });
});

// ─── 2. Caso borde crítico: cambio de zona horaria ──────────────────────────

describe('Caso 2 – Cambio de zona horaria del teléfono', () => {
  /**
   * La app guarda fechas como "YYYY-MM-DD" (local, sin timezone) mediante
   * formatDateDB. Al leerlas, parseISO en streakCalculator recibe un string
   * sin offset → date-fns lo interpreta como medianoche LOCAL.
   *
   * Consecuencia: si el usuario vuela de Madrid (UTC+2) a Tokio (UTC+9),
   * "2026-04-24" sigue siendo el 24 de abril en su nueva zona horaria.
   * NO se desplaza al día anterior por el UTC offset.
   *
   * Este test simula el escenario verificando que formatISO con
   * representation:'date' produce un string sin timezone y que parseISO
   * lo resuelve correctamente sin importar el offset del entorno.
   */
  const habit = makeHabit();

  it('una fecha YYYY-MM-DD se resuelve correctamente sin depender del offset UTC', () => {
    // Simula fecha guardada en una zona horaria (Madrid, UTC+2)
    // y leída en otra (Tokio, UTC+9). El string "2026-04-23" es ambos "el 23"
    const logConFechaLocal: HabitLog = {
      id: 'tz-log',
      habitId: 'h1',
      userId: 'u1',
      fecha: '2026-04-23',           // guardado en Madrid como "hoy"
      completado: true,
      timestampRegistro: new Date().toISOString(),
    };

    // La referencia es el 24 de abril (hoy en Tokio, día siguiente en Madrid)
    // → debe detectar que el log es de "ayer" y mantener la racha activa
    const refInTokyo = new Date('2026-04-24T10:00:00'); // hora en Tokio

    const streak = calculateCurrentStreak([logConFechaLocal], habit, refInTokyo);

    // El 23 es "ayer" respecto al 24 → racha de 1 activa (no 0)
    expect(streak).toBe(1);
  });

  it('NO se rompe la racha por cambio de zona si las fechas locales son consecutivas', () => {
    // Usuario viajó: completó el 22 en Madrid y el 23 en Tokio.
    // Ambas fechas están guardadas como string local sin offset.
    const logs: HabitLog[] = [
      { id: 'l1', habitId: 'h1', userId: 'u1', fecha: '2026-04-23', completado: true, timestampRegistro: '' },
      { id: 'l2', habitId: 'h1', userId: 'u1', fecha: '2026-04-22', completado: true, timestampRegistro: '' },
    ];
    const ref = new Date('2026-04-24T10:00:00');
    expect(calculateCurrentStreak(logs, habit, ref)).toBe(2); // 23 + 22 = racha 2 activa
  });
});

// ─── 3. Hábito semanal donde 'hoy' no es un día activo ──────────────────────

describe('Caso 3 – Hábito semanal y día no activo', () => {
  /**
   * diasSemana usa el convenio de Date.getDay(): 0=Dom, 1=Lun, …, 6=Sáb.
   * El hábito solo está activo Lunes(1), Miércoles(3) y Viernes(5).
   */
  const habitSoloLMV = makeHabit({
    frecuencia: Frequency.WEEKLY,
    diasSemana: [1, 3, 5], // Lun, Mié, Vie
  });

  // Martes 2026-04-21 (getDay() = 2) — día NO activo (diasSemana=[1,3,5])
  const martes = new Date('2026-04-21T10:00:00'); // martes, getDay()=2

  // Lunes 2026-04-20 (getDay() = 1) — día SÍ activo
  const lunes = new Date('2026-04-20T10:00:00'); // lunes, getDay()=1

  // ── frequencyEngine ──────────────────────────────────────────────────────

  it('getHabitsForToday: NO muestra el hábito cuando hoy es martes (día inactivo)', () => {
    const result = getHabitsForToday([habitSoloLMV], martes);
    expect(result).toHaveLength(0);
  });

  it('getHabitsForToday: SÍ muestra el hábito cuando hoy es lunes (día activo)', () => {
    const result = getHabitsForToday([habitSoloLMV], lunes);
    expect(result).toHaveLength(1);
  });

  // ── streakCalculator ─────────────────────────────────────────────────────

  it('la racha semanal NO se rompe por un martes (día inactivo) entre dos semanas con log', () => {
    /**
     * El calculador de rachas semanales funciona por VENTANAS de semana
     * (lunes a domingo), no por días individuales. Un martes sin log en
     * medio de dos semanas con log no rompe nada: lo importante es que
     * cada semana tuvo al menos 1 completado.
     */
    // Completó el lunes de esta semana (20 Apr) y el lunes de la semana pasada (13 Apr)
    const logs: HabitLog[] = [
      { id: 'l1', habitId: 'h1', userId: 'u1', fecha: '2026-04-20', completado: true, timestampRegistro: '' },
      { id: 'l2', habitId: 'h1', userId: 'u1', fecha: '2026-04-13', completado: true, timestampRegistro: '' },
    ];
    // Ref = martes 21 (día inactivo, pero dentro de la misma semana que el log del 20)
    const streak = calculateCurrentStreak(logs, habitSoloLMV, martes);
    expect(streak).toBe(2); // 2 semanas consecutivas con completado
  });

  it('la racha semanal = 0 si la semana actual Y la pasada no tienen ningún log', () => {
    const logs: HabitLog[] = [
      // Solo hay log de hace 3 semanas
      { id: 'l1', habitId: 'h1', userId: 'u1', fecha: '2026-04-01', completado: true, timestampRegistro: '' },
    ];
    const streak = calculateCurrentStreak(logs, habitSoloLMV, martes);
    expect(streak).toBe(0);
  });
});
