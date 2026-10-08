import {
  EnvironmentProviders,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { FirebaseApp, FirebaseOptions, getApps, initializeApp } from 'firebase/app';

/** Inject this token to get the initialized Firebase app (e.g. to call getAuth(app), getFirestore(app)). */
export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');

/**
 * Initializes Firebase once at bootstrap and exposes it through {@link FIREBASE_APP}.
 * Usage in app.config.ts: provideFirebase(environment.firebase)
 */
export function provideFirebase(options: FirebaseOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: FIREBASE_APP,
      useFactory: () => getApps()[0] ?? initializeApp(options),
    },
    // Eagerly initialize so Firebase is ready before the first component renders.
    provideAppInitializer(() => {
      inject(FIREBASE_APP);
    }),
  ]);
}
