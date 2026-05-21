import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, User, Phone, Bell, Moon, Shield, LogOut, Coins, Database, ChevronDown, Vibrate, Fingerprint, GraduationCap, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CURRENCIES, getCurrencySymbol } from "@/lib/currencies";
import { hapticSuccess } from "@/lib/haptics";
import { OfflineDiagnostics } from "@/components/settings/OfflineDiagnostics";
import { TxnDetectionSettings } from "@/components/settings/TxnDetectionSettings";
import { useBiometric } from "@/hooks/useBiometric";
import { useRecurring } from "@/hooks/useRecurring";
import { Button as ActionButton } from "@/components/ui/button";

export default function Settings() {
  const { user, profile, loading: authLoading, signOut, currency, updateSettings } = useAuth();
  const { theme, setTheme, resolvedTheme, hapticIntensity, setHapticIntensity } = useTheme();
  const navigate = useNavigate();
  const [username, setUsername] = useState(profile?.username || "");
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);
  const { isAvailable, isEnabled, enableBiometric, disableBiometric } = useBiometric();
  const [biometricLoading, setBiometricLoading] = useState(false);
  const { schedules, loading: recurringLoading, toggleRecurring, deleteRecurring } = useRecurring();

  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
    }
  }, [profile?.username]);

  useEffect(() => {
    setSelectedCurrency(currency);
  }, [currency]);

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
      hapticSuccess();
      toast.success("Username updated");
    } catch (error) {
      console.error("Error updating username:", error);
      toast.error("Failed to update username");
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    setSelectedCurrency(newCurrency);
    const { error } = await updateSettings({ currency: newCurrency });
    if (error) {
      toast.error("Failed to update currency");
      setSelectedCurrency(currency);
    } else {
      hapticSuccess();
      toast.success("Currency updated");
    }
  };

  const handleDarkModeChange = (value: string) => {
    setTheme(value as "light" | "dark" | "amoled" | "system");
    if (hapticIntensity !== "off") hapticSuccess();
  };

  const handleHapticChange = (value: string) => {
    setHapticIntensity(value as "off" | "low" | "medium" | "high");
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

        {/* Currency */}
        <div className="card-elevated p-4 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Currency
          </h3>

          <div className="space-y-2">
            <Label>Default Currency</Label>
            <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{getCurrencySymbol(selectedCurrency)}</span>
                    <span>{selectedCurrency}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    <span className="font-medium">{curr.symbol}</span>
                    <span className="ml-2">{curr.code}</span>
                    <span className="ml-2 text-muted-foreground">- {curr.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This currency will be used as default for new bills and owes
            </p>
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

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">Choose your preferred theme</p>
              </div>
            </div>
            <Select value={theme} onValueChange={handleDarkModeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="amoled">Super AMOLED Dark</SelectItem>
                <SelectItem value="system">System Default</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Vibrate className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Haptic Feedback</p>
                <p className="text-xs text-muted-foreground">Control vibration intensity</p>
              </div>
            </div>
            <Select value={hapticIntensity} onValueChange={handleHapticChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Smart Expense Detection (Android only — component self-hides elsewhere) */}
        <TxnDetectionSettings />

        {/* Security */}
        <div className="card-elevated p-4 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </h3>

          {isAvailable && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Fingerprint className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Biometric Login</p>
                  <p className="text-xs text-muted-foreground">
                    Sign in with fingerprint or face
                  </p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                disabled={biometricLoading}
                onCheckedChange={async (checked) => {
                  setBiometricLoading(true);
                  try {
                    if (checked) {
                      // Need credentials to enable -- prompt user
                      toast.info("Please sign out and sign back in to enable biometric login, or it will be offered on your next login.");
                    } else {
                      await disableBiometric();
                      hapticSuccess();
                      toast.success("Biometric login disabled");
                    }
                  } finally {
                    setBiometricLoading(false);
                  }
                }}
              />
            </div>
          )}

          <Button variant="outline" className="w-full justify-start" disabled>
            Change Password
          </Button>
        </div>

        {/* Offline Storage Diagnostics */}
        <Collapsible>
          <div className="card-elevated p-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Offline Storage
              </h3>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <OfflineDiagnostics />
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Recurring Schedules */}
        <Collapsible>
          <div className="card-elevated p-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Recurring Schedules
              </h3>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-3">
              {schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recurring schedules yet. Create one from a bill or owe form.
                </p>
              ) : (
                schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {schedule.template_data.title || schedule.template_data.description || "Recurring " + schedule.entity_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {schedule.frequency} · {schedule.entity_type} · Next: {new Date(schedule.next_run_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={(active) => toggleRecurring({ id: schedule.id, is_active: active })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteRecurring(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Replay Tutorial */}
        <div className="card-elevated p-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => {
              localStorage.removeItem("onboarding_completed");
              localStorage.setItem("onboarding_triggered", "true");
              navigate("/");
            }}
          >
            <GraduationCap className="h-4 w-4" />
            Replay App Tutorial
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
