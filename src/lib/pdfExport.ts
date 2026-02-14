import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { getCurrencySymbol } from "./currencies";

// Extend jsPDF type for autotable
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
  light: [249, 250, 251] as [number, number, number],
};

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 28, "F");

  // App name
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Owelink", 14, 12);

  // Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 20);

  // Date on the right
  doc.setFontSize(8);
  doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, pageWidth - 14, 20, { align: "right" });

  if (subtitle) {
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9);
    doc.text(subtitle, 14, 34);
  }

  doc.setTextColor(...COLORS.dark);
  return subtitle ? 40 : 34;
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.text("Owelink — Exported Report", 14, pageHeight - 8);
  }
}

function fmt(amount: number, currency: string): string {
  return `${getCurrencySymbol(currency)} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Expenses Export ──────────────────────────────────────────
export function exportExpensesPDF(
  expenses: Array<{
    amount: number;
    description: string | null;
    currency: string;
    created_at: string;
    bucket_id: string | null;
  }>,
  buckets: Array<{ id: string; name: string; color: string | null }>,
  currency: string,
  filterLabel: string
) {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  let y = addHeader(doc, "Expenses Report", `Period: ${filterLabel} | Total: ${fmt(total, currency)} | ${expenses.length} expense(s)`);

  const bucketMap = new Map(buckets.map(b => [b.id, b.name]));

  autoTable(doc, {
    startY: y,
    head: [["#", "Date", "Description", "Bucket", "Amount"]],
    body: expenses.map((e, i) => [
      i + 1,
      format(new Date(e.created_at), "MMM d, yyyy"),
      e.description || "—",
      e.bucket_id ? bucketMap.get(e.bucket_id) || "—" : "Uncategorized",
      fmt(e.amount, e.currency),
    ]),
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 4: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  // Detailed breakdown by bucket
  if (buckets.length > 0) {
    y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Breakdown by Bucket", 14, y);
    y += 2;

    // Each bucket with its expenses listed
    buckets.forEach((bucket) => {
      const bucketExpenses = expenses.filter(e => e.bucket_id === bucket.id);
      if (bucketExpenses.length === 0) return;

      const bucketTotal = bucketExpenses.reduce((s, e) => s + e.amount, 0);

      y = doc.lastAutoTable.finalY + 8;
      if (y > 255) { doc.addPage(); y = 20; }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.primary);
      doc.text(`${bucket.name}  —  ${bucketExpenses.length} expense(s)  |  Total: ${fmt(bucketTotal, currency)}`, 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [["#", "Date", "Description", "Amount"]],
        body: bucketExpenses.map((e, i) => [
          i + 1,
          format(new Date(e.created_at), "MMM d, yyyy"),
          e.description || "—",
          fmt(e.amount, e.currency),
        ]),
        headStyles: { fillColor: [75, 85, 99], textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
        margin: { left: 20, right: 14 },
      });
    });

    // Uncategorized expenses
    const uncategorized = expenses.filter(e => !e.bucket_id);
    if (uncategorized.length > 0) {
      const uncatTotal = uncategorized.reduce((s, e) => s + e.amount, 0);

      y = doc.lastAutoTable.finalY + 8;
      if (y > 255) { doc.addPage(); y = 20; }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.muted);
      doc.text(`Uncategorized  —  ${uncategorized.length} expense(s)  |  Total: ${fmt(uncatTotal, currency)}`, 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [["#", "Date", "Description", "Amount"]],
        body: uncategorized.map((e, i) => [
          i + 1,
          format(new Date(e.created_at), "MMM d, yyyy"),
          e.description || "—",
          fmt(e.amount, e.currency),
        ]),
        headStyles: { fillColor: [107, 114, 128], textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
        margin: { left: 20, right: 14 },
      });
    }
  }

  addFooter(doc);
  doc.save(`owelink-expenses-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ─── Bills Export ──────────────────────────────────────────────
export function exportBillsPDF(
  bills: Array<{
    title: string;
    description: string | null;
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
  }>,
  getContactName: (phone: string) => string | null
) {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const totalAmount = bills.reduce((s, b) => s + b.total_amount, 0);
  const paidBills = bills.filter(b => b.status === "paid").length;
  let y = addHeader(doc, "Bills Report", `${bills.length} bill(s) | Paid: ${paidBills} | Total: ${fmt(totalAmount, bills[0]?.currency || "USD")}`);

  // Bills table
  autoTable(doc, {
    startY: y,
    head: [["#", "Title", "Amount", "Status", "Due Date", "Created", "Participants"]],
    body: bills.map((b, i) => [
      i + 1,
      b.title,
      fmt(b.total_amount, b.currency),
      b.status.toUpperCase(),
      b.due_date ? format(new Date(b.due_date), "MMM d, yyyy") : "—",
      format(new Date(b.created_at), "MMM d, yyyy"),
      b.participants?.length?.toString() || "0",
    ]),
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      2: { halign: "right", fontStyle: "bold" },
      3: { halign: "center" },
    },
    margin: { left: 14, right: 14 },
  });

  // Detail per bill with participants
  bills.forEach((bill, idx) => {
    if (!bill.participants || bill.participants.length === 0) return;

    y = doc.lastAutoTable.finalY + 8;
    if (y > 260) { doc.addPage(); y = 20; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text(`${idx + 1}. ${bill.title} — Participants`, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Name / Phone", "Amount Owed", "Amount Paid", "Remaining", "Status"]],
      body: bill.participants.map(p => {
        const name = getContactName(p.phone_number);
        const remaining = p.amount_owed - p.amount_paid;
        return [
          name ? `${name} (${p.phone_number})` : p.phone_number,
          fmt(p.amount_owed, bill.currency),
          fmt(p.amount_paid, bill.currency),
          fmt(remaining > 0 ? remaining : 0, bill.currency),
          p.status.toUpperCase(),
        ];
      }),
      headStyles: { fillColor: [75, 85, 99], textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right", fontStyle: "bold" },
        4: { halign: "center" },
      },
      margin: { left: 20, right: 14 },
    });
  });

  addFooter(doc);
  doc.save(`owelink-bills-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ─── Owes (IOUs) Export ───────────────────────────────────────
export function exportOwesPDF(
  owedToMe: Array<{
    debtor_phone_number: string;
    amount: number;
    amount_paid: number;
    currency: string;
    description: string | null;
    status: string;
    due_date: string | null;
    created_at: string;
  }>,
  iOwe: Array<{
    debtor_phone_number: string;
    creditor_phone_number?: string | null;
    creditor_username?: string | null;
    amount: number;
    amount_paid: number;
    currency: string;
    description: string | null;
    status: string;
    due_date: string | null;
    created_at: string;
  }>,
  getContactName: (phone: string) => string | null
) {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const totalOwed = owedToMe.reduce((s, i) => s + (i.amount - i.amount_paid), 0);
  const totalIOwe = iOwe.reduce((s, i) => s + (i.amount - i.amount_paid), 0);
  const curr = owedToMe[0]?.currency || iOwe[0]?.currency || "USD";

  let y = addHeader(doc, "Owes Report", `Owed to you: ${fmt(totalOwed, curr)} | You owe: ${fmt(totalIOwe, curr)}`);

  // Owed to me
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.success);
  doc.text("Owed to You", 14, y);
  y += 4;

  if (owedToMe.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Person", "Description", "Amount", "Paid", "Remaining", "Status", "Due Date", "Created"]],
      body: owedToMe.map((o, i) => {
        const name = getContactName(o.debtor_phone_number);
        const remaining = o.amount - o.amount_paid;
        return [
          i + 1,
          name ? `${name} (${o.debtor_phone_number})` : o.debtor_phone_number,
          o.description || "—",
          fmt(o.amount, o.currency),
          fmt(o.amount_paid, o.currency),
          fmt(remaining > 0 ? remaining : 0, o.currency),
          o.status.toUpperCase(),
          o.due_date ? format(new Date(o.due_date), "MMM d, yyyy") : "—",
          format(new Date(o.created_at), "MMM d, yyyy"),
        ];
      }),
      headStyles: { fillColor: COLORS.success, textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
        6: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 12;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text("No records", 14, y + 4);
    y += 12;
  }

  // I owe
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.danger);
  doc.text("You Owe", 14, y);
  y += 4;

  if (iOwe.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Creditor", "Description", "Amount", "Paid", "Remaining", "Status", "Due Date", "Created"]],
      body: iOwe.map((o, i) => {
        const name = o.creditor_username || getContactName(o.creditor_phone_number || o.debtor_phone_number) || o.creditor_phone_number;
        const remaining = o.amount - o.amount_paid;
        return [
          i + 1,
          name || "Unknown",
          o.description || "—",
          fmt(o.amount, o.currency),
          fmt(o.amount_paid, o.currency),
          fmt(remaining > 0 ? remaining : 0, o.currency),
          o.status.toUpperCase(),
          o.due_date ? format(new Date(o.due_date), "MMM d, yyyy") : "—",
          format(new Date(o.created_at), "MMM d, yyyy"),
        ];
      }),
      headStyles: { fillColor: COLORS.danger, textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
        6: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text("No records", 14, y + 4);
  }

  addFooter(doc);
  doc.save(`owelink-owes-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ─── Contacts Export ──────────────────────────────────────────
export function exportContactsPDF(
  contacts: Array<{
    nickname: string | null;
    phone_number: string;
    source: string;
    created_at: string;
  }>
) {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  let y = addHeader(doc, "Contacts Report", `${contacts.length} contact(s)`);

  autoTable(doc, {
    startY: y,
    head: [["#", "Name", "Phone Number", "Source", "Added"]],
    body: contacts.map((c, i) => [
      i + 1,
      c.nickname || "—",
      c.phone_number,
      c.source === "device" ? "Phone Book" : "Manual",
      format(new Date(c.created_at), "MMM d, yyyy"),
    ]),
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`owelink-contacts-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ─── Contact Detail Export ────────────────────────────────────
export function exportContactDetailPDF(
  contact: { nickname: string | null; phone_number: string },
  timeline: Array<{
    title: string;
    description: string;
    amount: number;
    amountPaid: number;
    currency: string;
    status: string;
    date: string;
    isCredit: boolean;
    type: string;
  }>,
  totalOwedToYou: number,
  totalYouOwe: number,
  netBalance: number,
  currency: string
) {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const name = contact.nickname || contact.phone_number;
  let y = addHeader(doc, `Contact: ${name}`, `Phone: ${contact.phone_number}`);

  // Balance summary
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Balance Summary", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Owes You", "You Owe", "Net Balance"]],
    body: [[
      fmt(totalOwedToYou, currency),
      fmt(totalYouOwe, currency),
      `${netBalance >= 0 ? "+" : ""}${fmt(Math.abs(netBalance), currency)} ${netBalance > 0 ? "(They owe you)" : netBalance < 0 ? "(You owe them)" : "(Settled)"}`,
    ]],
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Transaction history
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Transaction History", 14, y);
  y += 4;

  if (timeline.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Date", "Title", "Description", "Type", "Amount", "Paid", "Remaining", "Status"]],
      body: timeline.map((t, i) => {
        const remaining = t.amount - t.amountPaid;
        return [
          i + 1,
          format(new Date(t.date), "MMM d, yyyy"),
          t.title,
          t.description,
          t.isCredit ? "↓ Owed to you" : "↑ You owe",
          fmt(t.amount, t.currency),
          fmt(t.amountPaid, t.currency),
          fmt(remaining > 0 ? remaining : 0, t.currency),
          t.status.toUpperCase(),
        ];
      }),
      headStyles: { fillColor: [75, 85, 99], textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right", fontStyle: "bold" },
        8: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  doc.save(`owelink-contact-${name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
