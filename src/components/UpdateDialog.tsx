import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw, AlertTriangle } from "lucide-react";

interface UpdateDialogProps {
  open: boolean;
  versionName: string;
  releaseNotes: string | null;
  isMandatory: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  onUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateDialog({
  open,
  versionName,
  releaseNotes,
  isMandatory,
  downloading,
  progress,
  error,
  onUpdate,
  onDismiss,
}: UpdateDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-[90vw] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            Update Available — v{versionName}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            {releaseNotes && (
              <p className="text-sm text-muted-foreground">{releaseNotes}</p>
            )}
            {isMandatory && (
              <p className="text-sm font-medium text-destructive flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                This update is required to continue using the app.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {downloading && (
          <div className="space-y-2 py-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progress < 100 ? `Downloading... ${progress}%` : 'Installing...'}
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            {error}
          </p>
        )}

        <AlertDialogFooter className="flex-row gap-2">
          {!isMandatory && !downloading && (
            <Button variant="outline" onClick={onDismiss} className="flex-1">
              Later
            </Button>
          )}
          <Button
            onClick={onUpdate}
            disabled={downloading}
            className="flex-1 gap-2"
          >
            {downloading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {progress < 100 ? 'Downloading...' : 'Installing...'}
              </>
            ) : error ? (
              'Retry'
            ) : (
              <>
                <Download className="h-4 w-4" />
                Update Now
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
