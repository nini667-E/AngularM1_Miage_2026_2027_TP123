import mongoose from "mongoose";

export const COMMENT_MAX = 500;

/*
 * Commentaire sur un album (V2, étape 6). Pas de modification : un
 * commentaire se supprime (par son auteur ou le propriétaire de l'album).
 * `parentId` : réponse du propriétaire à un commentaire d'ami (un seul
 * niveau) ; null pour un commentaire principal.
 */
const schema = new mongoose.Schema(
  {
    albumId: { type: mongoose.Schema.Types.ObjectId, ref: "Album", required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: COMMENT_MAX },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Fil des commentaires principaux d'un album, les plus récents d'abord ;
// réponses d'un commentaire.
schema.index({ albumId: 1, parentId: 1, createdAt: -1 });

export const Comment = mongoose.model("Comment", schema);
