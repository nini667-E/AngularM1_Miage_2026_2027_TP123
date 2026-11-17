import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar';

function render(name: string, image: string | null | undefined, size?: number): HTMLElement {
  const fixture = TestBed.createComponent(AvatarComponent);
  fixture.componentRef.setInput('name', name);
  fixture.componentRef.setInput('image', image);
  if (size) fixture.componentRef.setInput('size', size);
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('AvatarComponent', () => {
  it('sans carte : initiale en majuscule ; « ? » pour un nom vide', () => {
    const el = render('  sacha', null);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.initial')?.textContent ?? '').toBe('S');
    expect(render('   ', undefined).querySelector('.initial')?.textContent ?? '').toBe('?');
  });

  it('avec carte : son illustration, décorative (le pseudo est écrit à côté)', () => {
    const el = render('Sacha', 'https://assets.tcgdex.net/fr/sv/sv03.5/006/low.webp', 96);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://assets.tcgdex.net/fr/sv/sv03.5/006/low.webp');
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.getPropertyValue('--size')).toBe('96px');
    expect(el.querySelector('.initial')).toBeNull();
  });
});
