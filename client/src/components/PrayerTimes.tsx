import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Moon, Sun, Clock, Sunrise, Sunset, MoonStar } from "lucide-react";
import { useTranslation } from "../i18n";

interface Timings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  [key: string]: string;
}

// Convert 24h time to 12h time string if needed, but the API returns 24h which is fine.
function formatTime12h(time24: string, locale: string) {
  const [h, m] = time24.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m);
  return date.toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
}

export default function PrayerTimes() {
  const { t, locale } = useTranslation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const dateString = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;

  const { data, isLoading, error } = useQuery({
    queryKey: ["prayer-times", dateString],
    queryFn: async () => {
      const res = await fetch(`https://api.aladhan.com/v1/timingsByCity/${dateString}?city=Cairo&country=Egypt&method=5`);
      if (!res.ok) throw new Error("Failed to fetch prayer times");
      const json = await res.json();
      return json.data.timings as Timings;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const prayers = useMemo(() => {
    if (!data) return [];
    return [
      { id: "Fajr", time: data.Fajr, icon: MoonStar },
      { id: "Sunrise", time: data.Sunrise, icon: Sunrise },
      { id: "Dhuhr", time: data.Dhuhr, icon: Sun },
      { id: "Asr", time: data.Asr, icon: Sun },
      { id: "Maghrib", time: data.Maghrib, icon: Sunset },
      { id: "Isha", time: data.Isha, icon: Moon },
    ];
  }, [data]);

  const nextPrayer = useMemo(() => {
    if (!prayers.length) return null;
    
    const currentMins = now.getHours() * 60 + now.getMinutes();
    
    for (const prayer of prayers) {
      const [h, m] = prayer.time.split(":").map(Number);
      const prayerMins = h * 60 + m;
      if (prayerMins > currentMins) {
        return { ...prayer, diffMins: prayerMins - currentMins, isTomorrow: false };
      }
    }
    
    // If all prayers passed, next is Fajr tomorrow
    const [h, m] = prayers[0].time.split(":").map(Number);
    return { ...prayers[0], diffMins: (h * 60 + m + 24 * 60) - currentMins, isTomorrow: true };
  }, [prayers, now]);

  if (isLoading || error || !data || !nextPrayer) return null;

  const hoursLeft = Math.floor(nextPrayer.diffMins / 60);
  const minsLeft = nextPrayer.diffMins % 60;
  const timeRemainingStr = hoursLeft > 0 
    ? `${hoursLeft}${t("prayers.h")} ${minsLeft}${t("prayers.m")}`
    : `${minsLeft}${t("prayers.m")}`;

  const NextIcon = nextPrayer.icon;

  return (
    <div className="px-3 pb-2">
      <div 
        className="flex items-center justify-between rounded-lg bg-surface-200/40 border border-surface-300/30 px-3 py-2 shadow-sm"
        title={prayers.map(p => `${t(`prayers.${p.id}` as any)}: ${formatTime12h(p.time, locale)}`).join(" | ")}
      >
        <div className="flex items-center gap-2">
          <NextIcon size={14} className="text-brand" />
          <span className="text-xs font-bold text-white">{t(`prayers.${nextPrayer.id}` as any)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-300 tracking-wide">{formatTime12h(nextPrayer.time, locale)}</span>
          <div className="text-[10px] text-brand bg-brand/15 px-1.5 py-[2px] rounded-md font-bold tracking-wider flex items-center gap-1">
            <Clock size={10} />
            -{timeRemainingStr}
          </div>
        </div>
      </div>
    </div>
  );
}
