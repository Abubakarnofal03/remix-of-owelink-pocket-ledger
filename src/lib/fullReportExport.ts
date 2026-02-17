import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, subDays, subMonths, startOfDay } from "date-fns";
import { getCurrencySymbol } from "./currencies";
import { savePDF } from "./pdfSave";

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

const COLORS = {
  primary: [99, 102, 241] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  dark: [31, 41, 55] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  blue: [59, 130, 246] as [number, number, number],
};

function fmt(amount: number, currency: string): string {
  return `${getCurrencySymbol(currency)} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ensureSpace(doc: jsPDFWithAutoTable, y: number, needed = 30): number {
  if (y > doc.internal.pageSize.getHeight() - needed) {
    doc.addPage();
    return 20;
  }
  return y;
}

export type ReportDuration = "7d" | "30d" | "90d" | "6m" | "1y" | "all";

const DURATION_LABELS: Record<ReportDuration, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  "6m": "Last 6 Months",
  "1y": "Last 1 Year",
  all: "All Time",
};

function getStartDate(duration: ReportDuration): Date {
  const now = new Date();
  switch (duration) {
    case "7d": return subDays(now, 7);
    case "30d": return subDays(now, 30);
    case "90d": return subDays(now, 90);
    case "6m": return subMonths(now, 6);
    case "1y": return subMonths(now, 12);
    case "all": return new Date(0);
  }
}

interface FullReportData {
  username: string;
  currency: string;
  duration: ReportDuration;
  balances: { owedToYou: number; youOwe: number; netBalance: number };
  bills: Array<{
    title: string;
    total_amount: number;
    currency: string;
    status: string;
    due_date: string | null;
    created_at: string;
    participants?: Array<{
      phone_number: string;
      amount_owed: number;
      amount_paid: number;
      status: string;
    }>;
  }>;
  ious: Array<{
    description: string | null;
    amount: number;
    amount_paid: number;
    currency: string;
    status: string;
    debtor_phone_number: string;
    direction?: string;
    due_date: string | null;
    created_at: string;
  }>;
  expenses: Array<{
    amount: number;
    description: string | null;
    currency: string;
    created_at: string;
    bucket_id: string | null;
  }>;
  buckets: Array<{ id: string; name: string }>;
  contacts: Array<{
    nickname: string | null;
    phone_number: string;
    source: string;
  }>;
  insightsSummary?: string | null;
  insightsTips?: string[];
  getContactName: (phone: string) => string | null;
}

export async function exportFullReport(data: FullReportData) {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const pw = doc.internal.pageSize.getWidth();
  const startDate = getStartDate(data.duration);
  const label = DURATION_LABELS[data.duration];

  // Filter by duration
  const inRange = (dateStr: string) => new Date(dateStr) >= startDate;
  const bills = data.bills.filter((b) => inRange(b.created_at));
  const ious = data.ious.filter((i) => inRange(i.created_at));
  const expenses = data.expenses.filter((e) => inRange(e.created_at));

  // ── HEADER ───────────────────────────────────
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pw, 32, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Owelink — Complete Report", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.username} • ${label}`, 14, 22);
  doc.setFontSize(8);
  doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, pw - 14, 22, { align: "right" });
  doc.setTextColor(...COLORS.dark);

  let y = 40;

  // ── BALANCE OVERVIEW ─────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Balance Overview", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Owed to You", "You Owe", "Net Balance"]],
    body: [[
      fmt(data.balances.owedToYou, data.currency),
      fmt(data.balances.youOwe, data.currency),
      `${data.balances.netBalance >= 0 ? "+" : ""}${fmt(Math.abs(data.balances.netBalance), data.currency)}`,
    ]],
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 10, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 12;

  // ── AI INSIGHTS ──────────────────────────────
  if (data.insightsSummary) {
    y = ensureSpace(doc, y, 50);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("✦ AI Insights", 14, y);
    y += 6;
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(data.insightsSummary, pw - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 4;

    if (data.insightsTips && data.insightsTips.length > 0) {
      y = ensureSpace(doc, y, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Tips", 14, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      data.insightsTips.forEach((tip, i) => {
        y = ensureSpace(doc, y, 10);
        const tipLines = doc.splitTextToSize(`${i + 1}. ${tip}`, pw - 32);
        doc.text(tipLines, 18, y);
        y += tipLines.length * 3.5 + 2;
      });
    }
    y += 6;
  }

  // ── BILLS ────────────────────────────────────
  y = ensureSpace(doc, y, 40);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(`Bills (${bills.length})`, 14, y);
  y += 6;

  if (bills.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Title", "Amount", "Status", "Due", "Created"]],
      body: bills.map((b, i) => [
        i + 1,
        b.title,
        fmt(b.total_amount, b.currency),
        b.status.toUpperCase(),
        b.due_date ? format(new Date(b.due_date), "MMM d, yy") : "—",
        format(new Date(b.created_at), "MMM d, yy"),
      ]),
      headStyles: { fillColor: COLORS.success, textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: { 2: { halign: "right", fontStyle: "bold" }, 3: { halign: "center" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text("No bills in this period.", 14, y);
    y += 8;
  }

  // ── IOUs ─────────────────────────────────────
  y = ensureSpace(doc, y, 40);
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Owes / IOUs (${ious.length})`, 14, y);
  y += 6;

  if (ious.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Description", "Person", "Amount", "Paid", "Status", "Direction"]],
      body: ious.map((o, i) => {
        const name = data.getContactName(o.debtor_phone_number);
        return [
          i + 1,
          o.description || "—",
          name ? `${name}` : o.debtor_phone_number,
          fmt(o.amount, o.currency),
          fmt(o.amount_paid, o.currency),
          o.status.toUpperCase(),
          (o.direction === "i_owe" ? "You owe" : "Owed to you"),
        ];
      }),
      headStyles: { fillColor: COLORS.blue, textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "center" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text("No IOUs in this period.", 14, y);
    y += 8;
  }

  // ── EXPENSES ─────────────────────────────────
  y = ensureSpace(doc, y, 40);
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  doc.text(`Expenses (${expenses.length}) — Total: ${fmt(expTotal, data.currency)}`, 14, y);
  y += 6;

  if (expenses.length > 0) {
    const bucketMap = new Map(data.buckets.map((b) => [b.id, b.name]));
    autoTable(doc, {
      startY: y,
      head: [["#", "Date", "Description", "Bucket", "Amount"]],
      body: expenses.map((e, i) => [
        i + 1,
        format(new Date(e.created_at), "MMM d, yy"),
        e.description || "—",
        e.bucket_id ? bucketMap.get(e.bucket_id) || "—" : "Uncategorized",
        fmt(e.amount, e.currency),
      ]),
      headStyles: { fillColor: COLORS.amber, textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      columnStyles: { 4: { halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text("No expenses in this period.", 14, y);
    y += 8;
  }

  // ── CONTACTS LEDGER ──────────────────────────
  if (data.contacts.length > 0) {
    y = ensureSpace(doc, y, 40);
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Contacts (${data.contacts.length})`, 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["#", "Name", "Phone", "Source"]],
      body: data.contacts.map((c, i) => [
        i + 1,
        c.nickname || "—",
        c.phone_number,
        c.source === "device" ? "Phone Book" : "Manual",
      ]),
      headStyles: { fillColor: COLORS.muted, textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });
  }

  // ── FOOTER ───────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Page ${i} of ${pageCount}`, pw / 2, ph - 8, { align: "center" });
    doc.text("Owelink — Complete Report", 14, ph - 8);
  }

  const dateStr = format(new Date(), "yyyy-MM-dd");
  await savePDF(doc, `owelink-full-report-${data.duration}-${dateStr}.pdf`);
}
