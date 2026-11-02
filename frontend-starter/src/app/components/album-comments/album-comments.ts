import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlbumComment } from '../../shared/models/reaction.model';
import { ReactionService } from '../../shared/services/reaction.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { serverErrorMessage } from '../../shared/utils/http-error';

export const COMMENT_MAX = 500;
export const COMMENTS_PER_PAGE = 10;

/**
 * Commentaires d'un album (V2, étape 6) : les plus récents d'abord,
 * « Afficher plus » pour les suivants ; formulaire pour les amis du
 * propriétaire ; le propriétaire, lui, **répond** sous chaque commentaire ;
 * suppression par l'auteur ou le propriétaire (le serveur indique
 * `canDelete` pour chaque commentaire et chaque réponse).
 */
@Component({
  selector: 'app-album-comments',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './album-comments.html',
  styleUrl: './album-comments.css',
})
export class AlbumCommentsComponent implements OnInit {
  private readonly reactionService = inject(ReactionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly albumId = input.required<string>();
  readonly canComment = input(false);
  /** Propriétaire : bouton « Répondre » sous chaque commentaire. */
  readonly canReply = input(false);

  readonly comments = signal<AlbumComment[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly posting = signal(false);
  readonly postError = signal('');

  readonly text = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(COMMENT_MAX)],
  });
  readonly max = COMMENT_MAX;
  private readonly value = toSignal(this.text.valueChanges, { initialValue: '' });
  readonly length = computed(() => this.value().length);
  /** Un texte fait seulement d'espaces ne compte pas. */
  readonly canPost = computed(() => this.value().trim().length > 0 && this.value().length <= COMMENT_MAX);

  readonly hasMore = computed(() => this.comments().length < this.total());

  // Réponse en cours (un seul formulaire ouvert à la fois).
  readonly replyingTo = signal<string | null>(null);
  readonly replying = signal(false);
  readonly replyError = signal('');
  readonly replyText = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(COMMENT_MAX)],
  });
  private readonly replyValue = toSignal(this.replyText.valueChanges, { initialValue: '' });
  readonly replyLength = computed(() => this.replyValue().length);
  readonly canPostReply = computed(() => this.replyValue().trim().length > 0 && this.replyValue().length <= COMMENT_MAX);

  ngOnInit(): void {
    this.load();
  }

  /**
   * Page suivante, d'après le nombre déjà affiché. Les ajouts et
   * suppressions décalent les pages : on peut relire un commentaire déjà
   * affiché, il est alors ignoré (dédoublonnage par identifiant).
   */
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const page = Math.floor(this.comments().length / COMMENTS_PER_PAGE) + 1;
    this.reactionService.comments(this.albumId(), page, COMMENTS_PER_PAGE).subscribe({
      next: (response) => {
        const known = new Set(this.comments().map((comment) => comment.id));
        this.comments.update((list) => [...list, ...response.items.filter((comment) => !known.has(comment.id))]);
        this.total.set(response.total);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AlbumComments] Chargement impossible', error);
        this.loading.set(false);
        this.error.set(serverErrorMessage(error, 'Impossible de charger les commentaires'));
      },
    });
  }

  post(): void {
    if (this.posting() || !this.canPost()) return;
    this.posting.set(true);
    this.postError.set('');
    this.reactionService.addComment(this.albumId(), this.text.value.trim()).subscribe({
      next: (comment) => {
        this.posting.set(false);
        this.comments.update((list) => [comment, ...list]);
        this.total.update((n) => n + 1);
        this.text.reset();
        this.snackBar.open('Commentaire publié.', 'OK', { duration: 3000, panelClass: 'snack-success' });
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AlbumComments] Publication impossible', error);
        this.posting.set(false);
        this.postError.set(serverErrorMessage(error, 'Impossible de publier le commentaire'));
      },
    });
  }

  startReply(comment: AlbumComment): void {
    this.replyText.reset();
    this.replyError.set('');
    this.replyingTo.set(comment.id);
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  /** Réponse du propriétaire au commentaire `parent`, ajoutée sous lui. */
  postReply(parent: AlbumComment): void {
    if (this.replying() || !this.canPostReply()) return;
    this.replying.set(true);
    this.replyError.set('');
    this.reactionService.addComment(this.albumId(), this.replyText.value.trim(), parent.id).subscribe({
      next: (reply) => {
        this.replying.set(false);
        this.comments.update((list) =>
          list.map((c) => (c.id === parent.id ? { ...c, replies: [...c.replies, reply] } : c)),
        );
        this.replyingTo.set(null);
        this.replyText.reset();
        this.snackBar.open('Réponse publiée.', 'OK', { duration: 3000, panelClass: 'snack-success' });
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AlbumComments] Réponse impossible', error);
        this.replying.set(false);
        this.replyError.set(serverErrorMessage(error, 'Impossible de publier la réponse'));
      },
    });
  }

  confirmDelete(comment: AlbumComment): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: comment.parentId ? 'Supprimer cette réponse ?' : 'Supprimer ce commentaire ?',
          message: comment.parentId
            ? 'Ta réponse sera supprimée définitivement.'
            : `Le commentaire de ${comment.author.name}${comment.replies.length ? ' et ses réponses seront supprimés' : ' sera supprimé'} définitivement.`,
          confirmLabel: 'Supprimer',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.reactionService.deleteComment(comment.id).subscribe({
          next: () => {
            if (comment.parentId) {
              // Réponse : retirée de son commentaire.
              this.comments.update((list) =>
                list.map((c) => (c.id === comment.parentId ? { ...c, replies: c.replies.filter((r) => r.id !== comment.id) } : c)),
              );
              this.snackBar.open('Réponse supprimée.', 'OK', { duration: 3000, panelClass: 'snack-success' });
              return;
            }
            // Commentaire principal : ses réponses partent avec lui (côté serveur aussi).
            this.comments.update((list) => list.filter((c) => c.id !== comment.id));
            this.total.update((n) => Math.max(0, n - 1));
            this.snackBar.open('Commentaire supprimé.', 'OK', { duration: 3000, panelClass: 'snack-success' });
          },
          error: (error: HttpErrorResponse) => {
            console.error('[AlbumComments] Suppression impossible', error);
            this.snackBar.open(serverErrorMessage(error, 'Suppression impossible'), 'OK', {
              duration: 5000,
              panelClass: 'snack-error',
            });
          },
        });
      });
  }

  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
}
