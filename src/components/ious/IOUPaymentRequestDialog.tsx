import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { compressImage, blobToFile } from '@/lib/imageCompression';

interface IOUPaymentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iouId: string;
  remainingAmount: number;
  currency: string;
  onSubmit: (data: {
    amount_claimed: number;
    receipt_url?: string;
    message?: string;
  }) => Promise<boolean>;
}

export function IOUPaymentRequestDialog({
  open,
  onOpenChange,
  iouId,
  remainingAmount,
  currency,
  onSubmit,
}: IOUPaymentRequestDialogProps) {
  const [amountClaimed, setAmountClaimed] = useState(remainingAmount.toString());
  const [message, setMessage] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    try {
      toast.info('Compressing image...');
      const compressedBlob = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.7,
        mimeType: 'image/jpeg',
      });

      const compressedFile = blobToFile(compressedBlob, `receipt_${Date.now()}.jpg`);
      setReceiptFile(compressedFile);

      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Failed to process image');
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile) return null;

    setUploading(true);
    try {
      const fileName = `ious/${iouId}/${Date.now()}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast.error('Failed to upload receipt');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const amount = parseFloat(amountClaimed);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > remainingAmount) {
      toast.error(`Amount cannot exceed remaining balance of ${currency} ${remainingAmount.toFixed(2)}`);
      return;
    }

    setSubmitting(true);
    try {
      let receiptUrl: string | undefined;
      if (receiptFile) {
        const url = await uploadReceipt();
        if (url) receiptUrl = url;
      }

      const success = await onSubmit({
        amount_claimed: amount,
        receipt_url: receiptUrl,
        message: message.trim() || undefined,
      });

      if (success) {
        setAmountClaimed(remainingAmount.toString());
        setMessage('');
        removeReceipt();
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Payment Confirmation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Remaining Balance</p>
            <MoneyDisplay amount={remainingAmount} currency={currency} size="lg" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount Paid</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={remainingAmount}
              value={amountClaimed}
              onChange={(e) => setAmountClaimed(e.target.value)}
              placeholder="Enter amount you paid"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note about your payment..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Receipt (Optional)</Label>
            
            {receiptPreview ? (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="w-full h-48 object-cover rounded-lg border border-border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={removeReceipt}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-accent/50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Tap to upload receipt
                </span>
              </button>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Image will be compressed to save storage
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading}
          >
            {(submitting || uploading) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {uploading ? 'Uploading...' : submitting ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
