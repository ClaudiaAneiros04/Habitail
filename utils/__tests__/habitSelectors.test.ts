import { selectProcessedHabits, getFlatListLayout } from '../habitSelectors';
import { Habit } from '../../types';

describe('habitSelectors - Pruebas Unitarias', () => {
  const mockHabits: Habit[] = [
    {
      id: 'habit-1',
      userId: 'user-1',
      nombre: 'Hábito Activo de Salud',
      categoria: 'Salud',
      icono: 'heart',
      colorHex: '#FF0000',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      horaRecordatorio: '08:00',
      nivelPrioridad: 'HIGH',
      tipoVerificacion: 'BOOLEAN',
      fechaInicio: '2026-05-20',
      activo: true,
    },
    {
      id: 'habit-2',
      userId: 'user-1',
      nombre: 'Hábito Inactivo de Finanzas',
      categoria: 'Finanzas',
      icono: 'cash',
      colorHex: '#00FF00',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      horaRecordatorio: '19:30',
      nivelPrioridad: 'NORMAL',
      tipoVerificacion: 'BOOLEAN',
      fechaInicio: '2026-05-20',
      activo: false,
    },
    {
      id: 'habit-3',
      userId: 'user-1',
      nombre: 'Hábito Activo de Salud 2',
      categoria: 'Salud',
      icono: 'walk',
      colorHex: '#0000FF',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      nivelPrioridad: 'LOW',
      tipoVerificacion: 'BOOLEAN',
      fechaInicio: '2026-05-20',
      activo: true,
    }
  ];

  test('Debe procesar la lista completa de hábitos correctamente', () => {
    const result = selectProcessedHabits(mockHabits);

    expect(result.totalCount).toBe(3);
    expect(result.activeCount).toBe(2);
    expect(result.inactiveCount).toBe(1);
    expect(result.uniqueCategories).toEqual(expect.arrayContaining(['Salud', 'Finanzas']));
    expect(result.uniqueCategories.length).toBe(2);

    expect(result.items[0]).toEqual({
      id: 'habit-1',
      nombre: 'Hábito Activo de Salud',
      colorHex: '#FF0000',
      icono: 'heart',
      nivelPrioridad: 'HIGH',
      activo: true,
      reminderTimeFormatted: '08:00',
    });

    expect(result.items[2]).toEqual({
      id: 'habit-3',
      nombre: 'Hábito Activo de Salud 2',
      colorHex: '#0000FF',
      icono: 'walk',
      nivelPrioridad: 'LOW',
      activo: true,
      reminderTimeFormatted: null,
    });

    expect(result.layoutHeights).toEqual({
      itemHeight: 80,
      separatorHeight: 10,
    });
  });

  test('Debe procesar sólo los hábitos activos cuando onlyActive es true', () => {
    const result = selectProcessedHabits(mockHabits, { onlyActive: true });

    expect(result.totalCount).toBe(2);
    expect(result.activeCount).toBe(2);
    expect(result.inactiveCount).toBe(0);
    expect(result.items.some(item => item.id === 'habit-2')).toBe(false);
  });

  test('Debe permitir personalizar la altura de item y separadores', () => {
    const result = selectProcessedHabits(mockHabits, {
      customItemHeight: 100,
      customSeparatorHeight: 15,
    });

    expect(result.layoutHeights).toEqual({
      itemHeight: 100,
      separatorHeight: 15,
    });
  });

  test('Debe generar la función getItemLayout de FlatList compatible', () => {
    const collection = selectProcessedHabits(mockHabits, {
      customItemHeight: 80,
      customSeparatorHeight: 10,
    });

    const layoutGetter = getFlatListLayout(collection);
    const layout0 = layoutGetter(null, 0);
    const layout1 = layoutGetter(null, 1);

    expect(layout0).toEqual({ length: 80, offset: 0, index: 0 });
    expect(layout1).toEqual({ length: 80, offset: 90, index: 1 });
  });
});
