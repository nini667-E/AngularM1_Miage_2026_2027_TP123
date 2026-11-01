import fs from "node:fs";
import path from "node:path";

// Dossier des fichiers envoyés par les utilisateurs : les photos de cartes
// (V2, étape 3). Jamais servi tel quel : uniquement via les URL signées.
export const UPLOADS = path.resolve("data/uploads");

try {
  // mkdirSync est utilisé au démarrage : l'application doit disposer de ce
  // dossier avant de pouvoir accepter le premier upload.
  fs.mkdirSync(UPLOADS, { recursive: true });
  console.log(`[startup] Dossier des uploads prêt : ${UPLOADS}`);
} catch (error) {
  console.error("[startup] Impossible de créer le dossier des uploads", error);
  throw error;
}

// Ce secret reste côté serveur. Il ne doit jamais être copié dans Angular.
// Il signe les JWT et les URL des photos (services/images.js).
export const SECRET = process.env.JWT_SECRET || "tp1-development-secret";
