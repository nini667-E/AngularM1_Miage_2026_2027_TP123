import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Album } from '../../shared/models/album.model';
import { CardDetail, CardSearchResult } from '../../shared/models/card.model';
import { AddCardDialogComponent, MAX_PHOTO_SIZE } from './add-card-dialog';

const ALBUM = { id: 'a1', title: 'Mes Feu', theme: { type: 'Feu', serie: null, set: null } } as Album;
const RESULT: CardSearchResult = {
  id: 'sv03.5-006',
  name: 'Dracaufeu-ex',
  localId: '006',
  image: 'https://assets.tcgdex.net/fr/sv/sv03.5/006/low.webp',
  set: { id: 'sv03.5', name: '151' },
  compatible: true,
  reason: null,
};
const detail = (compatible: boolean, reasons: string[] = []): CardDetail => ({
  tcgdexId: 'sv03.5-006',
  name: 'Dracaufeu-ex',
  localId: '006',
  category: 'Pokémon',
  subCategory: null,
  types: ['Feu'],
  rarity: 'Double rare',
  set: { id: 'sv03.5', name: '151' },
  serie: { id: 'sv', name: 'Écarlate et Violet' },
  officialImage: { small: null, large: null },
  verdict: { compatible, reasons },
});

describe('AddCardDialogComponent', () => {
  let fixture: ComponentFixture<AddCardDialogComponent>;
  let component: AddCardDialogComponent;
  let httpMock: HttpTestingController;
  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
  let el: HTMLElement;

  beforeEach(() => {
    dialogRef = { close: vi.fn(), disableClose: false };
    TestBed.configureTestingModule({
      imports: [AddCardDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { album: ALBUM } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddCardDialogComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';
  const searchRequests = () => httpMock.match((r) => r.url === '/api/catalog/cards');

  /** Choisit une carte et répond au détail avec le verdict donné. */
  function chooseCard(verdict: CardDetail): void {
    component.select({ option: { value: RESULT } } as never);
    const req = httpMock.expectOne((r) => r.url === '/api/catalog/cards/sv03.5-006');
    expect(req.request.params.get('albumId')).toBe('a1');
    req.flush(verdict);
    fixture.detectChanges();
  }
  const photo = (type = 'image/jpeg', size = 1000) => {
    const file = new File(['x'], 'carte.jpg', { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };
  const pick = (file: File) => component.choosePhoto({ target: { files: [file] } } as never);
  /** Simule le recadreur qui signale un cadre (coordonnées non entières, comme en vrai). */
  const frame = (x1 = 10.4, y1 = 20.6, x2 = 325.2, y2 = 460.5) =>
    component.onCropped({ imagePosition: { x1, y1, x2, y2 }, base64: 'data:image/jpeg;base64,apercu' } as never);

  // ------------------------------------------------------------- recherche

  it('recherche : rien sous 2 caractères, puis une requête après 300 ms de pause', () => {
    vi.useFakeTimers();
    component.query.setValue('d');
    vi.advanceTimersByTime(300);
    expect(searchRequests().length).toBe(0);

    component.query.setValue('dra');
    component.query.setValue('dracau');
    vi.advanceTimersByTime(299);
    expect(searchRequests().length).toBe(0);
    vi.advanceTimersByTime(1);

    const [req, ...others] = searchRequests();
    expect(others.length).toBe(0);
    expect(req.request.params.get('name')).toBe('dracau');
    expect(req.request.params.get('albumId')).toBe('a1');
    req.flush([RESULT]);
    expect(component.results()).toEqual([RESULT]);
  });

  it('recherche en erreur : message, liste vide', () => {
    vi.useFakeTimers();
    component.query.setValue('dracau');
    vi.advanceTimersByTime(300);
    searchRequests()[0].flush({ message: 'Catalogue de cartes indisponible' }, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    expect(text('.error')).toContain('Catalogue de cartes indisponible');
    expect(component.results()).toEqual([]);
  });

  // ------------------------------------------------------------ verdict

  it('carte acceptée : verdict positif, « Suivant » actif', () => {
    chooseCard(detail(true));

    expect(component.cardAccepted()).toBe(true);
    expect(text('.verdict.ok')).toContain('Correspond au thème');
    const next = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Suivant'));
    expect(next?.disabled).toBe(false);
  });

  it('carte refusée : raisons affichées, impossible de passer à la photo', () => {
    chooseCard(detail(false, ["Type Eau : l'album est réservé au type Feu"]));

    expect(component.cardAccepted()).toBe(false);
    expect(text('.verdict.ko')).toContain("Type Eau : l'album est réservé au type Feu");
    const next = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Suivant'));
    expect(next?.disabled).toBe(true);
    // Même en forçant, l'envoi est bloqué.
    pick(photo());
    component.upload();
    httpMock.expectNone('/api/albums/a1/cards');
  });

  // -------------------------------------------------------------- photo

  it('photo : format ou taille refusés avant tout envoi ; photo valide acceptée', () => {
    pick(photo('image/gif'));
    expect(component.photoError()).toBe('Format non accepté : JPEG, PNG ou WebP');
    expect(component.photo()).toBeNull();

    pick(photo('image/jpeg', MAX_PHOTO_SIZE + 1));
    expect(component.photoError()).toBe('Photo trop volumineuse (10 Mo maximum)');
    expect(component.photo()).toBeNull();

    const valid = photo('image/png');
    pick(valid);
    expect(component.photoError()).toBe('');
    expect(component.photo()).toBe(valid);
  });

  // ---------------------------------------------------------- recadrage

  it('recadrage : cadre arrondi au pixel, aperçu du recadreur affiché', () => {
    pick(photo());
    expect(component.crop()).toBeNull();

    frame();
    expect(component.crop()).toEqual({ x: 10, y: 21, width: 315, height: 440 });
    expect(component.preview()).toBe('data:image/jpeg;base64,apercu');
  });

  it('rotation : quarts de tour dans les deux sens (0 à 3), cadre à recalculer', () => {
    pick(photo());
    frame();

    component.rotate(-1);
    expect(component.rotation()).toBe(3);
    expect(component.crop()).toBeNull();
    component.rotate(1);
    component.rotate(1);
    expect(component.rotation()).toBe(1);
  });

  it('nouvelle photo : rotation et cadre remis à zéro', () => {
    pick(photo());
    component.rotate(1);
    frame();

    pick(photo('image/webp'));
    expect(component.rotation()).toBe(0);
    expect(component.crop()).toBeNull();
    expect(component.preview()).toBe('');
  });

  it('image illisible par le recadreur : photo retirée, message', () => {
    pick(photo());
    component.onCropperFailed();
    expect(component.photo()).toBeNull();
    expect(component.photoError()).toBe('Impossible de lire cette image');
  });

  it('pas de cadre (recadreur pas encore prêt) : envoi bloqué', () => {
    chooseCard(detail(true));
    pick(photo());

    component.upload();
    httpMock.expectNone('/api/albums/a1/cards');
    expect(component.uploading()).toBe(false);
  });

  it('envoi : progression, fenêtre non fermable pendant l’envoi, fermée avec la carte', () => {
    chooseCard(detail(true));
    const file = photo();
    pick(file);
    component.rotate(1);
    frame();

    component.upload();
    expect(dialogRef.disableClose).toBe(true);
    const req = httpMock.expectOne('/api/albums/a1/cards');
    const body = req.request.body as FormData;
    expect(body.get('tcgdexId')).toBe('sv03.5-006');
    expect(body.get('photo')).toBe(file);
    // Seules les coordonnées partent : le serveur découpe l'original.
    expect(JSON.parse(String(body.get('crop')))).toEqual({ x: 10, y: 21, width: 315, height: 440 });
    expect(body.get('rotation')).toBe('1');

    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 200 });
    fixture.detectChanges();
    expect(component.progress()).toBe(25);
    expect(text('.photo-actions')).toContain('Envoi : 25 %');

    req.flush({ id: 'c1', name: 'Dracaufeu-ex' });
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });

  it('envoi refusé par le serveur : message, fenêtre de nouveau fermable', () => {
    chooseCard(detail(true));
    pick(photo());
    frame();

    component.upload();
    httpMock
      .expectOne('/api/albums/a1/cards')
      .flush({ message: "Le fichier n'est pas une image valide (JPEG, PNG ou WebP)" }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(component.uploadError()).toBe("Le fichier n'est pas une image valide (JPEG, PNG ou WebP)");
    expect(component.uploading()).toBe(false);
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('second clic pendant l’envoi : une seule requête', () => {
    chooseCard(detail(true));
    pick(photo());
    frame();

    component.upload();
    component.upload();

    const [req, ...others] = httpMock.match('/api/albums/a1/cards');
    expect(others.length).toBe(0);
    req.flush({ id: 'c1' });
  });
});
