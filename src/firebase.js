import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY",
  authDomain:        "ajuabmp.firebaseapp.com",
  projectId:         "ajuabmp",
  storageBucket:     "ajuabmp.firebasestorage.app",
  messagingSenderId: "681963417089",
  appId:             "1:681963417089:web:96b3b75e8d995b0e501a00",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Re-export Firestore helpers
export { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot };
