// On-device parser for bank/wallet/SMS notification text.
// Extracts amount, merchant, type. No network calls.

export interface ParsedTxn {
  amount: number | null;
  currency: string;
  merchant: string | null;
  type: 'debit' | 'credit' | 'unknown';
  source: string | null;
  timestamp: number;
  rawText: string;
}

const DEBIT_KEYWORDS = /\b(debit(ed)?|spent|paid|purchase|withdraw(n|al)?|sent|transferred|charged)\b/i;
const CREDIT_KEYWORDS = /\b(credit(ed)?|received|deposited|refunded|cashback)\b/i;

// Matches "Rs 1,234.56" / "PKR 500" / "Rs.500" / "Rs500.00"
const AMOUNT_RE = /(?:Rs\.?|PKR|INR|₨|₹|\$|USD|EUR|€|£|GBP)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;
const FALLBACK_AMOUNT_RE = /\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+\.[0-9]{2})\b/;

// "at MERCHANT" / "to MERCHANT" / "from MERCHANT"
const MERCHANT_RE = /\b(?:at|to|from|@)\s+([A-Z][A-Za-z0-9&'\-. ]{2,40}?)(?=\s+(?:on|via|using|with|for|ref|trx|txn|dated|account|a\/c|\.|,|$)|\s*$)/;

const PACKAGE_TO_SOURCE: Record<string, string> = {
  'com.meezanbank.mobile': 'Meezan Bank',
  'com.hbl.android.hblmobilebanking': 'HBL',
  'com.ubl.android': 'UBL',
  'com.bankalfalah.alfa': 'Bank Alfalah',
  'pk.com.telenor.phoenix': 'EasyPaisa',
  'com.techlogix.mobilinkcustomer': 'JazzCash',
  'com.sadapay.mast': 'Sadapay',
  'pk.nayapay.app': 'Nayapay',
};

export interface ParserInput {
  packageName: string;
  title: string;
  text: string;
  postedAt: number;
}

export function parseTxnSignal(input: ParserInput): ParsedTxn {
  const haystack = `${input.title || ''}\n${input.text || ''}`.trim();

  // Quick reject: must contain a money-like token to count as transactional
  let amount: number | null = null;
  let currency = 'PKR';
  const m1 = haystack.match(AMOUNT_RE);
  if (m1) {
    amount = parseFloat(m1[1].replace(/,/g, ''));
    const sym = m1[0].split(/[0-9]/)[0].trim().toLowerCase();
    if (sym.includes('inr') || sym.includes('₹')) currency = 'INR';
    else if (sym.includes('$') || sym.includes('usd')) currency = 'USD';
    else if (sym.includes('€') || sym.includes('eur')) currency = 'EUR';
    else if (sym.includes('£') || sym.includes('gbp')) currency = 'GBP';
  } else {
    const m2 = haystack.match(FALLBACK_AMOUNT_RE);
    if (m2) amount = parseFloat(m2[1].replace(/,/g, ''));
  }

  let type: 'debit' | 'credit' | 'unknown' = 'unknown';
  if (DEBIT_KEYWORDS.test(haystack)) type = 'debit';
  else if (CREDIT_KEYWORDS.test(haystack)) type = 'credit';

  let merchant: string | null = null;
  const m3 = haystack.match(MERCHANT_RE);
  if (m3) merchant = m3[1].trim().replace(/\s+/g, ' ');

  const source =
    PACKAGE_TO_SOURCE[input.packageName] ||
    (input.packageName?.startsWith('sms:') ? input.packageName.slice(4) : input.title || null);

  return {
    amount: Number.isFinite(amount) ? amount : null,
    currency,
    merchant,
    type,
    source,
    timestamp: input.postedAt || Date.now(),
    rawText: haystack,
  };
}
