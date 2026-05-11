import { Habit, Priority } from '../types';

export class InsufficientPointsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientPointsError';
  }
}

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Calcula los puntos que se otorgan por completar un hábito
 * según su prioridad. Es una función pura.
 * 
 * @param habit El hábito completado.
 * @returns El delta positivo de puntos a sumar.
 */
export function calcPointsDelta(habit: Habit): number {
  switch (habit.nivelPrioridad) {
    case Priority.ESSENTIAL:
    case 'ESSENTIAL':
      return 20;
    case Priority.NORMAL:
    case 'NORMAL':
      return 10;
    case Priority.FLEXIBLE:
    case 'FLEXIBLE':
      return 5;
    default:
      // En caso de que se reciba un nivelPrioridad no contemplado, se devuelve 0.
      return 0;
  }
}

/**
 * Descuenta puntos del saldo de forma segura, previniendo saldos negativos.
 * Función pura.
 * 
 * @param currentBalance El saldo de puntos actual.
 * @param price El costo en puntos a descontar.
 * @returns Result con el nuevo balance o un InsufficientPointsError si price > currentBalance.
 */
export function deductPoints(currentBalance: number, price: number): Result<number, InsufficientPointsError> {
  if (currentBalance < price) {
    return { ok: false, error: new InsufficientPointsError(`Insufficient points. Balance: ${currentBalance}, Price: ${price}`) };
  }
  return { ok: true, value: currentBalance - price };
}
