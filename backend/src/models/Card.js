import mongoose from "mongoose";

const ref = new mongoose.Schema({ id: String, name: String, logo: String }, { _id: false });

/*
 * Une carte rangée dans un album (V2, étape 3) : la photo de l'utilisateur
 * (deux fichiers WebP sur le disque) + la fiche TCGdex recopiée au moment de
 * l'ajout (catégorie, types calculés, extension, série…). La recopie évite
 * d'interroger TCGdex à chaque affichage du classeur. Doublons autorisés.
 */
const schema = new mongoose.Schema(
  {
    albumId: { type: mongoose.Schema.Types.ObjectId, ref: "Album", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tcgdexId: { type: String, required: true },
    name: { type: String, required: true },
    localId: String,
    category: String,
    subCategory: String,
    types: [String],
    rarity: String,
    officialImage: String,
    set: ref,
    serie: ref,
    // Noms des fichiers sur le disque : jamais exposés (URL signées à la place).
    photo: {
      thumb: { type: String, required: true, select: false },
      full: { type: String, required: true, select: false },
    },
  },
  { timestamps: true },
);

// Classeur d'un album : ses cartes dans l'ordre d'ajout.
schema.index({ albumId: 1, createdAt: 1 });

export const Card = mongoose.model("Card", schema);
