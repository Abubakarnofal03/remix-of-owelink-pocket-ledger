export const APP_NAME = "Owelink";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  PKR: "₨",
  INR: "₹",
  AED: "د.إ",
  SAR: "﷼",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CNY: "¥",
  BDT: "৳",
  MYR: "RM",
  SGD: "S$",
  QAR: "﷼",
  KWD: "د.ك",
  BHD: "ب.د",
  OMR: "ر.ع.",
};

export const DEFAULT_CURRENCY = "USD";

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

export const REFERENCE_TYPES = {
  BILL: "bill",
  IOU: "iou",
  INVOICE: "invoice",
} as const;

export const NOTIFICATION_TYPES = {
  BILL: "bill",
  IOU: "iou",
  INVOICE: "invoice",
  PAYMENT: "payment",
  REMINDER: "reminder",
  SYSTEM: "system",
} as const;
