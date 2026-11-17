import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { Component } from '@angular/core';
import { CardVaultTitleStrategy, pageTitle } from './page-title';
import { NotFoundPageComponent } from '../../components/not-found-page/not-found-page';

@Component({ template: '' })
class EmptyComponent {}

describe('Titre de l’onglet (étape 8)', () => {
  it('pageTitle : « page · Card Vault », ou « Card Vault » seul', () => {
    expect(pageTitle('Mes 151 Psy')).toBe('Mes 151 Psy · Card Vault');
    expect(pageTitle('')).toBe('Card Vault');
    expect(pageTitle(null)).toBe('Card Vault');
  });

  it('à chaque navigation, le titre suit la route', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'search', component: EmptyComponent, title: 'Recherche' },
          { path: 'sans-titre', component: EmptyComponent },
        ]),
        { provide: TitleStrategy, useClass: CardVaultTitleStrategy },
      ],
    });
    const router = TestBed.inject(Router);
    const title = TestBed.inject(Title);

    await router.navigateByUrl('/search');
    expect(title.getTitle()).toBe('Recherche · Card Vault');
    await router.navigateByUrl('/sans-titre');
    expect(title.getTitle()).toBe('Card Vault');
  });

  it('page introuvable : message et lien vers l’accueil', () => {
    TestBed.configureTestingModule({ imports: [NotFoundPageComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NotFoundPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent ?? '').toBe('Page introuvable');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});
