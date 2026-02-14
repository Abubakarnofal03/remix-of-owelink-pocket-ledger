import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { useContacts, Contact } from "@/hooks/useContacts";
import { ContactList } from "@/components/contacts/ContactList";
import { AddContactDialog } from "@/components/contacts/AddContactDialog";
import { MatchedContactsList } from "@/components/contacts/MatchedContactsList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, Search, Smartphone, Download } from "lucide-react";
import { exportContactsPDF } from "@/lib/pdfExport";

export default function Contacts() {
  const { user, loading: authLoading } = useAuth();
  const { 
    contacts, 
    loading: contactsLoading, 
    addContact, 
    deleteContact,
    searchContacts,
    refetch
  } = useContacts();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const filteredContacts = searchQuery ? searchContacts(searchQuery) : contacts;

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteContact(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-2xl font-bold text-foreground">Contacts</h1>
            <div className="flex gap-2">
              {contacts.length > 0 && (
                <Button variant="outline" size="sm" onClick={async () => { await exportContactsPDF(contacts); }}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" onClick={() => setShowAddDialog(true)} data-tour="add-contact-btn">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                My Contacts
              </TabsTrigger>
              <TabsTrigger value="owelink" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                On Owelink
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {contacts.length > 0 && (
                <div className="mb-4" data-tour="contact-search">
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search className="h-4 w-4" />}
                  />
                </div>
              )}

              {contacts.length === 0 && !contactsLoading ? (
                <EmptyState
                  icon={Users}
                  title="No contacts yet"
                  description="Add contacts to quickly split bills and track debts."
                  action={{ label: "Add Contact", onClick: () => setShowAddDialog(true) }}
                />
              ) : (
                <ContactList
                  contacts={filteredContacts}
                  loading={contactsLoading}
                  onDelete={setDeleteTarget}
                  onClick={(contact) => navigate(`/contacts/${contact.id}`)}
                />
              )}
            </TabsContent>

            <TabsContent value="owelink" className="mt-4">
              <div className="card-elevated overflow-hidden">
                <MatchedContactsList />
              </div>
            </TabsContent>
          </Tabs>

          <AddContactDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            onAdd={addContact}
          />

          <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete{" "}
                  <span className="font-medium">
                    {deleteTarget?.nickname || deleteTarget?.phone_number}
                  </span>
                  ? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
