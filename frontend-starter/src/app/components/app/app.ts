import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../shared/services/auth.service';

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
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Liens de la navigation principale, partagés entre la barre (écran
  // large) et le menu « burger » (mobile) pour ne les écrire qu'une fois.
  protected readonly links = [
    { path: '/', label: 'Accueil', icon: 'home', exact: true },
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
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
