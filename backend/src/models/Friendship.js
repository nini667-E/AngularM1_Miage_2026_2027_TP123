import mongoose from "mongoose";

export const FRIENDSHIP_STATUSES = ["pending", "accepted"];

/**
 * Clé unique d'une paire d'utilisateurs, dans un ordre fixe : (Alice, Bob) et
 * (Bob, Alice) donnent la même clé. L'index unique sur cette clé garantit un
 * seul lien par paire, même si les deux s'invitent au même moment.
 */
export const pairKey = (a, b) => [String(a), String(b)].sort().join(":");

/*
 * Lien d'amitié (V2, étape 4). `pending` : invitation envoyée par
 * `requester`, en attente de la réponse de `recipient`. `accepted` : amis.
 * Une invitation refusée, annulée ou une amitié retirée est supprimée.
 */
const schema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pair: { type: String, required: true, unique: true },
    status: { type: String, enum: FRIENDSHIP_STATUSES, default: "pending" },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.pre("validate", function () {
  this.pair = pairKey(this.requester, this.recipient);
});

/** L'autre membre de la paire, vu par `userId`. */
schema.methods.otherThan = function (userId) {
  return String(this.requester) === String(userId) ? String(this.recipient) : String(this.requester);
};

export const Friendship = mongoose.model("Friendship", schema);
