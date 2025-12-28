import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { BillList } from "@/components/bills/BillList";
import { useBills } from "@/hooks/useBills";
import { useContacts } from "@/hooks/useContacts";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Receipt, Plus, Crown, Users, Search, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPhoneSuffix } from "@/lib/notifications";

type BillFilter = "all" | "created" | "shared";
type StatusFilter = "all" | "unpaid" | "paid";

export default function Bills() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { bills, loading: billsLoading, refetch } = useBills();
  const { contacts } = useContacts();
  const [filter, setFilter] = useState<BillFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loading = billsLoading;

  // Helper to get contact name by phone
  const getContactName = (phone: string) => {
    const contact = contacts.find(c => {
      const phoneSuffix = getPhoneSuffix(phone);
      const contactSuffix = c.phone_suffix || getPhoneSuffix(c.phone_number);
      return contactSuffix === phoneSuffix || c.phone_number === phone;
    });
    return contact?.nickname || null;
  };

  const filteredBills = useMemo(() => {
    if (!user) return [];
    
    let result = bills;
    
    // Filter by created/shared
    if (filter === "created") {
      result = result.filter(b => b.creator_id === user.id);
    } else if (filter === "shared") {
      result = result.filter(b => b.creator_id !== user.id);
    }
    
    // Filter by status
    if (statusFilter === "unpaid") {
      result = result.filter(b => b.status !== "paid");
    } else if (statusFilter === "paid") {
      result = result.filter(b => b.status === "paid");
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b => {
        // Search in title
        if (b.title?.toLowerCase().includes(q)) return true;
        // Search in description
        if (b.description?.toLowerCase().includes(q)) return true;
        // Search in participants' phone numbers or names
        if (b.participants?.some(p => {
          if (p.phone_number.includes(q)) return true;
          const name = getContactName(p.phone_number);
          if (name?.toLowerCase().includes(q)) return true;
          return false;
        })) return true;
        return false;
      });
    }
    
    return result;
  }, [bills, filter, statusFilter, searchQuery, user, contacts]);

  const createdCount = useMemo(() => {
    if (!user) return 0;
    return bills.filter(b => b.creator_id === user.id).length;
  }, [bills, user]);
  
  const sharedCount = useMemo(() => {
    if (!user) return 0;
    return bills.filter(b => b.creator_id !== user.id).length;
  }, [bills, user]);

  const handleRefresh = async () => {
    await refetch();
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-2xl font-bold text-foreground">Bills</h1>
            <Link to="/bills/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Bill
              </Button>
            </Link>
          </div>

          {/* Search */}
          <div className="mb-4">
            <Input
              placeholder="Search by name, phone, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-4">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as BillFilter)} className="flex-1">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="all" className="text-xs">
                  All ({bills.length})
                </TabsTrigger>
                <TabsTrigger value="created" className="text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  Created ({createdCount})
                </TabsTrigger>
                <TabsTrigger value="shared" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Shared ({sharedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Status Filter */}
          <div className="mb-4">
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
          </div>

          {filteredBills.length === 0 && !loading ? (
            <EmptyState
              icon={Receipt}
              title={searchQuery ? "No bills found" : filter === "all" ? "No bills yet" : filter === "created" ? "No bills created" : "No shared bills"}
              description={searchQuery 
                ? "Try a different search term."
                : filter === "all" 
                ? "Split expenses with friends and keep track of who owes what."
                : filter === "created"
                ? "Create a bill to split expenses with others."
                : "You'll see bills here when someone adds you as a participant."
              }
              action={!searchQuery && filter !== "shared" ? { 
                label: "Create Bill", 
                onClick: () => navigate("/bills/new")
              } : undefined}
            />
          ) : (
            <BillList bills={filteredBills} loading={loading} />
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}