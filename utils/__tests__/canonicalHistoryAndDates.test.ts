import { 
  getHabitStatusForDate, 
  getHabitHistoryForDate, 
  isHabitExpectedOnDate,
  getHabitsExpectedOnDate,
  countExpectedOccurrences
} from '../frequencyEngine';
import { 
  toLogicalDate, 
  getLogicalToday, 
  addLogicalDays, 
  subLogicalDays, 
  compareLogicalDates, 
  isFutureDate,
  diffInDaysLogicalDates
} from '../dateUtils';
import { Habit, HabitLog, Frequency, Priority, VerificationType, Category } from '../../types';

describe('Motor Canónico de Frecuencia e Historial (Reglas Definitivas)', () => {
  const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'habit-1',
    userId: 'user-1',
    nombre: 'Hábito de Prueba',
    categoria: Category.SALUD,
    icono: 'heart',
    colorHex: '#3B82F6',
    frecuencia: Frequency.DAILY,
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    tipoVerificacion: VerificationType.BOOLEAN,
    nivelPrioridad: Priority.NORMAL,
    fechaInicio: '2026-10-01',
    activo: true,
    ...overrides,
  });

  const makeLog = (habitId: string, fecha: string, completado: boolean = true): HabitLog => ({
    id: `${habitId}_${fecha}`,
    habitId,
    userId: 'user-1',
    fecha,
    completado,
    timestampRegistro: `${fecha}T12:00:00.000Z`,
  });

  const TODAY = '2026-10-06';
  const YESTERDAY = '2026-10-05';
  const TOMORROW = '2026-10-07';

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Las 5 Reglas Definitivas del Historial
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Las 5 Reglas Definitivas del Historial', () => {
    it('Regla 1: Si NO estaba programado en esa fecha -> NOT_SCHEDULED (no es incumplido/FAILED)', () => {
      // Hábito semanal de Lunes (1), evaluamos en Martes 2026-10-06 (2)
      const weeklyMonHabit = makeHabit({
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1],
        fechaInicio: '2026-10-01',
      });

      const status = getHabitStatusForDate(weeklyMonHabit, TODAY, null, TODAY);
      expect(status).toBe('NOT_SCHEDULED');
      expect(status).not.toBe('FAILED');

      // En la lista del historial queda automáticamente excluido
      const history = getHabitHistoryForDate([weeklyMonHabit], TODAY, {}, TODAY);
      expect(history).toHaveLength(0);
    });

    it('Regla 2: Si estaba programado y existe log completado -> COMPLETED', () => {
      const dailyHabit = makeHabit({ fechaInicio: '2026-10-01' });
      const completedLog = makeLog(dailyHabit.id, YESTERDAY, true);

      const statusYesterday = getHabitStatusForDate(dailyHabit, YESTERDAY, completedLog, TODAY);
      expect(statusYesterday).toBe('COMPLETED');

      const statusToday = getHabitStatusForDate(dailyHabit, TODAY, makeLog(dailyHabit.id, TODAY, true), TODAY);
      expect(statusToday).toBe('COMPLETED');
    });

    it('Regla 3: Si estaba programado, la fecha es ANTERIOR a hoy y no existe log -> FAILED', () => {
      const dailyHabit = makeHabit({ fechaInicio: '2026-10-01' });

      // Ayer sin log
      const statusYesterday = getHabitStatusForDate(dailyHabit, YESTERDAY, null, TODAY);
      expect(statusYesterday).toBe('FAILED');

      // Ayer con log completado = false
      const failedLog = makeLog(dailyHabit.id, YESTERDAY, false);
      const statusFailed = getHabitStatusForDate(dailyHabit, YESTERDAY, failedLog, TODAY);
      expect(statusFailed).toBe('FAILED');
    });

    it('Regla 4: Si estaba programado, la fecha es HOY y no existe log -> PENDING (no FAILED)', () => {
      const dailyHabit = makeHabit({ fechaInicio: '2026-10-01' });

      // Hoy a cualquier hora sin log
      const status = getHabitStatusForDate(dailyHabit, TODAY, null, TODAY);
      expect(status).toBe('PENDING');
      expect(status).not.toBe('FAILED');

      // Verificamos getHabitHistoryForDate para hoy
      const history = getHabitHistoryForDate([dailyHabit], TODAY, {}, TODAY);
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('PENDING');
    });

    it('Regla 5: Fecha FUTURA -> FUTURE (no juzgado como incumplido ni completado)', () => {
      const dailyHabit = makeHabit({ fechaInicio: '2026-10-01' });

      const status = getHabitStatusForDate(dailyHabit, TOMORROW, null, TODAY);
      expect(status).toBe('FUTURE');
      expect(status).not.toBe('FAILED');
      expect(status).not.toBe('COMPLETED');

      // isFutureDate detecta que mañana es estrictamente futuro
      expect(isFutureDate(TOMORROW)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Casos de Negocio Específicos
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Casos que deben funcionar', () => {
    it('1. Creo hábito el miércoles → lunes y martes no lo muestran', () => {
      // Miércoles 2026-10-07
      const wednesdayHabit = makeHabit({
        id: 'wed-habit',
        fechaInicio: '2026-10-07',
        frecuencia: Frequency.DAILY,
      });

      // Lunes 2026-10-05
      const monday = '2026-10-05';
      expect(isHabitExpectedOnDate(wednesdayHabit, monday)).toBe(false);
      expect(getHabitsExpectedOnDate([wednesdayHabit], monday)).toHaveLength(0);
      expect(getHabitHistoryForDate([wednesdayHabit], monday, {}, TODAY)).toHaveLength(0);

      // Martes 2026-10-06
      const tuesday = '2026-10-06';
      expect(isHabitExpectedOnDate(wednesdayHabit, tuesday)).toBe(false);
      expect(getHabitsExpectedOnDate([wednesdayHabit], tuesday)).toHaveLength(0);
      expect(getHabitHistoryForDate([wednesdayHabit], tuesday, {}, TODAY)).toHaveLength(0);

      // Miércoles 2026-10-07 (Día de creación)
      const wednesday = '2026-10-07';
      expect(isHabitExpectedOnDate(wednesdayHabit, wednesday)).toBe(true);
      expect(getHabitsExpectedOnDate([wednesdayHabit], wednesday)).toHaveLength(1);
    });

    it('2. Semanal L/X/V → martes no es FAILED', () => {
      // Lunes=1, Miércoles=3, Viernes=5
      const lmxHabit = makeHabit({
        id: 'lmx-habit',
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5],
        fechaInicio: '2026-10-01',
      });

      // Martes 2026-10-06 (no programado)
      const tuesday = '2026-10-06';
      expect(isHabitExpectedOnDate(lmxHabit, tuesday)).toBe(false);

      const status = getHabitStatusForDate(lmxHabit, tuesday, null, TODAY);
      expect(status).toBe('NOT_SCHEDULED');
      expect(status).not.toBe('FAILED');

      // Tampoco aparece en la lista histórica de ese día
      const history = getHabitHistoryForDate([lmxHabit], tuesday, {}, TODAY);
      expect(history.find(h => h.habit.id === 'lmx-habit')).toBeUndefined();
    });

    it('3. Archivo el 1 de octubre → septiembre continúa mostrándose', () => {
      const habit: Habit = makeHabit({
        id: 'archived-oct',
        fechaInicio: '2026-09-01',
        activo: false,
        scheduleHistory: [
          {
            id: 'sh-1',
            habitId: 'archived-oct',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-09-01',
            validUntil: '2026-10-01', // Estuvo activo todo septiembre
            activo: true,
          },
          {
            id: 'sh-2',
            habitId: 'archived-oct',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-10-01',
            validUntil: null, // Archivado desde el 1 de octubre
            activo: false,
          },
        ],
      });

      // En septiembre sigue existiendo y estando programado
      expect(isHabitExpectedOnDate(habit, '2026-09-15')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-09-30')).toBe(true);
      const septHistory = getHabitHistoryForDate([habit], '2026-09-15', {}, TODAY);
      expect(septHistory).toHaveLength(1);
      expect(septHistory[0].habit.id).toBe('archived-oct');

      // En octubre ya no se programa
      expect(isHabitExpectedOnDate(habit, '2026-10-01')).toBe(false);
      expect(isHabitExpectedOnDate(habit, '2026-10-05')).toBe(false);
      const octHistory = getHabitHistoryForDate([habit], '2026-10-05', {}, TODAY);
      expect(octHistory).toHaveLength(0);
    });

    it('4. Reactivo el 10 de octubre → el intervalo archivado no genera fallos', () => {
      const habit: Habit = makeHabit({
        id: 'reactivated-habit',
        fechaInicio: '2026-09-01',
        activo: true,
        scheduleHistory: [
          {
            id: 'sh-1',
            habitId: 'reactivated-habit',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-09-01',
            validUntil: '2026-10-01',
            activo: true,
          },
          {
            id: 'sh-2',
            habitId: 'reactivated-habit',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-10-01',
            validUntil: '2026-10-10', // Intervalo archivado del 1 al 9 de octubre
            activo: false,
          },
          {
            id: 'sh-3',
            habitId: 'reactivated-habit',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-10-10',
            validUntil: null, // Reactivado el 10 de octubre
            activo: true,
          },
        ],
      });

      // El intervalo archivado (1 al 9 de oct) no correspondía, por lo tanto count = 0 y no genera fallos
      expect(countExpectedOccurrences(habit, '2026-10-01', '2026-10-09')).toBe(0);
      expect(isHabitExpectedOnDate(habit, '2026-10-05')).toBe(false);

      const statusOct5 = getHabitStatusForDate(habit, '2026-10-05', null, '2026-10-12');
      expect(statusOct5).toBe('NOT_SCHEDULED');
      expect(statusOct5).not.toBe('FAILED');

      // A partir del 10 de octubre vuelve a corresponder normalmente
      expect(isHabitExpectedOnDate(habit, '2026-10-10')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-10-11')).toBe(true);
    });

    it('5. Cambio L/X/V a M/J → días anteriores conservan L/X/V', () => {
      // Modificado el 2026-10-06
      const habit: Habit = makeHabit({
        id: 'schedule-changed',
        fechaInicio: '2026-10-01',
        frecuencia: Frequency.WEEKLY,
        diasSemana: [2, 4], // Actual: Martes y Jueves
        scheduleHistory: [
          {
            id: 'sh-1',
            habitId: 'schedule-changed',
            frecuencia: Frequency.WEEKLY,
            diasSemana: [1, 3, 5], // L/X/V vigente del 1 al 5 de octubre
            validFrom: '2026-10-01',
            validUntil: '2026-10-06',
            activo: true,
          },
          {
            id: 'sh-2',
            habitId: 'schedule-changed',
            frecuencia: Frequency.WEEKLY,
            diasSemana: [2, 4], // M/J vigente desde el 6 de octubre
            validFrom: '2026-10-06',
            validUntil: null,
            activo: true,
          },
        ],
      });

      // Viernes 2026-10-02 (anterior al cambio): debe conservar L/X/V (viernes = sí)
      expect(isHabitExpectedOnDate(habit, '2026-10-02')).toBe(true);

      // Jueves 2026-10-01 (anterior al cambio): en L/X/V jueves no correspondía
      expect(isHabitExpectedOnDate(habit, '2026-10-01')).toBe(false);

      // Jueves 2026-10-08 (posterior al cambio): en M/J jueves sí corresponde
      expect(isHabitExpectedOnDate(habit, '2026-10-08')).toBe(true);

      // Viernes 2026-10-09 (posterior al cambio): en M/J viernes ya no corresponde
      expect(isHabitExpectedOnDate(habit, '2026-10-09')).toBe(false);
    });

    it('6. Hoy a las 09:00, un hábito de hoy sin completar aparece PENDING', () => {
      const dailyHabit = makeHabit({ fechaInicio: '2026-10-01' });

      // Invocado simulando hoy
      const status = getHabitStatusForDate(dailyHabit, TODAY, null, TODAY);
      expect(status).toBe('PENDING');

      const history = getHabitHistoryForDate([dailyHabit], TODAY, {}, TODAY);
      expect(history[0].status).toBe('PENDING');
    });

    it('7. Mañana no puede completarse ni juzgarse como incumplido', () => {
      const dailyHabit = makeHabit({ fechaInicio: '2026-10-01' });

      expect(isFutureDate(TOMORROW)).toBe(true);
      const statusTomorrow = getHabitStatusForDate(dailyHabit, TOMORROW, null, TODAY);
      expect(statusTomorrow).toBe('FUTURE');
      expect(statusTomorrow).not.toBe('FAILED');
      expect(statusTomorrow).not.toBe('COMPLETED');
    });

    it('8. Hábito mensual del 31 aparece el último día de febrero (28 no bisiesto, 29 bisiesto)', () => {
      const monthly31 = makeHabit({
        id: 'monthly-31',
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-01-31',
      });

      // Febrero 2026 (no bisiesto -> tiene 28 días)
      expect(isHabitExpectedOnDate(monthly31, '2026-02-27')).toBe(false);
      expect(isHabitExpectedOnDate(monthly31, '2026-02-28')).toBe(true);

      // Febrero 2024 (bisiesto -> tiene 29 días)
      const leapHabit = makeHabit({
        id: 'monthly-leap',
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2024-01-31',
      });
      expect(isHabitExpectedOnDate(leapHabit, '2024-02-28')).toBe(false);
      expect(isHabitExpectedOnDate(leapHabit, '2024-02-29')).toBe(true);

      // Abril 2026 (tiene 30 días -> corresponde el 30)
      expect(isHabitExpectedOnDate(monthly31, '2026-04-29')).toBe(false);
      expect(isHabitExpectedOnDate(monthly31, '2026-04-30')).toBe(true);

      // Mayo 2026 (tiene 31 días -> corresponde el 31)
      expect(isHabitExpectedOnDate(monthly31, '2026-05-30')).toBe(false);
      expect(isHabitExpectedOnDate(monthly31, '2026-05-31')).toBe(true);
    });

    it('9. Transición de mes/año correcta con addLogicalDays y subLogicalDays', () => {
      expect(addLogicalDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(subLogicalDays('2027-01-01', 1)).toBe('2026-12-31');
      expect(diffInDaysLogicalDates('2027-01-01', '2026-12-31')).toBe(1);

      expect(addLogicalDays('2026-02-28', 1)).toBe('2026-03-01');
      expect(subLogicalDays('2026-03-01', 1)).toBe('2026-02-28');
    });

    it('10. Timezone Europe/Madrid cerca de medianoche correcta', () => {
      // 23:59:00 en hora local
      const lateDate = new Date(2026, 9, 6, 23, 59, 0); // 6 de octubre de 2026, 23:59
      expect(toLogicalDate(lateDate)).toBe('2026-10-06');

      // 00:01:00 en hora local
      const earlyDate = new Date(2026, 9, 7, 0, 1, 0); // 7 de octubre de 2026, 00:01
      expect(toLogicalDate(earlyDate)).toBe('2026-10-07');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Navegación con LogicalDate en componentes
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Navegación con LogicalDate', () => {
    it('compara fechas correctamente sin instanciar objetos Date variables', () => {
      expect(compareLogicalDates('2026-10-05', '2026-10-06')).toBe(-1);
      expect(compareLogicalDates('2026-10-06', '2026-10-06')).toBe(0);
      expect(compareLogicalDates('2026-10-07', '2026-10-06')).toBe(1);
    });

    it('addLogicalDays navega hacia atrás y adelante fielmente', () => {
      let current = '2026-10-06';
      current = addLogicalDays(current, -1);
      expect(current).toBe('2026-10-05');
      current = addLogicalDays(current, 1);
      expect(current).toBe('2026-10-06');
    });
  });
});
