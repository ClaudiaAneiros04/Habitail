import { petAssetResolver, getPetState, applyHealthDelta, HabitCheckInResult } from '../petLogic';
import { PetState, Priority } from '../../types';

describe('petLogic', () => {
  describe('getPetState', () => {
    it('should throw an error if vida is not an integer between 0 and 100', () => {
      expect(() => getPetState(-1)).toThrow();
      expect(() => getPetState(101)).toThrow();
      expect(() => getPetState(50.5)).toThrow();
      expect(() => getPetState(NaN)).toThrow();
    });

    it('should return ABSENT for vida = 0', () => {
      expect(getPetState(0)).toBe(PetState.ABSENT);
    });

    it('should return SAD for vida between 1 and 25', () => {
      expect(getPetState(1)).toBe(PetState.SAD);
      expect(getPetState(15)).toBe(PetState.SAD);
      expect(getPetState(25)).toBe(PetState.SAD);
    });

    it('should return CONFUSED for vida between 26 and 50', () => {
      expect(getPetState(26)).toBe(PetState.CONFUSED);
      expect(getPetState(38)).toBe(PetState.CONFUSED);
      expect(getPetState(50)).toBe(PetState.CONFUSED);
    });

    it('should return CHEERING for vida between 51 and 75', () => {
      expect(getPetState(51)).toBe(PetState.CHEERING);
      expect(getPetState(60)).toBe(PetState.CHEERING);
      expect(getPetState(75)).toBe(PetState.CHEERING);
    });

    it('should return HAPPY for vida between 76 and 100', () => {
      expect(getPetState(76)).toBe(PetState.HAPPY);
      expect(getPetState(88)).toBe(PetState.HAPPY);
      expect(getPetState(100)).toBe(PetState.HAPPY);
    });
  });

  describe('petAssetResolver', () => {
    const states = [
      PetState.ABSENT,
      PetState.SAD,
      PetState.CONFUSED,
      PetState.CHEERING,
      PetState.HAPPY
    ];

    it('should return a valid PetAsset for each of the 5 mandatory states', () => {
      states.forEach(state => {
        const asset = petAssetResolver(state);
        expect(asset).toBeDefined();
        expect(['emoji', 'image']).toContain(asset.type);
      });
    });

    it('should activate fallback emoji/color when image assets are disabled', () => {
      // Note: USE_IMAGE_ASSETS is currently false in implementation
      states.forEach(state => {
        const asset = petAssetResolver(state);
        expect(asset.type).toBe('emoji');
        if (asset.type === 'emoji') {
          expect(typeof asset.emoji).toBe('string');
          expect(asset.emoji.length).toBeGreaterThan(0);
          expect(asset.backgroundColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      });
    });

    it('should maintain a consistent discriminated union type (no field mixing)', () => {
      states.forEach(state => {
        const asset = petAssetResolver(state);
        
        if (asset.type === 'emoji') {
          expect(asset).toHaveProperty('emoji');
          expect(asset).toHaveProperty('backgroundColor');
          expect(asset).not.toHaveProperty('source');
        } else if (asset.type === 'image') {
          expect(asset).toHaveProperty('source');
          expect(asset).not.toHaveProperty('emoji');
          expect(asset).not.toHaveProperty('backgroundColor');
        }
      });
    });

    it('should provide a defined fallback even if an unknown state is passed (defensive programming)', () => {
      // @ts-ignore - testing runtime robustness for non-TS consumers
      const asset = petAssetResolver('UNKNOWN_STATE');
      expect(asset).toBeDefined();
      expect(asset.type).toBe('emoji');
    });
  });

  describe('applyHealthDelta', () => {
    it('should return the current life if habits array is empty', () => {
      expect(applyHealthDelta(50, [])).toBe(50);
      expect(applyHealthDelta(100, [])).toBe(100);
      expect(applyHealthDelta(0, [])).toBe(0);
    });

    it('should apply positive deltas for completed habits correctly', () => {
      const habitos: HabitCheckInResult[] = [
        { id: '1', prioridad: Priority.ESSENTIAL, completado: true }, // +20
        { id: '2', prioridad: Priority.NORMAL, completado: true },    // +10
        { id: '3', prioridad: Priority.FLEXIBLE, completado: true }   // +5
      ];
      // 50 + 20 + 10 + 5 = 85
      expect(applyHealthDelta(50, habitos)).toBe(85);
    });

    it('should apply negative deltas for failed habits correctly', () => {
      const habitos: HabitCheckInResult[] = [
        { id: '1', prioridad: Priority.ESSENTIAL, completado: false }, // -20
        { id: '2', prioridad: Priority.NORMAL, completado: false },    // -10
        { id: '3', prioridad: Priority.FLEXIBLE, completado: false }   // -5
      ];
      // 80 - 20 - 10 - 5 = 45
      expect(applyHealthDelta(80, habitos)).toBe(45);
    });

    it('should mix positive and negative deltas correctly', () => {
      const habitos: HabitCheckInResult[] = [
        { id: '1', prioridad: Priority.ESSENTIAL, completado: true },  // +20
        { id: '2', prioridad: Priority.NORMAL, completado: false },    // -10
      ];
      // 50 + 20 - 10 = 60
      expect(applyHealthDelta(50, habitos)).toBe(60);
    });

    it('should clamp the final health strictly to [0, 100]', () => {
      const habitosMax: HabitCheckInResult[] = [
        { id: '1', prioridad: Priority.ESSENTIAL, completado: true }, // +20
      ];
      // 90 + 20 = 110 -> 100
      expect(applyHealthDelta(90, habitosMax)).toBe(100);

      const habitosMin: HabitCheckInResult[] = [
        { id: '1', prioridad: Priority.ESSENTIAL, completado: false }, // -20
      ];
      // 10 - 20 = -10 -> 0
      expect(applyHealthDelta(10, habitosMin)).toBe(0);
    });

    it('should handle missing or invalid priority by defaulting to 0 delta', () => {
      const habitos: HabitCheckInResult[] = [
        { id: '1', prioridad: 'UNKNOWN_PRIORITY', completado: true },
      ];
      // 50 + 0 = 50
      expect(applyHealthDelta(50, habitos)).toBe(50);
    });
  });
});
