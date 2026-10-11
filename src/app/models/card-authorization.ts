/** Mirrors CardAuthorizationResponse from the WebApi. */
export interface CardAuthorization {
  id: number;
  rawEmailId: number;
  operationId: string;
  operationDate: string | null;
  operationTime: string | null;
  card: string;
  merchant: string | null;
  amount: number;
  currency: string | null;
  amountLeft: string | null;
  amountLeftCurrency: string | null;
  details: string;
  createdAt: string;
  // settlement (null when not linked to a booked debit yet)
  settledBySpendingId: number | null;
  settledOperationDate: string | null;
  settledAmount: number | null;
  settledCurrency: string | null;
  settledAccount: string | null;
  settledCategory: string | null;
}

export interface LinkResult {
  linked: number;
  totalLinked: number;
  totalUnlinked: number;
}
