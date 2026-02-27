import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// ⚠️ Firebase Console → Project Settings → Your apps → Config
// Bu değerleri kendi Firebase projenizden almanız gerekir.
const firebaseConfig = {
  apiKey: "AIzaSyDEMO_REPLACE_ME",
  authDomain: "brg-erp.firebaseapp.com",
  projectId: "brg-erp",
  storageBucket: "brg-erp.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
