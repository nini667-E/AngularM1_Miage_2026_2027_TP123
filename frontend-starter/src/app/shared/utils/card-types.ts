/**
 * Apparence des 11 types de cartes (noms TCGdex en français) : couleur
 * (variables --cv-type-* de styles.css) et icône Material Symbols.
 */
const TYPE_ICONS: Record<string, string> = {
  feu: 'local_fire_department',
  eau: 'water_drop',
  plante: 'eco',
  electrique: 'bolt',
  psy: 'psychology',
  combat: 'sports_mma',
  obscurite: 'dark_mode',
  metal: 'hexagon',
  fee: 'auto_awesome',
  dragon: 'whatshot',
  incolore: 'radio_button_unchecked',
};

/** « Électrique » -> « electrique » (sans accents, minuscules). */
export function typeSlug(type: string): string {
  return type.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Couleur CSS d'un type ; or de la marque si le type est inconnu. */
export function typeColor(type: string | null | undefined): string {
  return type && TYPE_ICONS[typeSlug(type)] ? `var(--cv-type-${typeSlug(type)})` : 'var(--mat-sys-primary)';
}

/** Icône d'un type ; icône générique de collection si inconnu. */
export function typeIcon(type: string | null | undefined): string {
  return (type && TYPE_ICONS[typeSlug(type)]) || 'style';
}
