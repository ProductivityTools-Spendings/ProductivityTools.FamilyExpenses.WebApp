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
  /** amount in PLN (NBP mid rate, D-1); equals amount for PLN rows; null until a rate is available */
  amountPln: number | null;
  fxRate: number | null;
  fxRateDate: string | null;
  name: string | null;
  amountLeft: string | null;
  amountLeftCurrency: string | null;
  details: string;
  createdAt: string;
  // spending_details (null when no details row exists yet)
  /** FK to dictionary_account; `account` is the resolved name */
  accountId: number | null;
  account: string | null;
  category: string | null;
  note: string | null;
  allegroRawEmailId: number | null;
  /** id of the canonical spending this row duplicates (debit mirroring a transfer); null = counts */
  duplicateOf: number | null;
  detailsUpdatedAt: string | null;
  // refund marking / linking
  /** true when the user expects this expense to be refunded */
  refundExpected: boolean;
  /** for an expense: id of the linked refund row; null = not linked yet */
  refundSpendingId: number | null;
  /** for a refund row: id of the expense it refunds; null = this row is not a refund */
  refundOfSpendingId: number | null;
}
