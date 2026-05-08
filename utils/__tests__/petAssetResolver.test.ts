import { petAssetResolver } from '../petAssetResolver';
import { PetState } from '../../types';

describe('petAssetResolver', () => {
  it('should return an emoji fallback for ABSENT state', () => {
    const asset = petAssetResolver(PetState.ABSENT);
    expect(asset.type).toBe('emoji');
    if (asset.type === 'emoji') {
      expect(asset.emoji).toBe('👻');
      expect(asset.backgroundColor).toBe('#e2e8f0');
    }
  });

  it('should return an emoji fallback for SAD state', () => {
    const asset = petAssetResolver(PetState.SAD);
    expect(asset.type).toBe('emoji');
    if (asset.type === 'emoji') {
      expect(asset.emoji).toBe('😢');
      expect(asset.backgroundColor).toBe('#fecaca');
    }
  });

  it('should return an emoji fallback for CONFUSED state', () => {
    const asset = petAssetResolver(PetState.CONFUSED);
    expect(asset.type).toBe('emoji');
    if (asset.type === 'emoji') {
      expect(asset.emoji).toBe('😵‍💫');
      expect(asset.backgroundColor).toBe('#fef08a');
    }
  });

  it('should return an emoji fallback for CHEERING state', () => {
    const asset = petAssetResolver(PetState.CHEERING);
    expect(asset.type).toBe('emoji');
    if (asset.type === 'emoji') {
      expect(asset.emoji).toBe('✨');
      expect(asset.backgroundColor).toBe('#bfdbfe');
    }
  });

  it('should return an emoji fallback for HAPPY state', () => {
    const asset = petAssetResolver(PetState.HAPPY);
    expect(asset.type).toBe('emoji');
    if (asset.type === 'emoji') {
      expect(asset.emoji).toBe('🥰');
      expect(asset.backgroundColor).toBe('#bbf7d0');
    }
  });
});
