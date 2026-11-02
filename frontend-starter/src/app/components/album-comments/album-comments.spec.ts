import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { AlbumComment } from '../../shared/models/reaction.model';
import { AlbumCommentsComponent } from './album-comments';

const comment = (id: string, name: string, text: string, canDelete = false): AlbumComment => ({
  id,
  albumId: 'a1',
  author: { id: `u-${name}`, name },
  text,
  createdAt: '2026-11-02T10:30:00.000Z',
  canDelete,
  parentId: null,
  replies: [],
});

describe('AlbumCommentsComponent', () => {
  let fixture: ComponentFixture<AlbumCommentsComponent>;
  let component: AlbumCommentsComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;
  let snack: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlbumCommentsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(canComment: boolean): void {
    fixture = TestBed.createComponent(AlbumCommentsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('albumId', 'a1');
    fixture.componentRef.setInput('canComment', canComment);
    snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const listRequest = (page: number) =>
    httpMock.expectOne((r) => r.url === '/api/albums/a1/comments' && r.params.get('page') === String(page));
  const flushList = (page: number, items: AlbumComment[], total: number) => {
    listRequest(page).flush({ items, page, limit: 10, total, pages: Math.ceil(total / 10) });
    fixture.detectChanges();
  };
  const texts = () => Array.from(el.querySelectorAll('.comment .text')).map((t) => t.textContent ?? '');
  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';

  it('liste : auteur, date, texte ; supprimer seulement si canDelete ; pas de formulaire en lecture seule', () => {
    render(false);
    flushList(1, [comment('c1', 'Ondine', 'Superbe', true), comment('c2', 'Pierre', 'Joli')], 2);

    expect(texts()).toEqual(['Superbe', 'Joli']);
    expect(text('.comment .meta')).toContain('Ondine');
    expect(text('.comment .meta')).toContain('02/11/2026');
    expect(el.querySelectorAll('.comment .delete').length).toBe(1);
    expect(el.querySelector('form')).toBeNull();
    expect(text('h2')).toContain('(2)');
  });

  it('vide : message selon les droits', () => {
    render(true);
    flushList(1, [], 0);
    expect(text('.empty')).toContain('sois le premier à commenter');
  });

  it('« Afficher plus » : page suivante, commentaires déjà affichés ignorés', () => {
    render(false);
    flushList(1, Array.from({ length: 10 }, (_, i) => comment(`c${i}`, 'Ondine', `n°${i}`)), 12);
    expect(el.querySelector('button.more')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('button.more')!.click();
    // La page 2 recontient c9 (décalage après un ajout ailleurs) : pas de doublon.
    flushList(2, [comment('c9', 'Ondine', 'n°9'), comment('c10', 'Pierre', 'n°10'), comment('c11', 'Pierre', 'n°11')], 12);

    expect(texts().length).toBe(12);
    expect(el.querySelector('button.more')).toBeNull();
  });

  it('publier : texte nettoyé, commentaire en tête, compteur +1, champ vidé', () => {
    render(true);
    flushList(1, [comment('c1', 'Pierre', 'Joli')], 1);

    const publish = () => el.querySelector<HTMLButtonElement>('button.publish')!;
    expect(publish().disabled).toBe(true);
    component.text.setValue('   ');
    fixture.detectChanges();
    expect(publish().disabled).toBe(true);

    component.text.setValue('  Belle collection  ');
    fixture.detectChanges();
    expect(text('mat-hint')).toContain('20 / 500');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const req = httpMock.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({ text: 'Belle collection' });
    req.flush(comment('c9', 'Moi', 'Belle collection', true));
    fixture.detectChanges();

    expect(texts()).toEqual(['Belle collection', 'Joli']);
    expect(text('h2')).toContain('(2)');
    expect(component.text.value).toBe('');
    expect(snack).toHaveBeenCalledWith('Commentaire publié.', 'OK', expect.anything());
  });

  it('publication refusée : message, texte gardé ; double envoi impossible', () => {
    render(true);
    flushList(1, [], 0);
    component.text.setValue('Coucou');

    component.post();
    component.post();
    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush({ message: 'Seuls les amis du propriétaire peuvent commenter cet album' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(text('.post-error')).toContain('Seuls les amis du propriétaire peuvent commenter cet album');
    expect(component.text.value).toBe('Coucou');
  });

  it('supprimer : confirmation, DELETE, retiré de la liste ; annulé = aucune requête', () => {
    render(false);
    flushList(1, [comment('c1', 'Ondine', 'Superbe', true), comment('c2', 'Pierre', 'Joli')], 2);
    vi.spyOn(component['dialog'], 'open')
      .mockReturnValueOnce({ afterClosed: () => of(false) } as never)
      .mockReturnValueOnce({ afterClosed: () => of(true) } as never);

    el.querySelector<HTMLButtonElement>('.comment .delete')!.click();
    httpMock.expectNone('/api/comments/c1');

    el.querySelector<HTMLButtonElement>('.comment .delete')!.click();
    httpMock.expectOne('/api/comments/c1').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(texts()).toEqual(['Joli']);
    expect(text('h2')).toContain('(1)');
    expect(snack).toHaveBeenCalledWith('Commentaire supprimé.', 'OK', expect.anything());
  });

  it('erreur de chargement : message, pas d’état vide trompeur', () => {
    render(true);
    listRequest(1).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(text('.load-error')).toContain('Impossible de charger les commentaires');
    expect(el.querySelector('.empty')).toBeNull();
  });

  // ---------------------------------------------- réponses du propriétaire

  function renderOwner(): void {
    fixture = TestBed.createComponent(AlbumCommentsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('albumId', 'a1');
    fixture.componentRef.setInput('canComment', false);
    fixture.componentRef.setInput('canReply', true);
    snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const reply = (id: string, parentId: string, text: string): AlbumComment => ({
    ...comment(id, 'Sacha', text, true),
    parentId,
  });

  it('propriétaire : pas de formulaire principal, « Répondre » sous chaque commentaire, réponses affichées avec le badge', () => {
    renderOwner();
    flushList(1, [{ ...comment('c1', 'Ondine', 'Superbe', true), replies: [reply('r1', 'c1', 'Merci !')] }, comment('c2', 'Pierre', 'Joli', true)], 2);

    expect(el.querySelector('form.comment-form')).toBeNull();
    expect(el.querySelectorAll('button.reply-button').length).toBe(2);
    const replies = el.querySelectorAll('.replies .reply');
    expect(replies.length).toBe(1);
    expect(replies[0].querySelector('.owner-badge')?.textContent ?? '').toContain('propriétaire');
    expect(replies[0].querySelector('.text')?.textContent ?? '').toBe('Merci !');
  });

  it('propriétaire sans commentaire : message « tu pourras leur répondre »', () => {
    renderOwner();
    flushList(1, [], 0);
    expect(text('.empty')).toContain('tu pourras leur répondre ici');
  });

  it('répondre : formulaire sous le commentaire, POST avec parentId, réponse ajoutée dessous, formulaire fermé', () => {
    renderOwner();
    flushList(1, [comment('c1', 'Ondine', 'Superbe', true), comment('c2', 'Pierre', 'Joli', true)], 2);

    el.querySelectorAll<HTMLButtonElement>('button.reply-button')[0].click();
    fixture.detectChanges();
    expect(el.querySelectorAll('form.reply-form').length).toBe(1);
    expect(el.querySelectorAll('button.reply-button').length).toBe(1);
    expect(el.querySelector<HTMLButtonElement>('button.publish-reply')!.disabled).toBe(true);

    component.replyText.setValue('  Merci Ondine !  ');
    fixture.detectChanges();
    el.querySelector('form.reply-form')!.dispatchEvent(new Event('submit'));
    const req = httpMock.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({ text: 'Merci Ondine !', parentId: 'c1' });
    req.flush(reply('r9', 'c1', 'Merci Ondine !'));
    fixture.detectChanges();

    const threads = el.querySelectorAll('.thread');
    expect(threads[0].querySelector('.replies .text')?.textContent ?? '').toBe('Merci Ondine !');
    expect(threads[1].querySelector('.replies')).toBeNull();
    expect(el.querySelector('form.reply-form')).toBeNull();
    expect(text('h2')).toContain('(2)');
    expect(snack).toHaveBeenCalledWith('Réponse publiée.', 'OK', expect.anything());
  });

  it('réponse refusée : message, formulaire gardé ; Annuler le ferme', () => {
    renderOwner();
    flushList(1, [comment('c1', 'Ondine', 'Superbe', true)], 1);
    component.startReply(component.comments()[0]);
    component.replyText.setValue('Merci');
    component.postReply(component.comments()[0]);
    component.postReply(component.comments()[0]);
    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush({ message: 'Commentaire inconnu' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(text('.reply-error')).toContain('Commentaire inconnu');
    expect(el.querySelector('form.reply-form')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('button.cancel-reply')!.click();
    fixture.detectChanges();
    expect(el.querySelector('form.reply-form')).toBeNull();
  });

  it('supprimer une réponse : confirmation, DELETE, retirée de son commentaire (nombre de commentaires inchangé)', () => {
    renderOwner();
    flushList(1, [{ ...comment('c1', 'Ondine', 'Superbe', true), replies: [reply('r1', 'c1', 'Merci !')] }], 1);
    vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(true) } as never);

    el.querySelector<HTMLButtonElement>('.delete-reply')!.click();
    httpMock.expectOne('/api/comments/r1').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(el.querySelector('.replies')).toBeNull();
    expect(texts()).toEqual(['Superbe']);
    expect(text('h2')).toContain('(1)');
    expect(snack).toHaveBeenCalledWith('Réponse supprimée.', 'OK', expect.anything());
  });

  it('ami : il commente mais ne répond pas (aucun bouton « Répondre »)', () => {
    render(true);
    flushList(1, [comment('c1', 'Pierre', 'Joli')], 1);
    expect(el.querySelector('form.comment-form')).not.toBeNull();
    expect(el.querySelector('button.reply-button')).toBeNull();
  });
});
