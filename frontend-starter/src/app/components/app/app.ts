import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { filter } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { FriendService } from '../../shared/services/friend.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatBadgeModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly friendService = inject(FriendService);

  /** Invitations d'amis reçues en attente : badge sur « Amis » (étape 4). */
  protected readonly pending = this.friendService.receivedCount;

  // Liens de la navigation principale, partagés entre la barre (écran
  // large) et le menu « burger » (mobile) pour ne les écrire qu'une fois.
  protected readonly links = [
    { path: '/', label: 'Accueil', icon: 'home', exact: true },
    { path: '/albums', label: 'Mes albums', icon: 'collections_bookmark', exact: false },
    { path: '/search', label: 'Recherche', icon: 'search', exact: false },
    { path: '/friends', label: 'Amis', icon: 'group', exact: false },
  ];

  // Initiale affichée dans l'avatar du menu profil.
  protected readonly initial = computed(
    () => this.auth.currentUser()?.name.trim().charAt(0).toUpperCase() || '?',
  );

  constructor() {
    if (this.auth.token()) {
      // currentUser part de null à chaque démarrage de l'app (pas persisté,
      // contrairement au token) : on le recharge explicitement pour que le
      // header affiche qui est connecté dès l'ouverture, y compris après F5.
      this.auth.profile().subscribe({ error: () => {} });
    }

    // Badge des invitations : rechargé à chaque changement de page (dont la
    // première, et celle qui suit la connexion), sans requête en arrière-plan.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.friendService.refreshCount());
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
