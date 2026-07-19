import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Khởi tạo lười (lazy), chỉ chạm vào Firebase SDK khi thật sự dùng trong
// trình duyệt — tránh SSR/prerender lỗi lúc chưa có config Firebase thật.
let authInstance: Auth | undefined;
let firestoreInstance: Firestore | undefined;

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  authInstance ??= getAuth(getFirebaseApp());
  return authInstance;
}

// Đọc trực tiếp Firestore từ trình duyệt (real-time, vd bình luận qua
// onSnapshot) — LẦN ĐẦU web app dùng, cần rule tương ứng trong firestore.rules
// cho phép đọc (ghi vẫn luôn qua API route dùng Admin SDK).
export function getFirebaseFirestore(): Firestore {
  firestoreInstance ??= getFirestore(getFirebaseApp());
  return firestoreInstance;
}

export function createGoogleProvider(): GoogleAuthProvider {
  return new GoogleAuthProvider();
}
