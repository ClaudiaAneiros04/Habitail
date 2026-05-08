import { petAssetResolver } from '../petAssetResolver';
import { PetState } from '../../types';

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
