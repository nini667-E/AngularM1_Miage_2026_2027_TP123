import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivityItem, AlbumWithOwner, DiscoveredCard } from '../../shared/models/discover.model';
import { AuthService } from '../../shared/services/auth.service';
import { HomePageComponent } from './home-page';

const ME = { id: 'me', name: 'Sacha' };
const ONDINE = { id: 'u2', name: 'Ondine' };
const PIERRE = { id: 'u3', name: 'Pierre' };

const card = (id: string, name: string): DiscoveredCard =>
  ({
    id,
    albumId: 'a1',
    name,
    photo: { thumb: `/api/images/${id}/thumb?exp=1&sig=x`, full: '' },
    album: { id: 'a1', title: 'Les Psy d’Ondine' },
    owner: ONDINE,
  }) as DiscoveredCard;

const album = (id: string, title: string): AlbumWithOwner => ({
  id,
  ownerId: 'u2',
  title,
  description: '',
  visibility: 'public',
  theme: { type: null, serie: null, set: null },
  cardCount: 0,
  likeCount: 0,
  commentCount: 0,
  sharedCount: null,
  createdAt: '2026-11-10',
  updatedAt: '2026-11-10',
  owner: ONDINE,
});

const event = (fields: Partial<ActivityItem>): ActivityItem => ({
  id: Math.random().toString(),
  type: 'album',
  date: '2026-11-11T10:00:00.000Z',
  actor: ONDINE,
  album: { id: 'a1', title: 'Les Psy d’Ondine', owner: ONDINE },
  ...fields,
});

describe('HomePageComponent (Accueil)', () => {
  let fixture: ComponentFixture<HomePageComponent>;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({ ...ME, email: 'x@x', createdAt: '' });
    fixture = TestBed.createComponent(HomePageComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';
  /** Phrases de l'activité, sans le texte des icônes (« favorite »). */
  const sentences = () =>
    Array.from(el.querySelectorAll('.event .sentence')).map((sentence) => {
      const copy = sentence.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('mat-icon').forEach((icon) => icon.remove());
      return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
    });

  function flush(recent = { cards: [card('c1', 'Mewtwo')], albums: [album('a1', 'Les Psy d’Ondine')] }, activity = { hasFriends: true, items: [] as ActivityItem[] }) {
    httpMock.expectOne('/api/discover/recent').flush(recent);
    httpMock.expectOne('/api/discover/activity').flush(activity);
    fixture.detectChanges();
  }

  it('récents : dernières cartes (vers leur album) et nouveaux albums avec leur propriétaire', () => {
    flush();

    const tile = el.querySelector('.cards app-card-tile a');
    expect(tile?.getAttribute('href')).toBe('/albums/a1');
    expect(tile?.textContent ?? '').toContain('Mewtwo');
    expect(tile?.textContent ?? '').toContain('par Ondine');
    expect(text('.albums app-album-cover .owner')).toBe('par Ondine');
    // Texte du titre. Attention : l’espace manquant vu sur capture le 11/11/2026
    // venait du rendu CSS (inline-block) ; jsdom ne dessine pas, ce test ne le voyait pas.
    expect(text('h1').replace(/\s+/g, ' ').trim()).toBe('Bonjour Sacha');
  });

  it('activité : une phrase par type d’événement, avec « ton album », « son album » ou « l’album de X »', () => {
    flush(undefined, {
      hasFriends: true,
      items: [
        event({ type: 'album' }),
        event({ type: 'cards', cards: { count: 3, previews: [{ id: 'c1', name: 'Mewtwo', thumb: '/t1' }, { id: 'c2', name: 'Abra', thumb: '/t2' }] } }),
        event({ type: 'cards', cards: { count: 1, previews: [{ id: 'c3', name: 'Kadabra', thumb: '/t3' }] } }),
        event({ type: 'comment', album: { id: 'a9', title: 'Mes Feu', owner: ME }, comment: { text: 'Superbe !', isReply: false } }),
        event({ type: 'comment', comment: { text: 'Merci', isReply: true } }),
        event({ type: 'like', actor: ONDINE, album: { id: 'a5', title: 'Deck Eau', owner: PIERRE } }),
      ],
    });

    expect(sentences()).toEqual([
      'Ondine a créé l’album Les Psy d’Ondine',
      'Ondine a ajouté 3 cartes à Les Psy d’Ondine',
      'Ondine a ajouté 1 carte à Les Psy d’Ondine',
      'Ondine a commenté ton album Mes Feu',
      'Ondine a répondu sur son album Les Psy d’Ondine',
      'Ondine aime l’album de Pierre Deck Eau',
    ]);
    expect(el.querySelectorAll('.event[data-type="cards"] .previews img').length).toBe(3);
    expect(text('.event[data-type="comment"] .excerpt')).toBe('Superbe !');
    expect(el.querySelector('.event[data-type="like"] .sentence a')?.getAttribute('href')).toBe('/albums/a5');
  });

  it('sans ami : invitation à en trouver, lien vers la page Amis', () => {
    flush(undefined, { hasFriends: false, items: [] });
    expect(text('.no-friends')).toContain('Ajoute des amis');
    expect(el.querySelector('.no-friends a')?.getAttribute('href')).toBe('/friends');
  });

  it('amis sans activité, et aucun contenu public : messages', () => {
    flush({ cards: [], albums: [] }, { hasFriends: true, items: [] });
    expect(text('.empty-activity')).toContain('Rien de neuf');
    expect(text('.empty-cards')).toContain('Aucune carte');
    expect(text('.empty-albums')).toContain('Aucun album public');
  });

  it('erreur des récents : message, l’activité s’affiche quand même', () => {
    httpMock.expectOne('/api/discover/recent').error(new ProgressEvent('error'));
    httpMock.expectOne('/api/discover/activity').flush({ hasFriends: true, items: [event({})] });
    fixture.detectChanges();

    expect(text('.recent-error')).toContain('Impossible de charger les nouveautés');
    expect(el.querySelectorAll('.event').length).toBe(1);
  });
});
