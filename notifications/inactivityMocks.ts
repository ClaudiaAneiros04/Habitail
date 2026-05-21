import { Pet, PetState } from '../types';

/**
 * Mocks de datos de la mascota para testear las condiciones de salud y vida
 * en el servicio de retención por inactividad.
 */

// Mascota en estado óptimo y feliz (Vida: 100)
export const mockHappyPet: Pet = {
  id: 'mock-pet-happy',
  userId: 'default-user',
  vida: 100,
  nivel: 5,
  xp: 40,
  xpParaSiguienteNivel: 150,
  estadoActual: PetState.HAPPY,
  skinEquipada: 'default-cat',
  accesorios: ['hat'],
};

// Mascota en estado animado/estable (Vida: 70)
export const mockCheeringPet: Pet = {
  id: 'mock-pet-cheering',
  userId: 'default-user',
  vida: 70,
  nivel: 3,
  xp: 15,
  xpParaSiguienteNivel: 120,
  estadoActual: PetState.CHEERING,
  skinEquipada: 'default-cat',
  accesorios: [],
};

// Mascota descuidada/confundida (Vida: 40)
export const mockConfusedPet: Pet = {
  id: 'mock-pet-confused',
  userId: 'default-user',
  vida: 40,
  nivel: 2,
  xp: 80,
  xpParaSiguienteNivel: 100,
  estadoActual: PetState.CONFUSED,
  skinEquipada: 'default-cat',
  accesorios: [],
};

// Mascota muy enferma/triste (Vida: 15)
export const mockSadPet: Pet = {
  id: 'mock-pet-sad',
  userId: 'default-user',
  vida: 15,
  nivel: 1,
  xp: 20,
  xpParaSiguienteNivel: 100,
  estadoActual: PetState.SAD,
  skinEquipada: 'default-cat',
  accesorios: [],
};

// Mascota ausente (Vida: 0) - La mascota se ha ido
export const mockAbsentPet: Pet = {
  id: 'mock-pet-absent',
  userId: 'default-user',
  vida: 0,
  nivel: 1,
  xp: 0,
  xpParaSiguienteNivel: 100,
  estadoActual: PetState.ABSENT,
  skinEquipada: 'default-cat',
  accesorios: [],
};
