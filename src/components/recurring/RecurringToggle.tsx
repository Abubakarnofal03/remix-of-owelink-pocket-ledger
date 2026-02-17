import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

interface RecurringToggleProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  frequency: string;
  onFrequencyChange: (frequency: string) => void;
}

export function RecurringToggle({
  enabled,
  onEnabledChange,
  frequency,
  onFrequencyChange,
}: RecurringToggleProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-violet-500/10 flex items-center justify-center">
            <RefreshCw className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <p className="font-medium text-sm">Make recurring</p>
            <p className="text-xs text-muted-foreground">Auto-create on a schedule</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <div className="pl-4 border-l-2 border-violet-500/30 ml-4 space-y-2">
          <Label className="text-sm text-muted-foreground">Repeat every:</Label>
          <Select value={frequency} onValueChange={onFrequencyChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Every week</SelectItem>
              <SelectItem value="monthly">Every month</SelectItem>
              <SelectItem value="yearly">Every year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
