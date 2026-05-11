import { getPetState, applyHealthDelta, calculatePenaltyDelta } from './utils/petLogic';
import { PetState, Priority } from './types';

console.log('--- TEST DE MASCOTA: DATOS EXTREMOS ---');

// Test vida = 100
let vida = 100;
let state = getPetState(vida);
console.log(`Vida inicial: ${vida} -> Estado: ${state}`);

const habitosCumplidos = [
  { id: '1', prioridad: 'ESSENTIAL', completado: true },
  { id: '2', prioridad: 'NORMAL', completado: true },
];

vida = applyHealthDelta(vida, habitosCumplidos as any);
console.log(`Vida tras cumplir hábitos (esperado 100 por clamp): ${vida} -> Estado: ${getPetState(vida)}`);

// Test vida = 0
vida = 0;
state = getPetState(vida);
console.log(`\nVida inicial: ${vida} -> Estado: ${state}`);

const habitosIncumplidos = [
  { id: '3', prioridad: 'ESSENTIAL', completado: false },
  { id: '4', prioridad: 'NORMAL', completado: false },
];

vida = applyHealthDelta(vida, habitosIncumplidos as any);
console.log(`Vida tras incumplir hábitos (esperado 0 por clamp): ${vida} -> Estado: ${getPetState(vida)}`);

// Recuperación desde 0
vida = applyHealthDelta(vida, habitosCumplidos as any);
console.log(`\nVida tras recuperación (esperado 30): ${vida} -> Estado: ${getPetState(vida)}`);

// Penalización por job
const missedHabits = [
  { id: '5', nivelPrioridad: 'ESSENTIAL' },
  { id: '6', nivelPrioridad: 'FLEXIBLE' }
];
const penalty = calculatePenaltyDelta(missedHabits as any);
console.log(`\nPenalización por job (1 esencial, 1 flexible): ${penalty} (esperado -25)`);
