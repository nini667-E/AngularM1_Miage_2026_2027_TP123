import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../shared/services/auth.service';
import { serverErrorMessage } from '../../shared/utils/http-error';

@Component({
  imports: [ReactiveFormsModule, DatePipe, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent {
  readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    // Arriver sur /profile est la "demande" du profil : on charge
    // systématiquement une version fraîche via GET /api/users/me, plutôt
    // que de dépendre du Signal currentUser déjà rempli par ailleurs
    // (login, ou le rechargement automatique fait par AppComponent).
    this.load();
  }

  load(): void {
    this.auth.profile().subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil chargé', user.id);
        this.form.setValue({ name: user.name });
      },
      error: (error) => console.error('[ProfilePage] Chargement impossible', error),
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.auth.update(this.form.getRawValue().name).subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil enregistré', user.id);
        this.snackBar.open('Profil enregistré.', 'OK', { duration: 4000, panelClass: 'snack-success' });
      },
      error: (error: HttpErrorResponse) => {
        console.error('[ProfilePage] Enregistrement impossible', error);
        this.snackBar.open(serverErrorMessage(error, 'Enregistrement impossible'), 'OK', {
          duration: 6000,
          panelClass: 'snack-error',
        });
      },
    });
  }
}
