import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useIOUs } from "@/hooks/useIOUs";
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
  const { owedToMe, iOwe, loading, refetch } = useIOUs();
  const { contacts, loading: contactsLoading } = useContacts();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"owed" | "owe">("owed");
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

  const currentList = activeTab === "owed" ? owedToMe : iOwe;
  const hasAnyIOUs = owedToMe.length > 0 || iOwe.length > 0;

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
        // Search in description
        if (iou.description?.toLowerCase().includes(q)) return true;
        // Search in debtor phone
        if (iou.debtor_phone_number.includes(q)) return true;
        // Search in debtor name
        const name = getContactName(iou.debtor_phone_number);
        if (name?.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    
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
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "owed" | "owe")} data-tour="owe-tabs">
              <TabsList className="w-full">
                <TabsTrigger value="owed" className="flex-1 gap-2">
                  <ArrowDownLeft className="h-4 w-4" />
                  Owed to me ({owedToMe.length})
                </TabsTrigger>
                <TabsTrigger value="owe" className="flex-1 gap-2">
                  <ArrowUpRight className="h-4 w-4" />
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
            <GroupedIOUList ious={[]} loading isCreditor={activeTab === "owed"} contactsLoading={contactsLoading} />
          ) : hasAnyIOUs ? (
            filteredList.length > 0 ? (
              <GroupedIOUList ious={filteredList} isCreditor={activeTab === "owed"} contactsLoading={contactsLoading} />
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
              description="Track simple debts - who owes you or who you owe."
              action={{ label: "Add New", onClick: () => navigate("/ious/new") }}
            />
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}