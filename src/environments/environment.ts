import { firebaseConfig } from './firebase.config';

export const environment = {
  production: true,
  apiUrl: 'https://spendings-api.productivitytools.top',
  firebase: firebaseConfig,
  /** Apps Script web app (doGet) that pulls mBank e-mails from Gmail into the API; empty = link hidden. */
  /** Apps Script web app (doGet) that pulls Allegro e-mails from Gmail into the API; empty = link hidden. */
  allegroGmailImportUrl: 'https://script.google.com/macros/s/AKfycbxUHqQE8xJpgvRTZp5UiCQ9zJtQtWLa336FZvHA6wKQI_2ZkXl18OeaADQz2mwO4r6kIg/exec',
  mbankGmailImportUrl: 'https://script.google.com/macros/s/AKfycbx24hU7s4h11vXvf4ZSuNagWP9lgfG1RuJKaiKgf6eHXOKtUwnD617rDT3VJQ3pZvZC/exec',
};
