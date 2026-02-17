import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Loader2, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBills } from "@/hooks/useBills";
import { useIOUs } from "@/hooks/useIOUs";
import { useExpenses } from "@/hooks/useExpenses";
import { useExpenseBuckets } from "@/hooks/useExpenseBuckets";
import { useContacts } from "@/hooks/useContacts";
import { useBalances } from "@/hooks/useBalances";
import { useInsights } from "@/hooks/useInsights";
import { exportFullReport, ReportDuration } from "@/lib/fullReportExport";
import { toast } from "sonner";

const durations: { value: ReportDuration; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "6m", label: "Last 6 Months" },
  { value: "1y", label: "Last Year" },
  { value: "all", label: "All Time" },
];

export function ExportReportDialog() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ReportDuration>("30d");
  const [exporting, setExporting] = useState(false);

  const { profile, currency } = useAuth();
  const { bills } = useBills();
  const { ious } = useIOUs();
  const { expenses } = useExpenses();
  const { buckets } = useExpenseBuckets();
  const { contacts } = useContacts();
  const { owedToYou, youOwe, netBalance } = useBalances();
  const { data: insightsData } = useInsights();

  const getContactName = (phone: string): string | null => {
    const c = contacts.find(
      (ct) => ct.phone_number === phone || ct.phone_number.endsWith(phone.slice(-7))
    );
    return c?.nickname || null;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportFullReport({
        username: profile?.username || "User",
        currency: currency || "USD",
        duration: selected,
        balances: { owedToYou, youOwe, netBalance },
        bills: bills.map((b) => ({
          title: b.title,
          total_amount: b.total_amount,
          currency: b.currency,
          status: b.status,
          due_date: b.due_date,
          created_at: b.created_at,
          participants: b.participants?.map((p) => ({
            phone_number: p.phone_number,
            amount_owed: p.amount_owed,
            amount_paid: p.amount_paid,
            status: p.status,
          })),
        })),
        ious: ious.map((i) => ({
          description: i.description,
          amount: i.amount,
          amount_paid: i.amount_paid,
          currency: i.currency,
          status: i.status,
          debtor_phone_number: i.debtor_phone_number,
          direction: i.direction,
          due_date: i.due_date,
          created_at: i.created_at,
        })),
        expenses: expenses.map((e) => ({
          amount: e.amount,
          description: e.description,
          currency: e.currency,
          created_at: e.created_at,
          bucket_id: e.bucket_id,
        })),
        buckets: buckets.map((b) => ({ id: b.id, name: b.name })),
        contacts: contacts.map((c) => ({
          nickname: c.nickname,
          phone_number: c.phone_number,
          source: c.source,
        })),
        insightsSummary: insightsData?.summary || null,
        insightsTips: insightsData?.tips || [],
        getContactName,
      });
      toast.success("Report exported!");
      setOpen(false);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl"
        >
          <Download className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Export Full Report
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Generate a PDF with balances, AI insights, bills, IOUs, expenses, and contacts.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Select Duration</p>
          <div className="grid grid-cols-2 gap-2">
            {durations.map((d) => (
              <button
                key={d.value}
                onClick={() => setSelected(d.value)}
                className={`text-sm py-2.5 px-3 rounded-xl font-medium transition-colors border ${
                  selected === d.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleExport} disabled={exporting} className="w-full mt-2">
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
