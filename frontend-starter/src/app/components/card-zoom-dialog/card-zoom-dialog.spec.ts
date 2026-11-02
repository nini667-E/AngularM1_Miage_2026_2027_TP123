import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AlbumCard } from '../../shared/models/card.model';
import { CardZoomDialogComponent } from './card-zoom-dialog';

const CARD = {
  id: 'c1',
  name: 'Hyper Ball',
  localId: '196',
  category: 'Dresseur',
  subCategory: 'Objet',
  types: [],
  rarity: 'Peu Commune',
  set: { id: 'sv01', name: 'Écarlate et Violet' },
  serie: { id: 'sv', name: 'Écarlate et Violet' },
  officialImage: { small: null, large: 'https://assets.tcgdex.net/x/high.webp' },
  photo: { thumb: '/api/images/c1/thumb?exp=1&sig=x', full: '/api/images/c1/full?exp=1&sig=x' },
  createdAt: '2026-11-01',
} as unknown as AlbumCard;

function render(canDelete: boolean, ownerName: string | null = null): HTMLElement {
  TestBed.configureTestingModule({
    imports: [CardZoomDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: { card: CARD, canDelete, ownerName } }],
  });
  const fixture = TestBed.createComponent(CardZoomDialogComponent);
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('CardZoomDialogComponent', () => {
  it('photo en grand format + image officielle + informations', () => {
    const el = render(false);

    expect(el.querySelector('img.photo')?.getAttribute('src')).toBe('/api/images/c1/full?exp=1&sig=x');
    expect(el.querySelector('img.official')?.getAttribute('src')).toBe('https://assets.tcgdex.net/x/high.webp');
    expect(el.querySelector('.facts')?.textContent ?? '').toContain('Dresseur · Objet');
    expect(el.querySelector('.facts')?.textContent ?? '').toContain('Écarlate et Violet · n° 196');
  });

  it('« Retirer du classeur » réservé au propriétaire', () => {
    expect(render(false).textContent ?? '').not.toContain('Retirer du classeur');
    TestBed.resetTestingModule();
    expect(render(true).textContent ?? '').toContain('Retirer du classeur');
  });

  it('légende de la photo : « Ta photo » dans mes albums, « Photo de X » dans l’album d’un autre', () => {
    expect(render(true).querySelector('figcaption')?.textContent ?? '').toBe('Ta photo');
    TestBed.resetTestingModule();
    expect(render(false, 'ClaudeTestBot').querySelector('figcaption')?.textContent ?? '').toBe('Photo de ClaudeTestBot');
  });
});
