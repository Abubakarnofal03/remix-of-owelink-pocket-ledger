import { useMemo, useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useIOUs, IOU } from "@/hooks/useIOUs";
import { useContacts } from "@/hooks/useContacts";
import { useNavigate } from "react-router-dom";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface IOUSwipeContainerProps {
  currentIOUId: string;
  children: React.ReactNode;
}

type SlideItem =
  | { type: "iou"; iou: IOU }
  | { type: "separator"; personName: string; personPhone: string };

export function IOUSwipeContainer({ currentIOUId, children }: IOUSwipeContainerProps) {
  const { ious } = useIOUs();
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

  // Build slides: IOUs grouped by person with separators
  const { slides, currentIndex } = useMemo(() => {
    if (ious.length === 0) return { slides: [] as SlideItem[], currentIndex: 0 };

    // Group by debtor phone suffix
    const groupMap = new Map<string, IOU[]>();
    ious.forEach((iou) => {
      const suffix = iou.debtor_phone_number.replace(/[^0-9]/g, "").slice(-10);
      if (!groupMap.has(suffix)) groupMap.set(suffix, []);
      groupMap.get(suffix)!.push(iou);
    });

    const slideList: SlideItem[] = [];
    let foundIndex = 0;
    let idx = 0;

    const groups = Array.from(groupMap.entries());
    groups.forEach(([, groupIOUs], groupIdx) => {
      // Add separator before each group (except first)
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
  }, [ious, currentIOUId, contacts]);

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

    // Navigate to the IOU if it's an IOU slide
    const slide = slides[idx];
    if (slide?.type === "iou" && slide.iou.id !== currentIOUId) {
      navigate(`/ious/${slide.iou.id}`, { replace: true });
    }
  }, [emblaApi, slides, currentIOUId, navigate]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  // Get current person name
  const currentSlide = slides[selectedIndex];
  const currentPersonName = useMemo(() => {
    if (!currentSlide) return "";
    if (currentSlide.type === "separator") return currentSlide.personName;
    return getContactName(currentSlide.iou.debtor_phone_number);
  }, [currentSlide, contacts]);

  // Count IOUs only (not separators) for progress
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
