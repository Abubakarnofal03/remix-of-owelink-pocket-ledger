import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileText,
  DollarSign,
  Download,
} from "lucide-react";
import { exportContactDetailPDF } from "@/lib/pdfExport";
import { useContactTimeline, TimelineItem } from "@/hooks/useContactTimeline";
import { useCurrency } from "@/hooks/useCurrency";

export default function ContactDetail() {
  const { user, loading: authLoading } = useAuth();
  const { currency } = useCurrency();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const {
    contact,
    timeline,
    totalOwedToYou,
    totalYouOwe,
    netBalance,
    loading,
  } = useContactTimeline(id);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="space-y-4 animate-fade-in">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!contact) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Contact not found</p>
          <Button variant="link" onClick={() => navigate("/contacts")}>
            Go back to contacts
          </Button>
        </div>
      </AppLayout>
    );
  }

  const getTimelineIcon = (item: TimelineItem) => {
    switch (item.type) {
      case "bill_created":
      case "bill_owed":
        return <Receipt className="h-4 w-4" />;
      case "iou_created":
      case "iou_owed":
        return <FileText className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <AppLayout hideNav>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <AvatarCustom
            name={contact.nickname || contact.phone_number}
            size="lg"
          />
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-foreground">
              {contact.nickname || contact.phone_number}
            </h1>
            <p className="text-sm text-muted-foreground">{contact.phone_number}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={async () => { await exportContactDetailPDF(contact, timeline, totalOwedToYou, totalYouOwe, netBalance, currency); }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Balance Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Owes you</span>
            </div>
            <MoneyDisplay amount={totalOwedToYou} currency={currency} size="lg" className="text-foreground" />
          </div>

          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">You owe</span>
            </div>
            <MoneyDisplay amount={totalYouOwe} currency={currency} size="lg" className="text-foreground" />
          </div>
        </div>

        {/* Net Balance */}
        <div className="card-elevated p-4">
          <p className="text-sm text-muted-foreground mb-1">Net Balance</p>
          <MoneyDisplay amount={netBalance} currency={currency} size="xl" showSign />
          <p className="text-xs text-muted-foreground mt-1">
            {netBalance > 0
              ? `${contact.nickname || "They"} owes you`
              : netBalance < 0
              ? `You owe ${contact.nickname || "them"}`
              : "All settled up!"}
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground">Transaction History</h2>

          {timeline.length === 0 ? (
            <div className="card-elevated p-8 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">No transactions yet</p>
              <p className="text-muted-foreground text-xs mt-1">
                Create a bill or IOU with this contact to see history
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((item) => {
                const remaining = item.amount - item.amountPaid;
                const isPaid = item.status === "paid" || remaining <= 0;
                
                return (
                  <div
                    key={item.id}
                    className={`card-elevated p-4 border-l-4 ${
                      item.isCredit ? "border-l-emerald-500" : "border-l-rose-500"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          item.isCredit
                            ? "bg-emerald-100 dark:bg-emerald-900/30"
                            : "bg-rose-100 dark:bg-rose-900/30"
                        }`}
                      >
                        {item.isCredit ? (
                          <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <StatusBadge status={item.status as any} />
                        </div>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getTimelineIcon(item)}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.date), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <MoneyDisplay
                          amount={item.amount}
                          currency={item.currency}
                          size="sm"
                          className={item.isCredit ? "text-emerald-600" : "text-rose-600"}
                        />
                        {item.amountPaid > 0 && !isPaid && (
                          <p className="text-xs text-muted-foreground">
                            Paid: <MoneyDisplay amount={item.amountPaid} currency={item.currency} size="sm" />
                          </p>
                        )}
                        {!isPaid && (
                          <p className="text-xs font-medium text-foreground">
                            Due: <MoneyDisplay amount={remaining} currency={item.currency} size="sm" />
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
