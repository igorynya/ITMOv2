import { Skeleton } from "@/components/ui/skeleton";

/** Состояние S1: скелетоны вместо карточек. */
export function LoadingGrid() {
  return (
    <div
      aria-hidden="true"
      data-testid="loading-grid"
      className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-3"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-64 rounded-card" />
      ))}
    </div>
  );
}
