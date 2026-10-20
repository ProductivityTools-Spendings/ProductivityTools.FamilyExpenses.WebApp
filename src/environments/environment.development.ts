import { firebaseConfig } from './firebase.config';

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8086',
  firebase: firebaseConfig,
  /** Apps Script web app (doGet) that pulls mBank e-mails from Gmail into the API; empty = link hidden. */
  mbankGmailImportUrl: '',
};
