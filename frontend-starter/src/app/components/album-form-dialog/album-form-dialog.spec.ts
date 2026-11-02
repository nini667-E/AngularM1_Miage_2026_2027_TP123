import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Album } from '../../shared/models/album.model';
import { AlbumFormDialogComponent, AlbumFormDialogData } from './album-form-dialog';

const SERIES = [
  { id: 'sv', name: 'Écarlate et Violet', logo: null },
  { id: 'swsh', name: 'Épée et Bouclier', logo: null },
];
const SV_SETS = [
  { id: 'sv01', name: 'Écarlate et Violet', logo: null, cardCount: 198 },
  { id: 'sv03.5', name: '151', logo: null, cardCount: 165 },
];
const ALBUM: Album = {
  id: 'a1',
  ownerId: 'u1',
  title: 'Mes 151',
  description: 'Ma collection',
  visibility: 'public',
  theme: {
    type: 'Psy',
    serie: { id: 'sv', name: 'Écarlate et Violet', logo: null },
    set: { id: 'sv03.5', name: '151', logo: null },
  },
  cardCount: 0,
  sharedCount: 0,
  likeCount: 0,
  commentCount: 0,
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
};

// Limite portée à 15 s pour ce fichier (02/11/2026) : son premier test paie
// le premier affichage des champs Material (select, extension…) pendant que
// les autres fichiers tournent en parallèle, et dépassait parfois les 5 s
// par défaut (jusqu'à 9,6 s mesurés) sans aucune erreur de logique.
describe('AlbumFormDialogComponent', { timeout: 15_000 }, () => {
  let fixture: ComponentFixture<AlbumFormDialogComponent>;
  let component: AlbumFormDialogComponent;
  let httpMock: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;

  function setup(data: AlbumFormDialogData): void {
    close = vi.fn();
    TestBed.configureTestingModule({
      imports: [AlbumFormDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AlbumFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // Listes du catalogue chargées à l'ouverture.
    httpMock.expectOne('/api/catalog/types').flush(['Eau', 'Feu', 'Psy']);
    httpMock.expectOne('/api/catalog/series').flush(SERIES);
  }

  afterEach(() => httpMock.verify());

  const controls = () => component.form.controls;
  const text = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent ?? '';

  it('création : privé par défaut, extension désactivée tant qu’aucune série n’est choisie', () => {
    setup({});

    expect(controls().visibility.value).toBe('private');
    expect(controls().setId.disabled).toBe(true);
  });

  it('choisir une série charge ses extensions ; en changer vide l’extension', () => {
    setup({});

    controls().serieId.setValue('sv');
    httpMock.expectOne('/api/catalog/series/sv/sets').flush(SV_SETS);
    expect(controls().setId.enabled).toBe(true);
    controls().setId.setValue('sv01');

    controls().serieId.setValue('swsh');
    // L'ancienne extension (sv01) n'appartient pas à la nouvelle série.
    expect(controls().setId.value).toBe('');
    expect(controls().setId.disabled).toBe(true);
    httpMock.expectOne('/api/catalog/series/swsh/sets').flush([]);
  });

  it('envoi : POST avec uniquement les éléments de thème choisis, puis fermeture avec l’album', () => {
    setup({});
    component.form.patchValue({ title: '  Mes Eau  ', type: 'Eau' });

    component.submit();
    const req = httpMock.expectOne('/api/albums');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      title: 'Mes Eau',
      description: '',
      visibility: 'private',
      theme: { type: 'Eau' },
    });
    req.flush({ ...ALBUM, id: 'new' });

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
  });

  it('sans thème (collection libre) : theme vide, aucun champ vide envoyé', () => {
    setup({});
    component.form.patchValue({ title: 'Vrac', visibility: 'public' });

    component.submit();
    const req = httpMock.expectOne('/api/albums');
    expect(req.request.body.theme).toEqual({});
    req.flush({ ...ALBUM, id: 'vrac' });
  });

  it('titre vide : aucun envoi', () => {
    setup({});

    component.submit();

    httpMock.expectNone('/api/albums');
    expect(close).not.toHaveBeenCalled();
  });

  it('erreur serveur : message affiché, la fenêtre reste ouverte et réutilisable', () => {
    setup({});
    component.form.patchValue({ title: 'Test', type: 'Feu' });

    component.submit();
    httpMock
      .expectOne('/api/albums')
      .flush({ message: 'Catalogue de cartes indisponible' }, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    expect(text('.error')).toContain('Catalogue de cartes indisponible');
    expect(close).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
  });

  it('modification : formulaire pré-rempli (extension comprise) puis PUT', () => {
    setup({ album: ALBUM });
    httpMock.expectOne('/api/catalog/series/sv/sets').flush(SV_SETS);

    expect(component.form.getRawValue()).toEqual({
      title: 'Mes 151',
      description: 'Ma collection',
      visibility: 'public',
      type: 'Psy',
      serieId: 'sv',
      setId: 'sv03.5',
    });

    component.form.patchValue({ visibility: 'private' });
    component.submit();
    const req = httpMock.expectOne('/api/albums/a1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(
      expect.objectContaining({ visibility: 'private', theme: { type: 'Psy', serieId: 'sv', setId: 'sv03.5' } }),
    );
    req.flush(ALBUM);
  });
});
