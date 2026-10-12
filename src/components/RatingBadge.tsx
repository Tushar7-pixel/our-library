import { BookRating } from "@/types/library";

const RATING_CONFIG: Record<BookRating, { label: string; style: string }> = {
  best: {
    label: "★ Best",
    style: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  good: {
    label: "Good",
    style: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  avg: {
    label: "Avg",
    style: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  },
  okeyish: {
    label: "Okeyish",
    style: "bg-stone-500/20 text-stone-300 border-stone-500/40",
  },
  do_not_read: {
    label: "⛔ DO NOT READ",
    style: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  },
};

export function RatingBadge({ rating }: { rating?: BookRating }) {
  if (!rating) return null;
  const config = RATING_CONFIG[rating];
  return (
    <span
      className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border ${config.style}`}
    >
      {config.label}
    </span>
  );
}
