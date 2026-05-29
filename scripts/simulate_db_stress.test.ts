import { calculateCurrentStreak, calculateCompletionRate, calculateMaxStreak } from '../utils/streakCalculator';
import { Habit, Category, Frequency, Priority, VerificationType, HabitLog } from '../types';
import { formatISO, subDays } from 'date-fns';
import { performance } from 'perf_hooks';

describe('Prueba de Estrés de Historial de Hábitos (Fase 7)', () => {
  it('debería ejecutar el cálculo de rachas sobre 1500 logs de forma eficiente', () => {
    const dummyHabit: Habit = {
      id: 'habit-stress',
      userId: 'user-1',
      nombre: 'Beber Agua (Stress Test)',
      categoria: Category.SALUD,
      icono: 'water',
      colorHex: '#00F',
      frecuencia: Frequency.DAILY,
      diasSemana: [1, 2, 3, 4, 5, 6, 7],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: formatISO(subDays(new Date(), 1500)),
      activo: true
    };

    const totalLogs = 1500;
    const logs: HabitLog[] = [];

    for (let i = 0; i < totalLogs; i++) {
      const isCompleted = i < 100 ? true : Math.random() > 0.1;
      
      logs.push({
        id: `log-${i}`,
        habitId: dummyHabit.id,
        userId: dummyHabit.userId!,
        fecha: formatISO(subDays(new Date(), i)),
        completado: isCompleted,
        timestampRegistro: formatISO(new Date())
      });
    }

    console.log(`\nDataset generado: ${logs.length} logs (aprox 4 años de datos diarios).`);

    const t0 = performance.now();
    const currentStreak = calculateCurrentStreak(logs, dummyHabit);
    const t1 = performance.now();
    console.log(`[Rendimiento] calculateCurrentStreak: ${(t1 - t0).toFixed(2)} ms (Resultado: ${currentStreak})`);

    const t2 = performance.now();
    const maxStreak = calculateMaxStreak(logs, dummyHabit);
    const t3 = performance.now();
    console.log(`[Rendimiento] calculateMaxStreak: ${(t3 - t2).toFixed(2)} ms (Resultado: ${maxStreak})`);

    const t4 = performance.now();
    const completionRate = calculateCompletionRate(logs, 30);
    const t5 = performance.now();
    console.log(`[Rendimiento] calculateCompletionRate (30d): ${(t5 - t4).toFixed(2)} ms (Resultado: ${completionRate}%)`);

    const t6 = performance.now();
    const completionRateYear = calculateCompletionRate(logs, 365);
    const t7 = performance.now();
    console.log(`[Rendimiento] calculateCompletionRate (365d): ${(t7 - t6).toFixed(2)} ms (Resultado: ${completionRateYear}%)`);

    // Comprobamos que tarde menos de 50ms para 1500 registros, lo cual es casi instantáneo
    expect(t1 - t0).toBeLessThan(50);
    expect(t3 - t2).toBeLessThan(50);
  });
});
