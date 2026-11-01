// Préparation globale des tests (angular.json > test > setupFiles), exécutée
// avant chaque fichier de test.
//
// jsdom, le faux navigateur des tests, ne fournit pas les URL d'objet
// (URL.createObjectURL / revokeObjectURL). Or ngx-image-cropper en crée une
// dès son chargement (V2, étape 3) : sans ces remplaçants, tout fichier de
// test qui importe, même indirectement, la fenêtre d'ajout de carte échoue
// avant d'avoir commencé.
//
// Remplacement inconditionnel : la fonction existe, mais c'est celle de
// Node.js, qui ne sait pas lire un Blob créé par jsdom (« Cannot read
// properties of undefined (reading '_buffer') »).
URL.createObjectURL = () => 'blob:test';
URL.revokeObjectURL = () => undefined;
