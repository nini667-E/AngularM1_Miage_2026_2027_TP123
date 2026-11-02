import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReactionService } from './reaction.service';

describe('ReactionService', () => {
  let service: ReactionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReactionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('likes : résumé, aimer, ne plus aimer, retirer un like reçu (identifiants encodés)', () => {
    service.summary('a/1').subscribe();
    service.like('a1').subscribe();
    service.unlike('a1').subscribe();
    service.removeLike('a1', 'u/2').subscribe();

    expect(httpMock.expectOne('/api/albums/a%2F1/reactions').request.method).toBe('GET');
    expect(httpMock.expectOne((r) => r.method === 'PUT').request.url).toBe('/api/albums/a1/likes/me');
    expect(httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/likes/me')).request.url).toBe('/api/albums/a1/likes/me');
    expect(httpMock.expectOne('/api/albums/a1/likes/u%2F2').request.method).toBe('DELETE');
  });

  it('commentaires : liste paginée, publication avec le texte, suppression', () => {
    service.comments('a1', 2, 10).subscribe();
    service.addComment('a1', 'Superbe').subscribe();
    service.addComment('a1', 'Merci', 'c1').subscribe();
    service.deleteComment('c1').subscribe();

    const list = httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/albums/a1/comments');
    expect([list.request.params.get('page'), list.request.params.get('limit')]).toEqual(['2', '10']);
    const [post, answer] = httpMock.match((r) => r.method === 'POST');
    expect(post.request.url).toBe('/api/albums/a1/comments');
    expect(post.request.body).toEqual({ text: 'Superbe' });
    // Réponse du propriétaire : parentId du commentaire visé.
    expect(answer.request.body).toEqual({ text: 'Merci', parentId: 'c1' });
    expect(httpMock.expectOne('/api/comments/c1').request.method).toBe('DELETE');
  });
});
