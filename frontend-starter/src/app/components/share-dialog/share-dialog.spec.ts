import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Album, AlbumShare } from '../../shared/models/album.model';
import { ShareDialogComponent } from './share-dialog';

const ALBUM: Album = {
  id: 'a1',
  ownerId: 'me',
  title: 'Mes Psy',
  description: '',
  visibility: 'private',
  theme: { type: null, serie: null, set: null },
  cardCount: 2,
  sharedCount: 1,
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
};
const share = (id: string, name: string, shared: boolean): AlbumShare => ({ user: { id, name }, shared });

describe('ShareDialogComponent', () => {
  let fixture: ComponentFixture<ShareDialogComponent>;
  let component: ShareDialogComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;
  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean };

  beforeEach(() => {
    dialogRef = { close: vi.fn(), disableClose: false };
    TestBed.configureTestingModule({
      imports: [ShareDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: { album: ALBUM } },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ShareDialogComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';
  const saveButton = () => el.querySelector<HTMLButtonElement>('button.save');
  const options = () => Array.from(el.querySelectorAll<HTMLElement>('mat-list-option'));

  function flushShares(shares: AlbumShare[]): void {
    httpMock.expectOne('/api/albums/a1/shares').flush(shares);
    fixture.detectChanges();
  }

  it('liste mes amis, déjà cochés s’ils reçoivent l’album ; Enregistrer inactif sans changement', () => {
    flushShares([share('u2', 'Ondine', false), share('u3', 'Pierre', true)]);

    expect(options().map((o) => (o.textContent ?? '').trim())).toEqual([
      expect.stringContaining('Ondine'),
      expect.stringContaining('Pierre'),
    ]);
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(text('.summary')).toContain('Partagé avec 1 ami');
    expect(saveButton()?.disabled).toBe(true);
  });

  it('cocher un ami puis Enregistrer : PUT avec la nouvelle liste, fenêtre fermée avec l’album', () => {
    flushShares([share('u2', 'Ondine', false), share('u3', 'Pierre', true)]);

    options()[0].click();
    fixture.detectChanges();
    expect(text('.summary')).toContain('Partagé avec 2 amis');
    expect(saveButton()?.disabled).toBe(false);

    saveButton()!.click();
    const req = httpMock.expectOne('/api/albums/a1/shares');
    expect(req.request.method).toBe('PUT');
    expect([...req.request.body.userIds].sort()).toEqual(['u2', 'u3']);
    expect(dialogRef.disableClose).toBe(true);
    req.flush({ ...ALBUM, sharedCount: 2 });

    expect(dialogRef.close).toHaveBeenCalledWith({ ...ALBUM, sharedCount: 2 });
  });

  it('tout décocher : arrête le partage (liste vide envoyée)', () => {
    flushShares([share('u3', 'Pierre', true)]);

    options()[0].click();
    fixture.detectChanges();
    expect(text('.summary')).toContain('Visible par toi seul');
    saveButton()!.click();

    const req = httpMock.expectOne('/api/albums/a1/shares');
    expect(req.request.body).toEqual({ userIds: [] });
    req.flush({ ...ALBUM, sharedCount: 0 });
  });

  it('erreur à l’enregistrement : message, fenêtre ouverte et refermable, une seule requête même en double clic', () => {
    flushShares([share('u2', 'Ondine', false)]);
    options()[0].click();
    fixture.detectChanges();

    component.save();
    component.save();
    httpMock
      .expectOne('/api/albums/a1/shares')
      .flush({ message: "Tu ne peux partager un album qu'avec tes amis" }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(text('.save-error')).toContain("Tu ne peux partager un album qu'avec tes amis");
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(dialogRef.disableClose).toBe(false);
    expect(saveButton()?.disabled).toBe(false);
  });

  it('aucun ami : message et lien vers la page Amis, pas de bouton Enregistrer', () => {
    flushShares([]);

    expect(text('.no-friends')).toContain('le partage est réservé à tes amis');
    expect(el.querySelector('.no-friends a')?.getAttribute('href')).toBe('/friends');
    expect(saveButton()).toBeNull();
  });

  it('erreur de chargement : message, pas d’état « aucun ami » trompeur', () => {
    httpMock.expectOne('/api/albums/a1/shares').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(text('.load-error')).toContain('Impossible de charger tes amis');
    expect(el.querySelector('.no-friends')).toBeNull();
  });
});
