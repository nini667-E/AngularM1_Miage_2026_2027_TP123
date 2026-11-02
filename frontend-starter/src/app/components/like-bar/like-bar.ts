import { Component, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PublicUser } from '../../shared/models/friend.model';
import { ReactionSummary } from '../../shared/models/reaction.model';
import { ReactionService } from '../../shared/services/reaction.service';
import { serverErrorMessage } from '../../shared/utils/http-error';

/**
 * Barre « J'aime » d'un album (V2, étape 6) : cœur (amis du propriétaire),
 * nombre de likes et liste de ceux qui aiment ; le propriétaire peut y
 * retirer un like reçu. L'état (`summary`) appartient à la page d'album :
 * chaque changement est renvoyé par `summaryChange`.
 */
@Component({
  selector: 'app-like-bar',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './like-bar.html',
  styleUrl: './like-bar.css',
})
export class LikeBarComponent {
  private readonly reactionService = inject(ReactionService);
  private readonly snackBar = inject(MatSnackBar);

  readonly albumId = input.required<string>();
  readonly ownerName = input.required<string>();
  readonly summary = input.required<ReactionSummary>();
  readonly summaryChange = output<ReactionSummary>();

  readonly busy = signal(false);

  /**
   * Aimer / ne plus aimer. Affichage immédiat (le cœur réagit tout de
   * suite), puis valeur du serveur ; en cas d'échec, retour à l'état d'avant.
   */
  toggle(): void {
    const before = this.summary();
    if (this.busy() || !before.canLike) return;
    this.busy.set(true);
    const liked = !before.likedByMe;
    this.summaryChange.emit({ ...before, likedByMe: liked, likeCount: Math.max(0, before.likeCount + (liked ? 1 : -1)) });
    const request = liked ? this.reactionService.like(this.albumId()) : this.reactionService.unlike(this.albumId());
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        this.summaryChange.emit({ ...this.summary(), ...result });
      },
      error: (error: HttpErrorResponse) => {
        console.error('[LikeBar] Action impossible', error);
        this.busy.set(false);
        this.summaryChange.emit(before);
        this.snackBar.open(serverErrorMessage(error, 'Action impossible, réessaie'), 'OK', {
          duration: 5000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  /** Le propriétaire retire le like de `user`. */
  removeLike(user: PublicUser): void {
    const before = this.summary();
    if (this.busy() || !before.canRemoveLikes) return;
    this.busy.set(true);
    this.reactionService.removeLike(this.albumId(), user.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.summaryChange.emit({
          ...before,
          likers: before.likers.filter((liker) => liker.id !== user.id),
          likeCount: Math.max(0, before.likeCount - 1),
        });
        this.snackBar.open(`Like de ${user.name} retiré.`, 'OK', { duration: 4000, panelClass: 'snack-success' });
      },
      error: (error: HttpErrorResponse) => {
        console.error('[LikeBar] Retrait impossible', error);
        this.busy.set(false);
        this.snackBar.open(serverErrorMessage(error, 'Retrait impossible'), 'OK', { duration: 5000, panelClass: 'snack-error' });
      },
    });
  }

  label(count: number): string {
    return count === 0 ? 'Aucun j’aime' : count === 1 ? '1 j’aime' : `${count} j’aime`;
  }
}
