import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { CardSearchResult } from '../../shared/models/card.model';
import { ProfileChanges, UserAvatar } from '../../shared/models/user.model';
import { AuthService } from '../../shared/services/auth.service';
import { CardService } from '../../shared/services/card.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { serverErrorMessage } from '../../shared/utils/http-error';

export const NAME_MAX = 30;
export const BIO_MAX = 300;
export const AVATAR_SEARCH_DEBOUNCE_MS = 300;

/** Avatar en cours d'édition : inchangé, une nouvelle carte, ou retiré. */
type AvatarChoice = { kind: 'keep' } | { kind: 'card'; card: CardSearchResult } | { kind: 'remove' };

/**
 * Modifier mon profil (V2, étape 8) : pseudo, présentation (bio) et avatar,
 * choisi parmi les cartes du catalogue (recherche par nom, comme l'ajout
 * d'une carte). Seuls les champs modifiés sont envoyés.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    DatePipe,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    AvatarComponent,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent {
  readonly auth = inject(AuthService);
  private readonly cardService = inject(CardService);
  private readonly snackBar = inject(MatSnackBar);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(NAME_MAX)],
    }),
    bio: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(BIO_MAX)] }),
  });
  readonly nameMax = NAME_MAX;
  readonly bioMax = BIO_MAX;
  private readonly bio = toSignal(this.form.controls.bio.valueChanges, { initialValue: '' });
  readonly bioLength = computed(() => this.bio().length);

  // Avatar.
  readonly avatarChoice = signal<AvatarChoice>({ kind: 'keep' });
  readonly avatarQuery = new FormControl('', { nonNullable: true });
  readonly avatarResults = signal<CardSearchResult[] | null>(null);
  readonly avatarSearching = signal(false);
  readonly avatarError = signal('');

  readonly saving = signal(false);

  /** Avatar affiché dans l'aperçu, selon le choix en cours. */
  readonly previewAvatar = computed<string | null>(() => {
    const choice = this.avatarChoice();
    if (choice.kind === 'card') return choice.card.image;
    if (choice.kind === 'remove') return null;
    return this.auth.currentUser()?.avatar?.image ?? null;
  });
  readonly currentAvatar = computed<UserAvatar | null>(() => this.auth.currentUser()?.avatar ?? null);

  constructor() {
    // Arriver sur /profile est la "demande" du profil : on charge
    // systématiquement une version fraîche via GET /api/users/me, plutôt
    // que de dépendre du Signal currentUser déjà rempli par ailleurs
    // (login, ou le rechargement automatique fait par AppComponent).
    this.load();

    this.avatarQuery.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(AVATAR_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((query) => {
          this.avatarError.set('');
          this.avatarSearching.set(query.length >= 2);
          if (query.length < 2) this.avatarResults.set(null);
        }),
        // switchMap : une nouvelle saisie annule la recherche précédente.
        switchMap((query) =>
          query.length < 2
            ? of(null)
            : this.cardService.search(query).pipe(
                catchError((error: HttpErrorResponse) => {
                  this.avatarError.set(serverErrorMessage(error, 'Recherche impossible'));
                  return of([] as CardSearchResult[]);
                }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        this.avatarSearching.set(false);
        // Une carte sans illustration ne peut pas servir d'avatar.
        if (results) this.avatarResults.set(results.filter((card) => card.image));
      });
  }

  load(): void {
    this.auth.profile().subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil chargé', user.id);
        this.form.setValue({ name: user.name, bio: user.bio ?? '' });
      },
      error: (error) => console.error('[ProfilePage] Chargement impossible', error),
    });
  }

  chooseAvatar(card: CardSearchResult): void {
    this.avatarChoice.set({ kind: 'card', card });
  }

  removeAvatar(): void {
    this.avatarChoice.set({ kind: 'remove' });
  }

  /** Les champs modifiés seulement. */
  private changes(): ProfileChanges {
    const user = this.auth.currentUser();
    const { name, bio } = this.form.getRawValue();
    const changes: ProfileChanges = {};
    if (name.trim() !== user?.name) changes.name = name.trim();
    if (bio.trim() !== (user?.bio ?? '')) changes.bio = bio.trim();
    const choice = this.avatarChoice();
    if (choice.kind === 'card') changes.avatarId = choice.card.id;
    if (choice.kind === 'remove' && user?.avatar) changes.avatarId = null;
    return changes;
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    const changes = this.changes();
    if (Object.keys(changes).length === 0) {
      this.snackBar.open('Rien à enregistrer.', 'OK', { duration: 3000 });
      return;
    }
    this.saving.set(true);
    this.auth.update(changes).subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil enregistré', user.id);
        this.saving.set(false);
        this.avatarChoice.set({ kind: 'keep' });
        this.avatarResults.set(null);
        this.avatarQuery.setValue('', { emitEvent: false });
        this.form.setValue({ name: user.name, bio: user.bio ?? '' });
        this.snackBar.open('Profil enregistré.', 'OK', { duration: 4000, panelClass: 'snack-success' });
      },
      error: (error: HttpErrorResponse) => {
        console.error('[ProfilePage] Enregistrement impossible', error);
        this.saving.set(false);
        this.snackBar.open(serverErrorMessage(error, 'Enregistrement impossible'), 'OK', {
          duration: 6000,
          panelClass: 'snack-error',
        });
      },
    });
  }
}
