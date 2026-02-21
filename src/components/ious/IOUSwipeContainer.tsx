import { useMemo, useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useIOUs, IOU } from "@/hooks/useIOUs";
import { useBills } from "@/hooks/useBills";
import { useAuth } from "@/hooks/useAuth";
import { useContacts } from "@/hooks/useContacts";
import { useNavigate } from "react-router-dom";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

interface IOUSwipeContainerProps {
  currentIOUId: string;
  children: React.ReactNode;
}

type ExtendedIOU = IOU & { source?: 'bill'; sourceBillTitle?: string; sourceBillId?: string };

type SlideItem =
  | { type: "iou"; iou: ExtendedIOU }
  | { type: "separator"; personName: string; personPhone: string };

export function IOUSwipeContainer({ currentIOUId, children }: IOUSwipeContainerProps) {
  const { ious } = useIOUs();
  const { getBillDebtsOwedToMe } = useBills();
  const { user } = useAuth();
  const { contacts } = useContacts();
  const navigate = useNavigate();

  const getContactName = (phone: string): string => {
    const contact = contacts.find(
      (c) =>
        c.phone_number === phone ||
        c.phone_suffix === phone.replace(/[^0-9]/g, "").slice(-10)
    );
    return contact?.nickname || phone;
  };

  // Merge real IOUs with bill-sourced debts
  const allIOUs: ExtendedIOU[] = useMemo(() => {
    const billDebts: ExtendedIOU[] = getBillDebtsOwedToMe().map(debt => ({
      id: `bill-debt-${debt.billId}-${debt.participantPhone}`,
      creditor_id: user?.id || '',
      debtor_phone_number: debt.participantPhone,
      debtor_phone_suffix: null,
      debtor_user_id: null,
      amount: debt.amount_owed,
      amount_paid: debt.amount_paid,
      currency: debt.currency,
      description: debt.billTitle,
      due_date: null,
      status: debt.status,
      created_at: debt.created_at,
      updated_at: debt.created_at,
      deleted_at: null,
      direction: 'owed_to_me',
      source: 'bill' as const,
      sourceBillTitle: debt.billTitle,
      sourceBillId: debt.billId,
    }));
    return [...ious, ...billDebts];
  }, [ious, getBillDebtsOwedToMe, user?.id]);

  // Build slides: IOUs grouped by person with separators
  const { slides, currentIndex } = useMemo(() => {
    if (allIOUs.length === 0) return { slides: [] as SlideItem[], currentIndex: 0 };

    const groupMap = new Map<string, ExtendedIOU[]>();
    allIOUs.forEach((iou) => {
      const suffix = iou.debtor_phone_number.replace(/[^0-9]/g, "").slice(-10);
      if (!groupMap.has(suffix)) groupMap.set(suffix, []);
      groupMap.get(suffix)!.push(iou);
    });

    const slideList: SlideItem[] = [];
    let foundIndex = 0;
    let idx = 0;

    const groups = Array.from(groupMap.entries());
    groups.forEach(([, groupIOUs], groupIdx) => {
      if (groupIdx > 0) {
        const personName = getContactName(groupIOUs[0].debtor_phone_number);
        slideList.push({
          type: "separator",
          personName,
          personPhone: groupIOUs[0].debtor_phone_number,
        });
        idx++;
      }

      groupIOUs.forEach((iou) => {
        if (iou.id === currentIOUId) foundIndex = idx;
        slideList.push({ type: "iou", iou });
        idx++;
      });
    });

    return { slides: slideList, currentIndex: foundIndex };
  }, [allIOUs, currentIOUId, contacts]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex: currentIndex,
    watchDrag: true,
  });

  const [selectedIndex, setSelectedIndex] = useState(currentIndex);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    setSelectedIndex(idx);
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());

    const slide = slides[idx];
    if (slide?.type === "iou" && slide.iou.id !== currentIOUId) {
      // Only navigate for real IOUs, not bill-debt ones
      if (!slide.iou.source) {
        navigate(`/ious/${slide.iou.id}`, { replace: true });
      }
    }
  }, [emblaApi, slides, currentIOUId, navigate]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const currentSlide = slides[selectedIndex];
  const currentPersonName = useMemo(() => {
    if (!currentSlide) return "";
    if (currentSlide.type === "separator") return currentSlide.personName;
    return getContactName(currentSlide.iou.debtor_phone_number);
  }, [currentSlide, contacts]);

  const totalIOUs = slides.filter((s) => s.type === "iou").length;
  const currentIOUPosition = useMemo(() => {
    let count = 0;
    for (let i = 0; i <= selectedIndex; i++) {
      if (slides[i]?.type === "iou") count++;
    }
    return count;
  }, [selectedIndex, slides]);

  if (slides.length <= 1) {
    return <>{children}</>;
  }

  return (
    <div>
      {/* Top swipe indicator */}
      <div className="flex items-center justify-between px-1 mb-3">
        <button
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!canScrollPrev}
          className="p-1 rounded-full text-muted-foreground disabled:opacity-30 hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 text-center min-w-0 px-2">
          <p className="text-xs font-medium text-foreground truncate">{currentPersonName}</p>
          <div className="flex items-center justify-center gap-0.5 mt-1 max-w-full overflow-hidden">
            {slides.length <= 15 ? (
              slides.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all shrink-0",
                    i === selectedIndex
                      ? "w-3 bg-primary"
                      : slides[i].type === "separator"
                      ? "w-1 bg-amber-400/60"
                      : "w-1 bg-muted-foreground/30"
                  )}
                />
              ))
            ) : (
              <div className="flex items-center gap-1">
                <div className="h-1 w-8 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${((selectedIndex + 1) / slides.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {currentIOUPosition} / {totalIOUs}
          </p>
        </div>

        <button
          onClick={() => emblaApi?.scrollNext()}
          disabled={!canScrollNext}
          className="p-1 rounded-full text-muted-foreground disabled:opacity-30 hover:bg-accent transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Carousel */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0">
              {slide.type === "separator" ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center space-y-3">
                    <AvatarCustom name={slide.personName} size="lg" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {slide.personName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Swipe to see their records →
                      </p>
                    </div>
                  </div>
                </div>
              ) : slide.iou.source === 'bill' ? (
                // Bill-debt inline card
                <BillDebtSlide iou={slide.iou} getContactName={getContactName} navigate={navigate} />
              ) : slide.iou.id === currentIOUId ? (
                children
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Inline card for bill-sourced debts shown in the swipe carousel */
function BillDebtSlide({
  iou,
  getContactName,
  navigate,
}: {
  iou: ExtendedIOU;
  getContactName: (phone: string) => string;
  navigate: (path: string) => void;
}) {
  const remaining = iou.amount - iou.amount_paid;
  const progress = iou.amount > 0 ? (iou.amount_paid / iou.amount) * 100 : 0;
  const debtorName = getContactName(iou.debtor_phone_number);

  return (
    <div className="animate-fade-in space-y-4 px-1">
      {/* Bill badge header */}
      <div className="flex items-center gap-2 justify-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          <Receipt className="h-3.5 w-3.5" />
          From Bill
        </span>
      </div>

      {/* Person info */}
      <div className="card-elevated p-4 border-l-4 border-l-indigo-500">
        <div className="flex items-center gap-4">
          <AvatarCustom name={debtorName} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg text-foreground truncate">{debtorName}</h2>
            <p className="text-sm text-muted-foreground truncate">{iou.debtor_phone_number}</p>
          </div>
          <StatusBadge status={iou.status as any} />
        </div>
      </div>

      {/* Amount summary */}
      <div className="card-elevated p-4 border-l-4 border-l-indigo-500">
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
          Bill: {iou.sourceBillTitle}
        </p>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground">Total Owed</p>
            <MoneyDisplay amount={iou.amount} currency={iou.currency} size="xl" />
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <MoneyDisplay amount={remaining} currency={iou.currency} size="lg" className="text-primary" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <p className="text-[11px] text-muted-foreground">{Math.round(progress)}% paid</p>
          <p className="text-[11px] text-muted-foreground">
            {iou.currency} {iou.amount_paid.toFixed(2)} / {iou.amount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* View Bill button */}
      {iou.sourceBillId && (
        <button
          onClick={() => navigate(`/bills/${iou.sourceBillId}`)}
          className="w-full py-3 rounded-xl border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors flex items-center justify-center gap-2"
        >
          <Receipt className="h-4 w-4" />
          View Full Bill
        </button>
      )}
    </div>
  );
}
