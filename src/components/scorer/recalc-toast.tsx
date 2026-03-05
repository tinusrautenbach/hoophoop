"use client";

import { useEffect } from "react";
import type { RecalculationResult } from "@/services/game";

interface RecalcToastProps {
  result: RecalculationResult | null;
  onDismiss: () => void;
}

/**
 * Toast component for displaying recalculation results
 * Auto-dismisses after 5 seconds
 */
export function RecalcToast({ result, onDismiss }: RecalcToastProps) {
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => onDismiss(), 5000);
      return () => clearTimeout(timer);
    }
  }, [result, onDismiss]);

  if (!result) return null;

  const bgColor = result.corrected
    ? "bg-yellow-500/90"
    : "bg-green-500/90";
  const icon = result.corrected ? "⚠️" : "✓";
  const message = result.corrected
    ? "Score corrected"
    : "Scores verified";

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[200px]`}
      role="alert"
      aria-live="polite"
    >
      <span className="text-xl">{icon}</span>
      <div className="flex flex-col">
        <span className="font-semibold">{message}</span>
        {result.corrected && result.oldValues && result.newValues && (
          <span className="text-sm opacity-90">
            {result.oldValues.homeScore !== result.newValues.homeScore ||
            result.oldValues.guestScore !== result.newValues.guestScore
              ? `Score: ${result.oldValues.homeScore}-${result.oldValues.guestScore} → ${result.newValues.homeScore}-${result.newValues.guestScore}`
              : "Fouls updated"}
          </span>
        )}
      </div>
    </div>
  );
}
