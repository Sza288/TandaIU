import { auth } from './firebase';
import { User } from 'firebase/auth';

export interface CurrentUser {
  uid: string;
  name: string;
  email: string;
  role: 'assistant' | 'praktikan';
  studentCode?: string;
}

/**
 * Returns the currently authenticated user.
 * If Firebase Auth is not yet initialized (development baseline), returns a mock
 * praktikan – Andi Pratama – defined in src/data/praktikans.ts.
 */
export function getCurrentUser(): CurrentUser {
  const firebaseUser = auth.currentUser as User | null;

  if (firebaseUser) {
    // In real app we would fetch the role from Firestore `users/{uid}`.
    // For baseline we just return a placeholder that can be overridden later.
    return {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName ?? 'unknown',
      email: firebaseUser.email ?? '',
      role: 'praktikan', // will be replaced by real role after DB lookup
    };
  }

  // ---------- MOCK MODE (baseline) ----------
  // Praktikan dummy – Andi Pratama (matches src/data/praktikans.ts)
  return {
    uid: 'p1',
    name: 'Andi Pratama',
    email: 'andi.pratama@students.undip.ac.id',
    role: 'praktikan',
    studentCode: '24060124120001',
  };
}
