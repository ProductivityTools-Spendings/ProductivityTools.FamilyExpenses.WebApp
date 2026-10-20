import { firebaseConfig } from './firebase.config';

export const environment = {
  production: true,
  apiUrl: 'https://spendings-api.productivitytools.top',
  firebase: firebaseConfig,
  /** Apps Script web app (doGet) that pulls mBank e-mails from Gmail into the API; empty = link hidden. */
  mbankGmailImportUrl: '',
};
