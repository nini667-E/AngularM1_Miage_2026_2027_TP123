import mongoose from "mongoose";

/*
 * « J'aime » sur un album (V2, étape 6). L'index unique { albumId, userId }
 * garantit au plus un like par personne et par album, même en cas de
 * double clic ou de deux requêtes simultanées.
 */
const schema = new mongoose.Schema(
  {
    albumId: { type: mongoose.Schema.Types.ObjectId, ref: "Album", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ albumId: 1, userId: 1 }, { unique: true });
// Activité des amis : leurs derniers likes (étape 7).
schema.index({ userId: 1, createdAt: -1 });

export const Like = mongoose.model("Like", schema);
