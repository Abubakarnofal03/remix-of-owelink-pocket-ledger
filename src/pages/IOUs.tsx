import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useIOUs, IOU } from "@/hooks/useIOUs";
import { useBills } from "@/hooks/useBills";
import { useContacts } from "@/hooks/useContacts";
import { IOUList } from "@/components/ious/IOUList";
import { GroupedIOUList } from "@/components/ious/GroupedIOUList";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { FileText, Plus, ArrowDownLeft, ArrowUpRight, Search, Filter, Download } from "lucide-react";
import { exportOwesPDF } from "@/lib/pdfExport";
import { FirstVisitTip } from "@/components/ui/FirstVisitTip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPhoneSuffix } from "@/lib/notifications";

type StatusFilter = "all" | "unpaid" | "paid";

export default function IOUs() {
  const { user, loading: authLoading } = useAuth();
  const { owedToMe, iOwe, loading, refetch, bulkSettleIOUs } = useIOUs();
  const { getBillDebtsOwedToMe } = useBills();
  const { contacts, loading: contactsLoading } = useContacts();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"all" | "owed" | "owe">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Helper to get contact name by phone
  const getContactName = (phone: string) => {
    const contact = contacts.find(c => {
      const phoneSuffix = getPhoneSuffix(phone);
      const contactSuffix = c.phone_suffix || getPhoneSuffix(c.phone_number);
      return contactSuffix === phoneSuffix || c.phone_number === phone;
    });
    return contact?.nickname || null;
  };

  // Merge bill debts into owedToMe list
  const billDebtsAsIOUs = useMemo((): (IOU & { source: 'bill'; sourceBillTitle: string; sourceBillId: string })[] => {
    return getBillDebtsOwedToMe().map(debt => ({
      id: `bill-debt-${debt.billId}-${debt.participantPhone}`,
      creditor_id: user?.id || '',
      debtor_phone_number: debt.participantPhone,
      debtor_phone_suffix: null,
      debtor_user_id: null,
      amount: debt.amount_owed,
      amount_paid: debt.amount_paid,
      currency: debt.currency,
      description: debt.billTitle,
      due_date: null,
      status: debt.status,
      created_at: debt.created_at,
      updated_at: debt.created_at,
      deleted_at: null,
      direction: 'owed_to_me',
      source: 'bill' as const,
      sourceBillTitle: debt.billTitle,
      sourceBillId: debt.billId,
    }));
  }, [getBillDebtsOwedToMe, user?.id]);

  const mergedOwedToMe = useMemo(() => [...owedToMe, ...billDebtsAsIOUs], [owedToMe, billDebtsAsIOUs]);
  const allIOUs = useMemo(() => [...mergedOwedToMe, ...iOwe], [mergedOwedToMe, iOwe]);
  const currentList = activeTab === "all" ? allIOUs : activeTab === "owed" ? mergedOwedToMe : iOwe;
  const hasAnyIOUs = mergedOwedToMe.length > 0 || iOwe.length > 0;

  const filteredList = useMemo(() => {
    let result = currentList;
    
    // Filter by status
    if (statusFilter === "unpaid") {
      result = result.filter(iou => iou.status !== "paid" && iou.amount_paid < iou.amount);
    } else if (statusFilter === "paid") {
      result = result.filter(iou => iou.status === "paid" || iou.amount_paid >= iou.amount);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(iou => {
        if (iou.description?.toLowerCase().includes(q)) return true;
        if (iou.debtor_phone_number.includes(q)) return true;
        const name = getContactName(iou.debtor_phone_number);
        if (name?.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    
    // Sort: pinned first, then by created_at
    result = [...result].sort((a, b) => {
      const aPinned = a.is_pinned ? 1 : 0;
      const bPinned = b.is_pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [currentList, statusFilter, searchQuery, contacts]);

  const handleRefresh = async () => {
    await refetch();
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="animate-fade-in space-y-4">
          <FirstVisitTip
            storageKey="owes"
            message="Track simple debts — who owes you or who you owe. Lent money to a friend? Log it here so you don't forget."
          />

          <p className="text-xs text-muted-foreground italic">
            💡 To view individual transaction history, go to <span className="font-medium text-foreground">Contacts</span> and tap on a contact.
          </p>

          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold text-foreground">Owes</h1>
            <div className="flex gap-2">
              {(owedToMe.length > 0 || iOwe.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => { await exportOwesPDF(owedToMe, iOwe, getContactName); }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" onClick={() => navigate("/ious/new")} data-tour="new-owe-btn">
                <Plus className="h-4 w-4 mr-1" />
                New Owe
              </Button>
            </div>
          </div>

          {/* Search */}
          <div data-tour="owe-search">
            <Input
              placeholder="Search by name, phone, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Tabs */}
          {hasAnyIOUs && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "owed" | "owe")} data-tour="owe-tabs">
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1 gap-1">
                  All ({allIOUs.length})
                </TabsTrigger>
                <TabsTrigger value="owed" className="flex-1 gap-1">
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  Owed ({mergedOwedToMe.length})
                </TabsTrigger>
                <TabsTrigger value="owe" className="flex-1 gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  I owe ({iOwe.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          {/* List */}
          {loading ? (
            <GroupedIOUList ious={[]} loading isCreditor={activeTab === "owed"} contactsLoading={contactsLoading} onBulkSettle={bulkSettleIOUs} />
          ) : hasAnyIOUs ? (
            filteredList.length > 0 ? (
              activeTab === "all" ? (
                <div className="space-y-6">
                  {/* Owed to me section */}
                  {filteredList.filter(iou => {
                    const dir = (iou as any).direction || 'owed_to_me';
                    return (iou.creditor_id === user?.id && dir === 'owed_to_me') ||
                           (dir === 'i_owe' && iou.creditor_id !== user?.id);
                  }).length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-emerald-600 flex items-center gap-2">
                        <ArrowDownLeft className="h-4 w-4" />
                        Owed to me
                      </h3>
                      <GroupedIOUList
                        ious={filteredList.filter(iou => {
                          const dir = (iou as any).direction || 'owed_to_me';
                          return (iou.creditor_id === user?.id && dir === 'owed_to_me') ||
                                 (dir === 'i_owe' && iou.creditor_id !== user?.id);
                        })}
                        isCreditor
                        contactsLoading={contactsLoading}
                        onBulkSettle={bulkSettleIOUs}
                      />
                    </>
                  )}
                  {/* I owe section */}
                  {filteredList.filter(iou => {
                    const dir = (iou as any).direction || 'owed_to_me';
                    return (iou.creditor_id === user?.id && dir === 'i_owe') ||
                           (dir === 'owed_to_me' && iou.creditor_id !== user?.id);
                  }).length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-rose-600 flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4" />
                        I owe
                      </h3>
                      <GroupedIOUList
                        ious={filteredList.filter(iou => {
                          const dir = (iou as any).direction || 'owed_to_me';
                          return (iou.creditor_id === user?.id && dir === 'i_owe') ||
                                 (dir === 'owed_to_me' && iou.creditor_id !== user?.id);
                        })}
                        isCreditor={false}
                        contactsLoading={contactsLoading}
                      />
                    </>
                  )}
                </div>
              ) : (
                <GroupedIOUList ious={filteredList} isCreditor={activeTab === "owed"} contactsLoading={contactsLoading} onBulkSettle={bulkSettleIOUs} />
              )
            ) : (
              <EmptyState
                icon={searchQuery ? Search : activeTab === "owed" ? ArrowDownLeft : ArrowUpRight}
                title={searchQuery ? "No records found" : activeTab === "owed" ? "No one owes you" : "You don't owe anyone"}
                description={
                  searchQuery
                    ? "Try a different search term."
                    : activeTab === "owed"
                    ? "When someone owes you money, it will show here."
                    : "When you owe someone money, it will show here."
                }
              />
            )
          ) : (
            <EmptyState
              icon={FileText}
              title="No records yet"
              description="Lent money to a friend? Track it here so you don't forget."
              action={{ label: "Add New", onClick: () => navigate("/ious/new") }}
            />
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}