import { Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { FriendActionResult, Relation } from '../../models/friend.model';
import { FriendService } from '../../services/friend.service';
import { serverErrorMessage } from '../../utils/http-error';

/**
 * Bouton d'amitié envers un autre utilisateur (V2, étape 4), selon la
 * relation : « Inviter », « Invitation envoyée », « Accepter » ou « Ami ».
 * Utilisé dans la recherche de la page Amis et sur la page d'un album.
 */
@Component({
  selector: 'app-friend-button',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @switch (state()) {
      @case ('none') {
        <button mat-stroked-button (click)="invite()" [disabled]="busy()" [attr.aria-label]="'Inviter ' + userName() + ' en ami'">
          <mat-icon>person_add</mat-icon>
          Inviter
        </button>
      }
      @case ('sent') {
        <span class="status"><mat-icon aria-hidden="true">schedule</mat-icon> Invitation envoyée</span>
      }
      @case ('received') {
        <button mat-flat-button (click)="accept()" [disabled]="busy()" [attr.aria-label]="'Accepter l’invitation de ' + userName()">
          <mat-icon>how_to_reg</mat-icon>
          Accepter
        </button>
      }
      @case ('friend') {
        <span class="status friend"><mat-icon aria-hidden="true">group</mat-icon> Ami</span>
      }
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0 0.75rem;
      min-height: 36px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
    }
    .status mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .friend { color: var(--mat-sys-primary); }
  `,
})
export class FriendButtonComponent {
  private readonly friendService = inject(FriendService);
  private readonly snackBar = inject(MatSnackBar);

  readonly userId = input.required<string>();
  readonly userName = input.required<string>();
  readonly relation = input.required<Relation>();
  /** Nouvelle relation après une action réussie. */
  readonly changed = output<Relation>();

  // Suit la relation reçue, mais peut changer localement après une action.
  readonly state = linkedSignal(() => this.relation());
  readonly busy = signal(false);

  invite(): void {
    this.run(this.friendService.invite(this.userId()), 'Impossible d’envoyer l’invitation');
  }

  accept(): void {
    this.run(this.friendService.accept(this.userId()), 'Impossible d’accepter l’invitation');
  }

  private run(request: Observable<FriendActionResult>, fallback: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        this.state.set(result.relation);
        const message =
          result.relation === 'friend'
            ? `${this.userName()} et toi êtes maintenant amis.`
            : `Invitation envoyée à ${this.userName()}.`;
        this.snackBar.open(message, 'OK', { duration: 4000, panelClass: 'snack-success' });
        // Une invitation reçue a pu être acceptée : le badge change.
        if (result.relation === 'friend') this.friendService.refreshCount();
        this.changed.emit(result.relation);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[FriendButton] Action impossible', error);
        this.busy.set(false);
        this.snackBar.open(serverErrorMessage(error, fallback), 'OK', { duration: 5000, panelClass: 'snack-error' });
      },
    });
  }
}
