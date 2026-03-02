import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBnUSQP7dAY-h-IfV74QTPE2uRyXR9iFSM",
  authDomain: "erp-project-52279.firebaseapp.com",
  projectId: "erp-project-52279",
  storageBucket: "erp-project-52279.firebasestorage.app",
  messagingSenderId: "594029762817",
  appId: "1:594029762817:web:df095c291fa622193fe300"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
