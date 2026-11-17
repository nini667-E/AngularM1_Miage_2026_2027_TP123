import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { officialImage } from "../services/tcgdex.js";

export const NAME_MAX = 30;
export const BIO_MAX = 300;

/*
 * Un schéma Mongoose décrit la forme des documents MongoDB et leurs règles de
 * validation. `timestamps` ajoute automatiquement createdAt et updatedAt.
 */
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: NAME_MAX },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Profil (V2, étape 8) : courte présentation, et avatar = une carte du
    // catalogue TCGdex (son illustration officielle ; aucun fichier stocké).
    bio: { type: String, trim: true, maxlength: BIO_MAX, default: "" },
    avatar: {
      type: new mongoose.Schema({ tcgdexId: String, name: String, image: String }, { _id: false }),
      default: null,
    },
    // select:false empêche de renvoyer le hash par défaut dans les requêtes.
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

/**
 * Virtual property : `password` n'est pas stocké dans MongoDB.
 * Le setter conserve temporairement le mot de passe en mémoire pour que le
 * hook pre('validate') puisse le hacher avant la sauvegarde.
 */
schema.virtual("password").set(function (value) {
  this._plainPassword = value;
});

/**
 * Hook exécuté avant la validation d'un nouvel utilisateur.
 * bcrypt transforme le mot de passe en hash irréversible ; le mot de passe
 * original ne doit jamais être écrit dans la base ni dans les logs.
 */
schema.pre("validate", async function () {
  if (this.isNew && this._plainPassword) {
    console.debug(`[user-model] Hachage du mot de passe pour ${this.email}`);
    this.passwordHash = await bcrypt.hash(this._plainPassword, 10);
  }
});

/** Compare un mot de passe reçu avec le hash stocké. */
schema.methods.verifyPassword = function (value) {
  console.debug(`[user-model] Vérification du mot de passe pour ${this.email}`);
  return bcrypt.compare(value, this.passwordHash);
};

/** Avatar tel que l'API l'expose : la carte choisie et sa vignette officielle. */
export function publicAvatar(avatar) {
  return avatar?.image ? { tcgdexId: avatar.tcgdexId, name: avatar.name, image: officialImage(avatar.image, "low") } : null;
}

/** Retourne uniquement les champs qu'une réponse HTTP peut exposer (à l'utilisateur lui-même). */
schema.methods.toPublic = function () {
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    bio: this.bio ?? "",
    avatar: publicAvatar(this.avatar),
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", schema);
