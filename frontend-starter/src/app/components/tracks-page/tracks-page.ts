import { Component, inject, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

// error.status === 0 signifie qu'aucune réponse n'est venue du serveur
// (connexion refusée, backend arrêté...) : error.error est alors une erreur
// technique du navigateur (ex. "Failed to fetch"), pas un message applicatif
// à afficher tel quel à l'utilisateur.
function serverErrorMessage(error: HttpErrorResponse, fallback: string): string {
  return error.status > 0 ? (error.error?.message ?? fallback) : fallback;
}

// Mêmes règles que le backend (backend/src/app.js), vérifiées ici en plus
// pour donner un retour immédiat sans attendre l'aller-retour réseau.
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
]);
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Libellé court affiché sur chaque card, à partir du mimeType renvoyé par
// l'API (ex. "audio/mpeg" -> "MP3").
const FORMAT_LABELS: Record<string, string> = {
  'audio/mpeg': 'MP3',
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/ogg': 'OGG',
  'audio/mp4': 'M4A',
  'audio/x-m4a': 'M4A',
};

function formatAudioType(mimeType: string): string {
  return FORMAT_LABELS[mimeType] ?? mimeType;
}

// track.size est en octets (taille brute renvoyée par multer côté backend).
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const ko = bytes / 1024;
  if (ko < 1024) return `${ko.toFixed(1)} Ko`;
  return `${(ko / 1024).toFixed(1)} Mo`;
}

@Component({
  imports: [ReactiveFormsModule, DatePipe, MatCardModule, MatButtonModule, MatIconModule, MatPaginatorModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  // mat-paginator recalcule lui-même le nombre de pages à partir de
  // total()/limit() ; plus besoin de stocker response.pages séparément.
  readonly total = signal(0);
  readonly limit = signal(5);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly audioUrl = signal('');
  readonly playingTrack = signal<Track | null>(null);
  readonly playbackFailed = signal(false);
  readonly audioError = signal('');
  readonly title = new FormControl('', { nonNullable: true });
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  readonly uploading = signal(false);
  file?: File;

  constructor() {
    this.load();
  }

  // Petits alias pour que le template puisse appeler les fonctions utilitaires.
  readonly formatType = formatAudioType;
  readonly formatSize = formatFileSize;

  choose(event: Event): void {
    const selected = (event.target as HTMLInputElement).files?.[0];
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.file = undefined;

    if (!selected) return;

    if (!ALLOWED_AUDIO_TYPES.has(selected.type)) {
      this.uploadError.set('Format non accepté (MP3, WAV, OGG ou M4A uniquement)');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      this.uploadError.set('Fichier trop volumineux (25 Mo maximum)');
      return;
    }

    this.file = selected;
    console.debug('[TracksPage] Fichier sélectionné', this.file.name);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.uploadSuccess.set('');
    this.service.list(this.page(), this.limit()).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées', response.items.length);
        this.tracks.set(response.items);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Chargement impossible', error);
        this.loading.set(false);
        this.error.set(serverErrorMessage(error, 'Chargement des pistes impossible'));
      },
    });
  }

  // mat-paginator est en index de page 0-based (pageIndex) ; nos Signals
  // restent 1-based (page) pour correspondre au contrat de l'API (?page=1).
  onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.limit.set(event.pageSize);
    this.load();
  }

  upload(): void {
    if (!this.file || this.uploading()) return;

    this.uploading.set(true);
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.service.upload(this.file, this.title.value || this.file.name).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.uploading.set(false);
        this.title.setValue('');
        this.file = undefined;
        this.page.set(1);
        // load() vide uploadSuccess en tout premier (synchrone) : on
        // l'appelle avant de fixer le message pour que celui-ci survive.
        this.load();
        this.uploadSuccess.set(`« ${track.title} » ajoutée avec succès.`);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploading.set(false);
        this.uploadError.set(serverErrorMessage(error, "Échec de l'envoi"));
      },
    });
  }

  play(track: Track): void {
    this.audioError.set('');
    this.playbackFailed.set(false);
    this.uploadSuccess.set('');
    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        const previousUrl = this.audioUrl();
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
        this.playingTrack.set(track);
      },
      error: (error: HttpErrorResponse) => {
        // playingTrack n'est volontairement pas touché ici : si une autre
        // piste était déjà en cours de lecture, elle continue, seule cette
        // tentative-ci a échoué.
        console.error('[TracksPage] Lecture impossible', error);
        this.audioError.set(serverErrorMessage(error, 'Lecture impossible'));
      },
    });
  }

  // Le fichier a bien été téléchargé (subscribe ci-dessus a réussi), mais le
  // navigateur échoue à le décoder/lire : erreur native de l'élément <audio>,
  // distincte d'un échec de la requête HTTP.
  onAudioError(): void {
    console.error('[TracksPage] Erreur de lecture audio (élément <audio>)');
    this.audioError.set('Ce fichier audio ne peut pas être lu.');
    this.playbackFailed.set(true);
  }

  // play() ne révoque que l'ObjectURL précédente à chaque nouvelle lecture ;
  // la dernière créée doit l'être ici, sinon elle reste en mémoire même
  // après avoir quitté cette page (changement de route).
  ngOnDestroy(): void {
    const url = this.audioUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
