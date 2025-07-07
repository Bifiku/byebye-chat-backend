import fs from 'fs';
import path from 'path';

import admin from 'firebase-admin';

const serviceAccountPath = path.join(__dirname, 'secrets', 'firebase-key.json');

/* --------- читаем JSON «старым» способом, чтобы не нужен был assert -------- */
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

/* --------- инициализируем Firebase Admin (делаем это один раз) ------------ */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export default admin;
