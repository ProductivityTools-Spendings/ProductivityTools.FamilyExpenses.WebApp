import { firebaseConfig } from './firebase.config';

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8086',
  firebase: firebaseConfig,
  /** Apps Script web app (doGet) that pulls mBank e-mails from Gmail into the API; empty = link hidden. */
  mbankGmailImportUrl: 'https://script.google.com/macros/s/AKfycbx24hU7s4h11vXvf4ZSuNagWP9lgfG1RuJKaiKgf6eHXOKtUwnD617rDT3VJQ3pZvZC/exec',
};
