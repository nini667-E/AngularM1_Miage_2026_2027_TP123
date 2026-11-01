import { describe, expect, it } from 'vitest';
import { typeColor, typeIcon, typeSlug } from './card-types';

describe('card-types', () => {
  it('typeSlug retire accents et majuscules (noms TCGdex)', () => {
    expect(typeSlug('Électrique')).toBe('electrique');
    expect(typeSlug('Obscurité')).toBe('obscurite');
    expect(typeSlug('Fée')).toBe('fee');
    expect(typeSlug('Métal')).toBe('metal');
  });

  it('typeColor : variable CSS du type, or de la marque sinon', () => {
    expect(typeColor('Feu')).toBe('var(--cv-type-feu)');
    expect(typeColor('Électrique')).toBe('var(--cv-type-electrique)');
    expect(typeColor('Lumière')).toBe('var(--mat-sys-primary)');
    expect(typeColor(null)).toBe('var(--mat-sys-primary)');
  });

  it('typeIcon : icône du type, icône générique sinon', () => {
    expect(typeIcon('Eau')).toBe('water_drop');
    expect(typeIcon(undefined)).toBe('style');
    expect(typeIcon('Lumière')).toBe('style');
  });
});
