import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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
