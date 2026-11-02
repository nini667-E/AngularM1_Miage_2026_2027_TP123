import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { Friend, FriendRequest, Relation, UserSearchResult } from '../../shared/models/friend.model';
import { FriendService } from '../../shared/services/friend.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { FriendButtonComponent } from '../../shared/components/friend-button/friend-button';
import { serverErrorMessage } from '../../shared/utils/http-error';

/** Délai de frappe avant de lancer une recherche (comme l'ajout de carte). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Page Amis (V2, étape 4) : recherche de collectionneurs à inviter, puis
 * trois onglets : mes amis, invitations reçues, invitations envoyées.
 */
@Component({
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTabsModule,
    MatTooltipModule,
    FriendButtonComponent,
  ],
  templateUrl: './friends-page.html',
  styleUrl: './friends-page.css',
})
export class FriendsPageComponent {
  private readonly friendService = inject(FriendService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  // Listes.
  readonly friends = signal<Friend[]>([]);
  readonly received = signal<FriendRequest[]>([]);
  readonly sent = signal<FriendRequest[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly tab = signal(0);
  /** Utilisateurs dont une action est en cours (boutons désactivés). */
  readonly busy = signal<ReadonlySet<string>>(new Set());

  // Recherche.
  readonly query = new FormControl('', { nonNullable: true });
  readonly results = signal<UserSearchResult[] | null>(null);
  readonly searchedFor = signal('');
  readonly searching = signal(false);
  readonly searchError = signal('');

  /**
   * Relation avec chaque utilisateur d'après les listes, qui font foi dès
   * qu'elles sont chargées : une action dans un onglet se reflète aussi dans
   * les résultats de recherche.
   */
  private readonly relations = computed(() => {
    const relations = new Map<string, Relation>();
    for (const friend of this.friends()) relations.set(friend.user.id, 'friend');
    for (const request of this.received()) relations.set(request.user.id, 'received');
    for (const request of this.sent()) relations.set(request.user.id, 'sent');
    return relations;
  });

  constructor() {
    this.reload();
    this.query.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((query) => {
          this.searchError.set('');
          this.searching.set(query.length >= 2);
          if (query.length < 2) this.results.set(null);
        }),
        // switchMap : une nouvelle saisie annule la recherche précédente.
        switchMap((query) => (query.length < 2 ? EMPTY : this.search(query))),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private search(query: string): Observable<unknown> {
    return this.friendService.search(query).pipe(
      tap((results) => {
        this.searching.set(false);
        this.searchedFor.set(query);
        this.results.set(results);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('[FriendsPage] Recherche impossible', error);
        this.searching.set(false);
        this.results.set(null);
        this.searchError.set(serverErrorMessage(error, 'Recherche impossible'));
        return of(null);
      }),
    );
  }

  relationOf(result: UserSearchResult): Relation {
    return this.loaded() ? (this.relations().get(result.id) ?? 'none') : result.relation;
  }

  /** Recharge les trois listes (et donc le badge des invitations reçues). */
  reload(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ friends: this.friendService.friends(), requests: this.friendService.requests() }).subscribe({
      next: ({ friends, requests }) => {
        this.friends.set(friends);
        this.received.set(requests.received);
        this.sent.set(requests.sent);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[FriendsPage] Chargement impossible', error);
        this.loading.set(false);
        this.error.set(serverErrorMessage(error, 'Impossible de charger tes amis'));
      },
    });
  }

  isBusy(userId: string): boolean {
    return this.busy().has(userId);
  }

  accept(request: FriendRequest): void {
    this.run(request.user.id, this.friendService.accept(request.user.id), `${request.user.name} et toi êtes maintenant amis.`);
  }

  refuse(request: FriendRequest): void {
    this.run(request.user.id, this.friendService.deleteRequest(request.user.id), 'Invitation refusée.');
  }

  cancel(request: FriendRequest): void {
    this.run(request.user.id, this.friendService.deleteRequest(request.user.id), 'Invitation annulée.');
  }

  confirmRemove(friend: Friend): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: 'Retirer cet ami ?',
          message: `${friend.user.name} ne fera plus partie de tes amis. Vous pourrez vous réinviter plus tard.`,
          confirmLabel: 'Retirer',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.run(friend.user.id, this.friendService.remove(friend.user.id), `${friend.user.name} a été retiré de tes amis.`);
      });
  }

  /** Lance une action sur un utilisateur, puis recharge les listes. */
  private run(userId: string, request: Observable<unknown>, success: string): void {
    if (this.isBusy(userId)) return;
    this.setBusy(userId, true);
    request.subscribe({
      next: () => {
        this.setBusy(userId, false);
        this.snackBar.open(success, 'OK', { duration: 4000, panelClass: 'snack-success' });
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        console.error('[FriendsPage] Action impossible', error);
        this.setBusy(userId, false);
        this.snackBar.open(serverErrorMessage(error, 'Action impossible, réessaie'), 'OK', {
          duration: 5000,
          panelClass: 'snack-error',
        });
        // L'autre a pu agir entre-temps (invitation annulée…) : listes à jour.
        this.reload();
      },
    });
  }

  private setBusy(userId: string, busy: boolean): void {
    const next = new Set(this.busy());
    if (busy) next.add(userId);
    else next.delete(userId);
    this.busy.set(next);
  }

  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
}
