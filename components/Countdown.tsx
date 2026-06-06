"use client";

import { useEffect, useState } from "react";

const KICKOFF = new Date("2026-06-11T18:00:00-06:00").getTime();

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diffFromNow(): TimeLeft {
  const now = Date.now();
  const total = Math.max(0, KICKOFF - now);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return { days, hours, minutes, seconds };
}

export function Countdown() {
  const [time, setTime] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setTime(diffFromNow());
    const interval = setInterval(() => setTime(diffFromNow()), 1000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    { label: "días", value: time?.days, big: true },
    { label: "h", value: time?.hours },
    { label: "min", value: time?.minutes },
    { label: "seg", value: time?.seconds },
  ];

  return (
    <div className="inline-flex items-end gap-3 sm:gap-4">
      {items.map((item, idx) => (
        <div key={item.label} className="flex items-end gap-3 sm:gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`font-display text-foreground tabular-nums leading-none ${
                item.big ? "text-7xl sm:text-8xl text-accent" : "text-4xl sm:text-5xl"
              }`}
            >
              {item.value === undefined
                ? "—"
                : item.big
                  ? item.value
                  : item.value.toString().padStart(2, "0")}
            </div>
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mt-2">
              {item.label}
            </div>
          </div>
          {idx < items.length - 1 && (
            <div className="font-display text-3xl sm:text-4xl text-border-strong leading-none pb-4">
              :
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
