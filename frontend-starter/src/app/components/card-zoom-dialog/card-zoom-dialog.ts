import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AlbumCard } from '../../shared/models/card.model';
import { typeColor, typeIcon } from '../../shared/utils/card-types';

export interface CardZoomData {
  card: AlbumCard;
  /** Propriétaire de l'album : peut retirer la carte. */
  canDelete: boolean;
}

/** Résultat : 'delete' si le propriétaire demande à retirer la carte. */
export type CardZoomResult = 'delete' | undefined;

/**
 * Zoom sur une carte (V2, étape 3) : la photo de l'utilisateur en grand, à
 * côté de l'image officielle TCGdex, avec ses informations. La suppression
 * elle-même (confirmation, requête) est gérée par la page de l'album.
 */
@Component({
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './card-zoom-dialog.html',
  styleUrl: './card-zoom-dialog.css',
})
export class CardZoomDialogComponent {
  protected readonly data = inject<CardZoomData>(MAT_DIALOG_DATA);
  protected readonly typeColor = typeColor;
  protected readonly typeIcon = typeIcon;
}
