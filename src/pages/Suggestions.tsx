import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArrowLeft, Receipt, Check, X, PencilLine, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useExpenses } from '@/hooks/useExpenses';
import {
  listPendingSuggestions,
  setSuggestionStatus,
  muteMerchant,
} from '@/lib/txnDetection/suggestionStore';
import type { LocalExpenseSuggestion } from '@/lib/offline/db';
import { toast } from 'sonner';
import { hapticSuccess } from '@/lib/haptics';

export default function Suggestions() {
  const { user, loading: authLoading } = useAuth();
  const { createExpense } = useExpenses();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const focusId = params.get('focus');

  const [items, setItems] = useState<LocalExpenseSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await listPendingSuggestions();
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-scroll to focused item
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`sug-${focusId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, items]);

  const handleAdd = async (s: LocalExpenseSuggestion) => {
    await createExpense({
      amount: s.amount,
      description: s.merchant
        ? `${s.merchant}${s.source ? ` · ${s.source}` : ''}`
        : s.source || s.category || 'Detected expense',
      currency: s.currency,
      bucket_id: s.bucketId || undefined,
    });
    await setSuggestionStatus(s.id, 'added');
    hapticSuccess();
    toast.success('Added to expenses');
    refresh();
  };

  const handleIgnore = async (s: LocalExpenseSuggestion) => {
    await setSuggestionStatus(s.id, 'ignored');
    if (s.merchant) muteMerchant(s.merchant);
    toast.success('Ignored');
    refresh();
  };

  const handleReview = (s: LocalExpenseSuggestion) => {
    // No dedicated form route; we prefill via the Expenses page using sessionStorage
    sessionStorage.setItem('pending_suggestion', JSON.stringify(s));
    navigate('/expenses?suggestion=1');
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout hideNav>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Expense Suggestions
          </h1>
        </div>

        {loading ? null : items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No pending suggestions"
            description="Detected transactions from your bank or wallet notifications will appear here."
          />
        ) : (
          items.map((s) => (
            <Card key={s.id} id={`sug-${s.id}`} className={focusId === s.id ? 'ring-2 ring-primary' : ''}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">
                      {s.currency} {s.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-foreground truncate">
                      {s.merchant || s.category || 'Unknown merchant'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.source || 'Notification'} ·{' '}
                      {new Date(s.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full ${
                      s.confidence >= 0.7
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {Math.round(s.confidence * 100)}%
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => handleAdd(s)}>
                    <Check className="h-4 w-4 mr-1" /> Add
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleReview(s)}>
                    <PencilLine className="h-4 w-4 mr-1" /> Review
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleIgnore(s)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppLayout>
  );
}
