import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useExpenseGroups } from "@/hooks/useExpenseGroups";
import { useContacts } from "@/hooks/useContacts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Search, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewGroupExpense() {
  const { user, profile, currency, loading: authLoading } = useAuth();
  const { createGroup } = useExpenseGroups();
  const { contacts } = useContacts();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberPhones, setMemberPhones] = useState<{ phone: string; nickname: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const filteredContacts = contacts.filter(c => {
    if (memberPhones.some(m => m.phone === c.phone_number)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.nickname?.toLowerCase().includes(q) || c.phone_number.includes(q);
  });

  const addMember = (phone: string, nickname: string) => {
    if (memberPhones.some(m => m.phone === phone)) return;
    setMemberPhones(prev => [...prev, { phone, nickname }]);
    setSearchQuery("");
  };

  const removeMember = (phone: string) => {
    setMemberPhones(prev => prev.filter(m => m.phone !== phone));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    if (memberPhones.length < 1) {
      toast.error("Add at least one member");
      return;
    }

    setSubmitting(true);
    try {
      const group = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
      });

      if (!group) return;

      // Add yourself as a member
      await supabase.from("expense_group_members").insert({
        group_id: group.id,
        phone_number: profile?.phone_number || '',
        nickname: profile?.username || 'Me',
        user_id: user.id,
      });

      // Add other members
      for (const m of memberPhones) {
        await supabase.from("expense_group_members").insert({
          group_id: group.id,
          phone_number: m.phone,
          nickname: m.nickname || null,
        });
      }

      navigate(`/groups/${group.id}`);
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout hideNav>
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">New Group</h1>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Group Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trip to Goa, Roommates"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group for?"
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        {/* Members Section */}
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members ({memberPhones.length + 1})
          </h2>

          {/* You (auto-included) */}
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <AvatarCustom name={profile?.username || 'Me'} size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium">{profile?.username || 'Me'} (You)</p>
                <p className="text-xs text-muted-foreground">{profile?.phone_number}</p>
              </div>
            </CardContent>
          </Card>

          {/* Added members */}
          {memberPhones.map((m) => (
            <Card key={m.phone}>
              <CardContent className="p-3 flex items-center gap-3">
                <AvatarCustom name={m.nickname || m.phone} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.nickname || m.phone}</p>
                  <p className="text-xs text-muted-foreground">{m.phone}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeMember(m.phone)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Search/Add */}
          <div className="relative">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts to add..."
              icon={<Search className="h-4 w-4" />}
            />
            {searchQuery && filteredContacts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredContacts.slice(0, 10).map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors text-left"
                    onClick={() => addMember(contact.phone_number, contact.nickname || contact.phone_number)}
                  >
                    <AvatarCustom name={contact.nickname || contact.phone_number} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{contact.nickname || contact.phone_number}</p>
                      {contact.nickname && (
                        <p className="text-xs text-muted-foreground truncate">{contact.phone_number}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <Button onClick={handleSubmit} className="w-full" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-5 w-5 mr-2" />}
          Create Group
        </Button>
      </div>
    </AppLayout>
  );
}
