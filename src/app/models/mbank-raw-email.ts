/** Mirrors MBankRawEmailResponse from the WebApi (no HTML body). */
export interface MbankRawEmail {
  id: number;
  messageId: string;
  threadId: string;
  source: string;
  subject: string | null;
  attachmentName: string | null;
  emailDate: string | null;
  status: 'NEW' | 'PROCESSED' | 'ERROR' | string;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  spendingsCount: number;
  balancesCount: number;
}
