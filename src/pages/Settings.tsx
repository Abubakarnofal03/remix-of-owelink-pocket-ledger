import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { ArrowLeft, User, Phone, Bell, Moon, Shield, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(profile?.username || "");
  const [saving, setSaving] = useState(false);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const handleSaveUsername = async () => {
    if (!username.trim() || !profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim() })
        .eq("id", profile.id);

      if (error) throw error;
      toast.success("Username updated");
    } catch (error) {
      console.error("Error updating username:", error);
      toast.error("Failed to update username");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideNav>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl font-bold text-foreground">Settings</h1>
        </div>

        {/* Profile Section */}
        <div className="card-elevated p-4 space-y-4">
          <div className="flex items-center gap-4">
            <AvatarCustom name={profile?.username || "User"} size="lg" />
            <div>
              <h2 className="font-semibold text-foreground">{profile?.username}</h2>
              <p className="text-sm text-muted-foreground">{profile?.phone_number}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="flex gap-2">
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                icon={<User className="h-4 w-4" />}
              />
              <Button onClick={handleSaveUsername} disabled={saving || username === profile?.username}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={profile?.phone_number || ""}
              disabled
              icon={<Phone className="h-4 w-4" />}
            />
            <p className="text-xs text-muted-foreground">Phone number cannot be changed</p>
          </div>
        </div>

        {/* Preferences */}
        <div className="card-elevated p-4 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Preferences
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Push Notifications</p>
              <p className="text-xs text-muted-foreground">Receive notifications for bills and payments</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Toggle dark/light theme</p>
            </div>
            <Switch />
          </div>
        </div>

        {/* Security */}
        <div className="card-elevated p-4 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </h3>

          <Button variant="outline" className="w-full justify-start" disabled>
            Change Password
          </Button>
        </div>

        {/* Sign Out */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </AppLayout>
  );
}
