import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone, Loader2 } from "lucide-react";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (contact: { phone_number: string; nickname?: string }) => Promise<any>;
  initialPhone?: string;
}

export function AddContactDialog({ open, onOpenChange, onAdd, initialPhone = "" }: AddContactDialogProps) {
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ nickname?: string; phone?: string }>({});

  const validatePhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length >= 10;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: typeof errors = {};
    
    if (!phoneNumber.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!validatePhone(phoneNumber)) {
      newErrors.phone = "Enter a valid phone number";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    const result = await onAdd({
      phone_number: phoneNumber.replace(/\D/g, ""),
      nickname: nickname.trim() || undefined,
    });
    setLoading(false);

    if (result) {
      setNickname("");
      setPhoneNumber("");
      setErrors({});
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Name (optional)</Label>
            <Input
              id="nickname"
              placeholder="John Doe"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              icon={<User className="h-4 w-4" />}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
              }}
              icon={<Phone className="h-4 w-4" />}
              error={!!errors.phone}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Contact"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
