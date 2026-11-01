import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AlbumDetail } from '../../shared/models/album.model';
import { AuthService } from '../../shared/services/auth.service';
import { AlbumPageComponent } from './album-page';

const ALBUM: AlbumDetail = {
  id: 'a1',
  ownerId: 'owner',
  owner: { id: 'owner', name: 'Sacha' },
  title: 'Mes Dracaufeu',
  description: 'Les plus beaux',
  visibility: 'public',
  theme: { type: 'Feu', serie: null, set: null },
  cardCount: 3,
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
};

describe('AlbumPageComponent', () => {
  let fixture: ComponentFixture<AlbumPageComponent>;
  let component: AlbumPageComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlbumPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'a1' })) } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AlbumPageComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';
  function showAlbum(currentUserId: string): void {
    TestBed.inject(AuthService).currentUser.set({ id: currentUserId, name: 'X', email: 'x@x', createdAt: '' });
    httpMock.expectOne('/api/albums/a1').flush(ALBUM);
    fixture.detectChanges();
  }

  it('affiche titre, propriétaire, visibilité, description et un classeur de 9 pochettes', () => {
    showAlbum('someone-else');

    expect(text('h1')).toContain('Mes Dracaufeu');
    expect(text('.eyebrow')).toContain('Album public');
    expect(text('.eyebrow')).toContain('par Sacha');
    expect(text('.description')).toContain('Les plus beaux');
    expect(el.querySelectorAll('.pocket').length).toBe(9);
  });

  it('visiteur : ni Modifier ni Supprimer', () => {
    showAlbum('someone-else');

    expect(el.querySelector('.actions')).toBeNull();
  });

  it('propriétaire : boutons Modifier et Supprimer', () => {
    showAlbum('owner');

    expect(text('.actions')).toContain('Modifier');
    expect(el.querySelector('.actions button[aria-label="Supprimer l\'album"]')).not.toBeNull();
  });

  it('404 (inexistant ou privé d’un autre) : « Album introuvable »', () => {
    httpMock.expectOne('/api/albums/a1').flush({ message: 'Album inconnu' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(text('.message h1')).toContain('Album introuvable');
    expect(el.querySelector('.banner')).toBeNull();
  });

  it('suppression confirmée : DELETE, SnackBar, retour à « Mes albums »', () => {
    showAlbum('owner');
    vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(true) } as never);
    const snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    component.confirmDelete();
    const req = httpMock.expectOne('/api/albums/a1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(snack).toHaveBeenCalledWith('Album « Mes Dracaufeu » supprimé.', 'OK', expect.objectContaining({ panelClass: 'snack-success' }));
    expect(navigate).toHaveBeenCalledWith('/albums');
  });

  it('suppression annulée : aucune requête', () => {
    showAlbum('owner');
    vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(false) } as never);

    component.confirmDelete();

    httpMock.expectNone('/api/albums/a1');
  });

  it('modification enregistrée : la page se met à jour sans rechargement', () => {
    showAlbum('owner');
    vi.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of({ ...ALBUM, title: 'Nouveau titre', visibility: 'private' }),
    } as never);
    vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);

    component.edit();
    fixture.detectChanges();

    expect(text('h1')).toContain('Nouveau titre');
    expect(text('.eyebrow')).toContain('Album privé');
    // Le propriétaire (absent de la réponse PUT) est conservé.
    expect(text('.eyebrow')).toContain('par Sacha');
  });
});
