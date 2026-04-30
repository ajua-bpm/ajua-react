import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

export const firebaseConfig = {
  apiKey:            "AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY",
  authDomain:        "ajuabmp.firebaseapp.com",
  projectId:         "ajuabmp",
  storageBucket:     "ajuabmp.firebasestorage.app",
  messagingSenderId: "681963417089",
  appId:             "1:681963417089:web:96b3b75e8d995b0e501a00",
};

const app = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// Messaging — solo disponible en contextos con Service Worker (no SSR)
let messaging = null;
try {
  messaging = getMessaging(app);
} catch { /* Service workers no disponibles en este contexto */ }
export { messaging, getToken, onMessage };

// Re-export Firestore helpers
export { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot };

// Re-export Storage helpers
export { ref, uploadBytes, getDownloadURL, uploadString };

export async function uploadBase64(base64DataUrl, path) {
  const storageRef = ref(storage, path);
  await uploadString(storageRef, base64DataUrl, 'data_url');
  return getDownloadURL(storageRef);
}
