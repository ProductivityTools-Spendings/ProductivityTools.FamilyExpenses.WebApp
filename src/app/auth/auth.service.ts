import { inject, Injectable, signal } from '@angular/core';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { FIREBASE_APP } from '../firebase/firebase.providers';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = getAuth(inject(FIREBASE_APP));

  /** Currently signed-in user, or null. Undefined until Firebase restores the session. */
  readonly user = signal<User | null | undefined>(undefined);

  constructor() {
    onAuthStateChanged(this.auth, (user) => this.user.set(user));
  }

  /** Resolves once Firebase has restored (or not) a persisted session, so guards don't flash the login page. */
  ready(): Promise<void> {
    return this.auth.authStateReady();
  }

  isLoggedIn(): boolean {
    return !!this.user();
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(this.auth, provider);
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  /** Fresh Firebase ID token (auto-refreshed by the SDK) or null when not signed in. */
  async getIdToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    return user ? user.getIdToken() : null;
  }
}
