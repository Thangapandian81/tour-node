const admin = require('firebase-admin');
const serviceAccount = require('./firebaseServiceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://holiday-2e7ae.firebaseio.com"
});

const db = admin.firestore();
module.exports = { admin, db };