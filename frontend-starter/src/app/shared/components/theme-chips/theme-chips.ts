import { Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { AlbumTheme } from '../../models/album.model';
import { typeColor, typeIcon } from '../../utils/card-types';

/** Puces du thème d'un album : type (coloré), série et extension (logo). */
@Component({
  selector: 'app-theme-chips',
  imports: [MatChipsModule, MatIconModule],
  template: `
    <mat-chip-set [attr.aria-label]="'Thème de l’album'">
      @if (theme().type; as type) {
        <mat-chip class="type-chip" [style.--chip-color]="typeColor(type)">
          <mat-icon matChipAvatar aria-hidden="true">{{ typeIcon(type) }}</mat-icon>
          {{ type }}
        </mat-chip>
      }
      @if (theme().serie; as serie) {
        <mat-chip>{{ serie.name }}</mat-chip>
      }
      @if (theme().set; as set) {
        <mat-chip>
          @if (set.logo) {
            <img matChipAvatar class="set-logo" [src]="set.logo" alt="" loading="lazy" />
          }
          {{ set.name }}
        </mat-chip>
      }
      @if (!theme().type && !theme().serie) {
        <mat-chip class="free-chip">Collection libre</mat-chip>
      }
    </mat-chip-set>
  `,
  styles: `
    .type-chip {
      --mat-chip-elevated-container-color: color-mix(in srgb, var(--chip-color) 22%, transparent);
      --mat-chip-label-text-color: var(--mat-sys-on-surface);
      --mat-chip-with-avatar-avatar-color: var(--chip-color);
    }
    .type-chip mat-icon { color: var(--chip-color); }
    .set-logo { object-fit: contain; background: transparent; border-radius: 0; }
    .free-chip { --mat-chip-label-text-color: var(--mat-sys-on-surface-variant); }
  `,
})
export class ThemeChipsComponent {
  readonly theme = input.required<AlbumTheme>();
  protected readonly typeColor = typeColor;
  protected readonly typeIcon = typeIcon;
}
