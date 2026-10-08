/** Mirrors SpendingResponse from the WebApi (spendings LEFT JOIN spending_details). */
export interface Spending {
  id: number;
  rawEmailId: number;
  operationId: string;
  operationDate: string | null;
  operationTime: string | null;
  operationType: string;
  srcAccount: string | null;
  dstAccount: string | null;
  amount: number;
  currency: string | null;
  name: string | null;
  amountLeft: string | null;
  amountLeftCurrency: string | null;
  details: string;
  createdAt: string;
  // spending_details (null when no details row exists yet)
  account: string | null;
  category: string | null;
  note: string | null;
  allegroRawEmailId: number | null;
  detailsUpdatedAt: string | null;
}
