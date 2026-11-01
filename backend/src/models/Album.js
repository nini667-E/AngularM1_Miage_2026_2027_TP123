import mongoose from "mongoose";

export const VISIBILITIES = ["private", "public"];
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 500;

// Référence vers une série ou une extension TCGdex, recopiée dans l'album
// (nom et logo) pour ne pas interroger le catalogue à chaque affichage.
const catalogRef = new mongoose.Schema(
  { id: { type: String, required: true }, name: String, logo: String },
  { _id: false },
);

/*
 * Thème facultatif : un album sans thème est une collection libre. Le
 * contrôle de cohérence des cartes avec ce thème arrive à l'étape 3.
 */
const themeSchema = new mongoose.Schema(
  { type: String, serie: catalogRef, set: catalogRef },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: TITLE_MAX },
    description: { type: String, trim: true, maxlength: DESCRIPTION_MAX, default: "" },
    // Privé par défaut : on construit son album avant de le montrer.
    visibility: { type: String, enum: VISIBILITIES, default: "private" },
    theme: { type: themeSchema, default: () => ({}) },
    // Amis avec qui un album privé est partagé (étape 5).
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    cardCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Liste « Mes albums » : les albums d'un utilisateur, les plus récents d'abord.
schema.index({ ownerId: 1, updatedAt: -1 });

const publicRef = (ref) => (ref ? { id: ref.id, name: ref.name ?? null, logo: ref.logo ?? null } : null);

/** Champs exposés par l'API (sharedWith n'est pas encore exposé). */
schema.methods.toPublic = function () {
  return {
    id: this.id,
    ownerId: String(this.ownerId),
    title: this.title,
    description: this.description,
    visibility: this.visibility,
    theme: {
      type: this.theme?.type ?? null,
      serie: publicRef(this.theme?.serie),
      set: publicRef(this.theme?.set),
    },
    cardCount: this.cardCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Album = mongoose.model("Album", schema);
