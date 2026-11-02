import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReactionSummary } from '../../shared/models/reaction.model';
import { LikeBarComponent } from './like-bar';

const SUMMARY: ReactionSummary = {
  likeCount: 1,
  likedByMe: false,
  likers: [{ id: 'u3', name: 'Pierre' }],
  commentCount: 0,
  canLike: true,
  canComment: true,
  canReply: false,
  canRemoveLikes: false,
};

describe('LikeBarComponent', () => {
  let fixture: ComponentFixture<LikeBarComponent>;
  let component: LikeBarComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;
  let emitted: ReactionSummary[];
  let snack: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LikeBarComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** La barre, avec un parent qui reprend chaque changement (comme la page d'album). */
  function render(summary: Partial<ReactionSummary> = {}): void {
    fixture = TestBed.createComponent(LikeBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('albumId', 'a1');
    fixture.componentRef.setInput('ownerName', 'Sacha');
    fixture.componentRef.setInput('summary', { ...SUMMARY, ...summary });
    emitted = [];
    component.summaryChange.subscribe((value) => {
      emitted.push(value);
      fixture.componentRef.setInput('summary', value);
    });
    snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const heart = () => el.querySelector<HTMLButtonElement>('button.heart');
  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';

  it('aimer : cœur et compteur changent tout de suite, puis valeur du serveur', () => {
    render();
    expect(heart()?.getAttribute('aria-pressed')).toBe('false');

    heart()!.click();
    fixture.detectChanges();
    expect(emitted[0]).toEqual(expect.objectContaining({ likedByMe: true, likeCount: 2 }));
    expect(heart()?.classList.contains('liked')).toBe(true);
    expect(text('.count')).toContain('2 j’aime');

    const req = httpMock.expectOne('/api/albums/a1/likes/me');
    expect(req.request.method).toBe('PUT');
    req.flush({ likeCount: 5, likedByMe: true });
    fixture.detectChanges();
    expect(text('.count')).toContain('5 j’aime');
  });

  it('ne plus aimer : DELETE, compteur -1', () => {
    render({ likedByMe: true, likeCount: 2 });

    heart()!.click();
    const req = httpMock.expectOne('/api/albums/a1/likes/me');
    expect(req.request.method).toBe('DELETE');
    expect(emitted[0]).toEqual(expect.objectContaining({ likedByMe: false, likeCount: 1 }));
    req.flush({ likeCount: 1, likedByMe: false });
  });

  it('échec (403) : retour à l’état d’avant et message du serveur ; double clic = une requête', () => {
    render();

    component.toggle();
    component.toggle();
    httpMock
      .expectOne('/api/albums/a1/likes/me')
      .flush({ message: 'Seuls les amis du propriétaire peuvent aimer cet album' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(emitted.at(-1)).toEqual(SUMMARY);
    expect(heart()?.classList.contains('liked')).toBe(false);
    expect(snack).toHaveBeenCalledWith('Seuls les amis du propriétaire peuvent aimer cet album', 'OK', expect.objectContaining({ panelClass: 'snack-error' }));
  });

  it('propriétaire : pas de cœur, peut retirer un like reçu depuis la liste', () => {
    render({ canLike: false, canComment: false, canReply: true, canRemoveLikes: true, likeCount: 2, likers: [{ id: 'u2', name: 'Ondine' }, { id: 'u3', name: 'Pierre' }] });
    expect(heart()).toBeNull();
    // Le propriétaire répond aux commentaires : pas de message « Seuls les amis… ».
    expect(el.querySelector('.hint')).toBeNull();

    component.removeLike({ id: 'u2', name: 'Ondine' });
    const req = httpMock.expectOne('/api/albums/a1/likes/u2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(emitted[0].likers).toEqual([{ id: 'u3', name: 'Pierre' }]);
    expect(emitted[0].likeCount).toBe(1);
    expect(snack).toHaveBeenCalledWith('Like de Ondine retiré.', 'OK', expect.anything());
  });

  it('liste « Aimé par » : ouverte depuis le compteur, bouton de retrait pour le propriétaire seulement', async () => {
    render({ canLike: false, canComment: false, canReply: true, canRemoveLikes: true });
    el.querySelector<HTMLButtonElement>('button.count')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.liker .name')?.textContent ?? '').toContain('Pierre');
    expect(document.querySelector('.liker .remove-like')).not.toBeNull();
  });

  it('liste « Aimé par » vue par un ami : noms seulement, aucun bouton de retrait', async () => {
    render({ canRemoveLikes: false });
    el.querySelector<HTMLButtonElement>('button.count')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.liker .name')?.textContent ?? '').toContain('Pierre');
    expect(document.querySelector('.liker .remove-like')).toBeNull();
  });

  it('visiteur non ami : pas de cœur, compteur et message « Seuls les amis de Sacha… »', () => {
    render({ canLike: false, canComment: false, likeCount: 0, likers: [] });

    expect(heart()).toBeNull();
    expect(text('.count')).toContain('Aucun j’aime');
    expect(text('.hint')).toContain('Seuls les amis de Sacha peuvent aimer et commenter cet album.');
    component.toggle();
    httpMock.expectNone('/api/albums/a1/likes/me');
  });
});
