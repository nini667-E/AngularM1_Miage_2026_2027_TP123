import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { User } from '../../shared/models/user.model';
import { ProfilePageComponent } from './profile-page';

const ME: User = { id: 'me', name: 'Sacha', email: 'sacha@example.com', bio: 'Fan de Feu', avatar: null, createdAt: '2026-11-01' };
const result = (id: string, name: string, image: string | null) => ({ id, name, localId: '1', image, set: { id: 's', name: '151' }, compatible: true, reason: null });

describe('ProfilePageComponent (modifier mon profil)', () => {
  let fixture: ComponentFixture<ProfilePageComponent>;
  let component: ProfilePageComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;
  let snack: ReturnType<typeof vi.spyOn>;

  function render(user: User = ME): void {
    TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfilePageComponent);
    component = fixture.componentInstance;
    snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);
    el = fixture.nativeElement;
    fixture.detectChanges();
    httpMock.expectOne('/api/users/me').flush(user);
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  const text = (selector: string) => (el.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const putRequest = () => httpMock.expectOne((r) => r.method === 'PUT' && r.url === '/api/users/me');

  it('chargé depuis /api/users/me : pseudo et bio dans le formulaire, compteur de la bio, lien vers ma page', () => {
    render();
    expect(component.form.getRawValue()).toEqual({ name: 'Sacha', bio: 'Fan de Feu' });
    expect(text('mat-hint')).toBe('10 / 300');
    expect(el.querySelector('a.public-link')?.getAttribute('href')).toBe('/users/me');
    expect(text('.current')).toContain('Pas encore d’avatar');
  });

  it('enregistrer : seuls les champs modifiés, nettoyés ; SnackBar', () => {
    render();
    component.form.setValue({ name: 'Sacha', bio: '  Fan de Psy  ' });
    component.save();

    const req = putRequest();
    expect(req.request.body).toEqual({ bio: 'Fan de Psy' });
    req.flush({ ...ME, bio: 'Fan de Psy' });
    expect(snack).toHaveBeenCalledWith('Profil enregistré.', 'OK', expect.objectContaining({ panelClass: 'snack-success' }));
  });

  it('rien de modifié : aucune requête ; pseudo trop court : bouton inactif, aucune requête', () => {
    render();
    component.save();
    expect(snack).toHaveBeenCalledWith('Rien à enregistrer.', 'OK', expect.anything());

    component.form.controls.name.setValue('S');
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('button.save')?.disabled).toBe(true);
    component.save();
    httpMock.expectNone((r) => r.method === 'PUT');
  });

  it('avatar : recherche (300 ms), cartes sans illustration écartées, choix, aperçu, envoi de avatarId seul', () => {
    render();
    vi.useFakeTimers();
    component.avatarQuery.setValue('mew');
    vi.advanceTimersByTime(300);
    const search = httpMock.expectOne((r) => r.url === '/api/catalog/cards');
    expect([search.request.params.get('name'), search.request.params.has('albumId')]).toEqual(['mew', false]);
    search.flush([result('sv03.5-150', 'Mewtwo', '/mewtwo/low.webp'), result('x-1', 'Mew sans image', null)]);
    fixture.detectChanges();

    const choices = el.querySelectorAll<HTMLButtonElement>('.results .choice');
    expect(choices.length).toBe(1);
    choices[0].click();
    fixture.detectChanges();
    expect(el.querySelector('.identity app-avatar img')?.getAttribute('src')).toBe('/mewtwo/low.webp');
    expect(text('.current')).toContain('Nouvel avatar : Mewtwo');

    component.save();
    const req = putRequest();
    expect(req.request.body).toEqual({ avatarId: 'sv03.5-150' });
    req.flush({ ...ME, avatar: { tcgdexId: 'sv03.5-150', name: 'Mewtwo', image: '/mewtwo/low.webp' } });
    fixture.detectChanges();
    expect(component.avatarChoice().kind).toBe('keep');
    expect(text('.current')).toContain('Avatar actuel : Mewtwo');
  });

  it('retirer l’avatar : avatarId null envoyé, l’initiale revient dans l’aperçu', () => {
    render({ ...ME, avatar: { tcgdexId: 'sv03.5-150', name: 'Mewtwo', image: '/mewtwo/low.webp' } });
    el.querySelector<HTMLButtonElement>('button.remove-avatar')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.identity app-avatar img')).toBeNull();

    component.save();
    const req = putRequest();
    expect(req.request.body).toEqual({ avatarId: null });
    req.flush({ ...ME, avatar: null });
  });

  it('erreur du serveur : message, bouton réactivé ; double envoi impossible', () => {
    render();
    component.form.controls.bio.setValue('Nouvelle bio');
    component.save();
    component.save();
    putRequest().flush({ message: 'Bio trop longue (300 caractères maximum)' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(snack).toHaveBeenCalledWith('Bio trop longue (300 caractères maximum)', 'OK', expect.objectContaining({ panelClass: 'snack-error' }));
    expect(component.saving()).toBe(false);
  });
});
