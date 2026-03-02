import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Upload, Plus, Trash2, Shield, ArrowLeft, Package, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface AppVersion {
  id: string;
  version_code: number;
  version_name: string;
  release_notes: string | null;
  apk_url: string | null;
  web_bundle_url: string | null;
  update_type: string;
  is_mandatory: boolean;
  created_at: string;
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  // New version form
  const [versionCode, setVersionCode] = useState("");
  const [versionName, setVersionName] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [apkFile, setApkFile] = useState<File | null>(null);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      setIsAdmin(!!data);
      setLoading(false);
    };
    checkAdmin();
  }, [user]);

  // Fetch versions
  useEffect(() => {
    if (!isAdmin) return;
    fetchVersions();
  }, [isAdmin]);

  const fetchVersions = async () => {
    const { data, error } = await supabase
      .from("app_versions")
      .select("*")
      .order("version_code", { ascending: false });

    if (!error && data) {
      setVersions(data as unknown as AppVersion[]);
    }
  };

  const handleUploadAndCreate = async () => {
    if (!versionCode || !versionName || !apkFile) {
      toast({ title: "Missing fields", description: "Version code, version name, and APK file are required.", variant: "destructive" });
      return;
    }

    setCreating(true);
    let apkUrl: string | null = null;

    try {
      // Upload APK if provided
      if (apkFile) {
        setUploading(true);
        const filePath = `apk/owelink-v${versionName}.apk`;
        const { error: uploadError } = await supabase.storage
          .from("app-updates")
          .upload(filePath, apkFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("app-updates")
          .getPublicUrl(filePath);

        apkUrl = urlData.publicUrl;
        setUploading(false);
      }

      // Insert version record
      const { error: insertError } = await supabase
        .from("app_versions")
        .insert({
          version_code: parseInt(versionCode),
          version_name: versionName,
          release_notes: releaseNotes || null,
          apk_url: apkUrl,
          update_type: "native",
          is_mandatory: isMandatory,
        } as any);

      if (insertError) throw insertError;

      toast({ title: "✅ Version created!", description: `v${versionName} (code ${versionCode}) published.` });

      // Reset form
      setVersionCode("");
      setVersionName("");
      setReleaseNotes("");
      setIsMandatory(false);
      setApkFile(null);
      fetchVersions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("app_versions").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Version removed." });
      fetchVersions();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4 p-6">
        <Shield className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground text-center">You don't have admin privileges to access this page.</p>
        <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Admin Panel
            </h1>
            <p className="text-xs text-muted-foreground">Manage app updates & releases</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6 pb-20">
        {/* Create New Version */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-primary" /> Publish New Version
            </CardTitle>
            <CardDescription>Upload an APK and create a new release for users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="versionCode">Version Code</Label>
                <Input
                  id="versionCode"
                  type="number"
                  placeholder="e.g. 2"
                  value={versionCode}
                  onChange={(e) => setVersionCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="versionName">Version Name</Label>
                <Input
                  id="versionName"
                  placeholder="e.g. 1.1.0"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="releaseNotes">Release Notes</Label>
              <Textarea
                id="releaseNotes"
                placeholder="What's new in this version..."
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apkFile">APK File</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="apkFile"
                  type="file"
                  accept=".apk"
                  onChange={(e) => setApkFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {apkFile && (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {(apkFile.size / 1024 / 1024).toFixed(1)} MB
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="mandatory"
                checked={isMandatory}
                onCheckedChange={setIsMandatory}
              />
              <Label htmlFor="mandatory" className="text-sm">
                Mandatory update (blocks app until installed)
              </Label>
            </div>

            <Button
              onClick={handleUploadAndCreate}
              disabled={creating || !versionCode || !versionName || !apkFile}
              className="w-full gap-2"
            >
              {creating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {uploading ? "Uploading APK..." : "Publishing..."}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Publish Version
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Existing Versions */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Published Versions
          </h2>

          {versions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No versions published yet.
              </CardContent>
            </Card>
          ) : (
            versions.map((v) => (
              <Card key={v.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">v{v.version_name}</span>
                        <Badge variant="outline" className="text-xs">Code {v.version_code}</Badge>
                        <Badge variant={v.update_type === "native" ? "default" : "secondary"} className="text-xs">
                          {v.update_type}
                        </Badge>
                        {v.is_mandatory && (
                          <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(v.created_at), "MMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(v.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {v.release_notes && (
                    <p className="text-sm text-muted-foreground">{v.release_notes}</p>
                  )}
                  {v.apk_url && (
                    <a href={v.apk_url} target="_blank" rel="noopener" className="text-xs text-primary underline">
                      Download APK
                    </a>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
