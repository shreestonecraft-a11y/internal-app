import { useEffect, useState } from "react";
import { useHoldToRepeat } from "@/lib/hooks/useHoldToRepeat";

interface Props {
  quantity: number;
  onCommit: (newQuantity: number) => void;
  size?: "sm" | "md";
  lowThreshold?: number;
}

export default function QtyControls({ quantity, onCommit, size = "sm", lowThreshold = 5 }: Props) {
  const [preview, setPreview] = useState<number | null>(null);
  const display = preview ?? quantity;

  // Reset preview if quantity prop changes (after commit, refetch)
  useEffect(() => { setPreview(null); }, [quantity]);

  const inc = useHoldToRepeat(
    (count) => onCommit(quantity + count),
    (count) => setPreview(quantity + count),
  );
  const dec = useHoldToRepeat(
    (count) => onCommit(Math.max(0, quantity - count)),
    (count) => setPreview(Math.max(0, quantity - count)),
  );

  const btnBase = size === "md"
    ? "h-8 w-8 rounded-lg text-sm font-bold"
    : "h-6 w-6 rounded text-xs";

  const isLow = display <= lowThreshold;

  return (
    <div className="flex items-center gap-1 select-none">
      <button
        type="button"
        {...dec.handlers}
        className={`${btnBase} bg-secondary text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors active:scale-95 ${dec.isHolding ? "bg-destructive text-destructive-foreground" : ""}`}
        aria-label="Decrease quantity"
      >−</button>
      <span
        className={`font-display font-bold min-w-[2rem] text-center ${size === "md" ? "text-lg" : ""} ${isLow ? "text-destructive" : ""} ${preview !== null ? "text-accent" : ""}`}
      >{display}</span>
      <button
        type="button"
        {...inc.handlers}
        className={`${btnBase} bg-secondary text-foreground hover:bg-success hover:text-success-foreground transition-colors active:scale-95 ${inc.isHolding ? "bg-success text-success-foreground" : ""}`}
        aria-label="Increase quantity"
      >+</button>
    </div>
  );
}
