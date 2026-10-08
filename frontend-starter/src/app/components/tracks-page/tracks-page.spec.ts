import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { Track } from '../../shared/models/track.model';
import { TracksPageComponent } from './tracks-page';

const TRACK: Track = {
  id: 't1',
  title: 'Blues en La',
  originalName: 'blues.mp3',
  mimeType: 'audio/mpeg',
  size: 2048,
  createdAt: '2026-10-08T10:00:00.000Z',
};

const isList = (req: { url: string; method: string }) =>
  req.url === '/api/tracks' && req.method === 'GET';

describe('TracksPageComponent', () => {
  let fixture: ComponentFixture<TracksPageComponent>;
  let component: TracksPageComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  // Le constructeur appelle load() : chaque test commence par répondre à
  // cette première requête GET /api/tracks.
  function flushList(items: Track[] = [TRACK]): void {
    httpMock
      .expectOne(isList)
      .flush({ items, page: 1, limit: 5, total: items.length, pages: 1 });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TracksPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TracksPageComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ---- Test 5 : affichage d'une erreur après un échec HTTP ----
  describe('chargement de la liste', () => {
    it("affiche le message du backend quand GET /api/tracks échoue", () => {
      httpMock
        .expectOne(isList)
        .flush({ message: 'Erreur serveur simulée' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(component.error()).toBe('Erreur serveur simulée');
      expect(el.querySelector('p.error')?.textContent).toContain('Erreur serveur simulée');
      expect(el.textContent).not.toContain('Chargement…');
    });

    it('affiche un message de repli (pas "Failed to fetch") si le backend est injoignable', () => {
      httpMock.expectOne(isList).error(new ProgressEvent('error'));
      fixture.detectChanges();

      expect(el.querySelector('p.error')?.textContent).toContain('Chargement des pistes impossible');
    });
  });

  // ---- Test 6 : suppression ----
  describe('suppression', () => {
    let dialogOpen: ReturnType<typeof vi.fn>;
    let snackOpen: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      flushList();
      fixture.detectChanges();
      // MatDialog et MatSnackBar sont fournis par les modules importés dans
      // le composant : on remplace leurs méthodes sur l'instance réellement
      // injectée (confirmation simulée, SnackBar espionnée).
      const dialog = component['dialog'];
      dialogOpen = vi.fn(() => ({ afterClosed: () => of(true) }));
      (dialog as unknown as { open: unknown }).open = dialogOpen;
      snackOpen = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);
    });

    function confirmAndExpectDelete(): TestRequest {
      component.confirmDelete(TRACK);
      const req = httpMock.expectOne('/api/tracks/t1');
      expect(req.request.method).toBe('DELETE');
      expect(component.deletingId()).toBe('t1');
      return req;
    }

    it('204 : appelle DELETE /api/tracks/:id, recharge la liste et affiche un succès', () => {
      confirmAndExpectDelete().flush(null, { status: 204, statusText: 'No Content' });

      flushList([]);
      expect(component.deletingId()).toBeNull();
      expect(snackOpen).toHaveBeenCalledWith(
        '« Blues en La » supprimée.',
        'OK',
        expect.objectContaining({ panelClass: 'snack-success' }),
      );
    });

    it('404 (déjà supprimée ou pas au propriétaire) : message dédié ET rechargement', () => {
      confirmAndExpectDelete().flush(
        { message: 'Piste inconnue' },
        { status: 404, statusText: 'Not Found' },
      );

      flushList([]); // la carte obsolète disparaît
      expect(snackOpen).toHaveBeenCalledWith(
        expect.stringContaining("n'existe plus ou ne vous appartient pas"),
        'OK',
        expect.objectContaining({ panelClass: 'snack-error' }),
      );
    });

    it("erreur réseau : message d'erreur, PAS de rechargement, bouton réactivé", () => {
      confirmAndExpectDelete().error(new ProgressEvent('error'));

      httpMock.expectNone(isList);
      expect(component.deletingId()).toBeNull();
      expect(snackOpen).toHaveBeenCalledWith(
        'Suppression impossible',
        'OK',
        expect.objectContaining({ panelClass: 'snack-error' }),
      );
    });

    it("n'ouvre pas de seconde confirmation si une suppression est déjà en cours", () => {
      component.deletingId.set('t1');
      component.confirmDelete(TRACK);

      expect(dialogOpen).not.toHaveBeenCalled();
      httpMock.expectNone('/api/tracks/t1');
    });

    it('confirmation annulée : aucune requête DELETE', () => {
      dialogOpen.mockReturnValue({ afterClosed: () => of(false) });
      component.confirmDelete(TRACK);

      httpMock.expectNone('/api/tracks/t1');
    });
  });

  // ---- Test 7 : upload avec progression ----
  describe('upload', () => {
    beforeEach(() => {
      flushList();
      fixture.detectChanges(); // résout @ViewChild('fileInput')
      component.file = new File(['x'.repeat(200)], 'riff.mp3', { type: 'audio/mpeg' });
      component.title.setValue('Riff');
    });

    function startUpload(): TestRequest {
      component.upload();
      const req = httpMock.expectOne(
        (r) => r.url === '/api/tracks' && r.method === 'POST',
      );
      expect(req.request.reportUploadProgress).toBe(true);
      return req;
    }

    it('met à jour la progression puis traite la réponse finale', () => {
      const req = startUpload();
      expect(component.uploading()).toBe(true);
      expect(component.title.disabled).toBe(true);

      // Le faux backend n'émet rien tout seul : on simule les événements que
      // le navigateur (XHR) émettrait pendant l'envoi.
      req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 200 });
      fixture.detectChanges();
      expect(component.uploadProgress()).toBe(25);
      expect(el.querySelector('.upload-progress p')?.textContent).toContain('Envoi : 25 %');
      expect(el.querySelector<HTMLButtonElement>('article.card button')?.disabled).toBe(true);

      req.event({ type: HttpEventType.UploadProgress, loaded: 200, total: 200 });
      fixture.detectChanges();
      expect(el.querySelector('.upload-progress p')?.textContent).toContain('Finalisation');

      // total inconnu : on garde le dernier pourcentage (pas de NaN)
      req.event({ type: HttpEventType.UploadProgress, loaded: 10 });
      expect(component.uploadProgress()).toBe(100);

      req.flush({ ...TRACK, id: 't2', title: 'Riff' });
      flushList(); // rechargement après succès
      fixture.detectChanges();

      expect(component.uploading()).toBe(false);
      expect(component.uploadSuccess()).toBe('« Riff » ajoutée avec succès.');
      expect(component.title.enabled).toBe(true);
      expect(component.title.value).toBe('');
      expect(component.file).toBeUndefined();
      expect(el.querySelector('.upload-progress')).toBeNull();
    });

    it("traite l'erreur : message du backend, contrôles réactivés, titre conservé", () => {
      const req = startUpload();
      req.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 200 });

      req.flush(
        { message: 'Format audio non accepté' },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();

      httpMock.expectNone(isList);
      expect(component.uploading()).toBe(false);
      expect(component.title.enabled).toBe(true);
      expect(component.title.value).toBe('Riff');
      expect(el.querySelector('p.error')?.textContent).toContain('Format audio non accepté');
      expect(el.querySelector('.upload-progress')).toBeNull();
    });

    it("ignore un second clic pendant l'envoi (une seule requête)", () => {
      const req = startUpload();
      component.upload();
      httpMock.expectNone((r) => r.method === 'POST');

      req.flush({ ...TRACK, id: 't3' });
      flushList();
    });
  });
});
