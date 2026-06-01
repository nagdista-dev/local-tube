import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Clock,
  PlayCircle,
  Calendar,
  Flame,
  TrendingUp,
  Target,
  CalendarCheck,
  Loader2,
} from "lucide-react";
import { api } from "../utils/api";
import { formatDuration } from "../utils/format";
import {
  computeCourseStudyStats,
  defaultStudyPlan,
} from "../utils/courseStudyPlan";
import { useTranslation } from "../i18n";
import { Video } from "../types";

interface Props {
  categoryPath: string;
  courseTitle: string;
}

function RingProgress({
  percent,
  size = 120,
  stroke = 10,
  color = "var(--color-brand, #6366f1)",
  label,
  sublabel,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (Math.min(percent, 100) / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={circ - filled}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white leading-none">
            {Math.round(percent)}%
          </span>
        </div>
      </div>
      <p className="text-xs font-bold text-gray-300 text-center">{label}</p>
      {sublabel && (
        <p className="text-[10px] text-gray-500 text-center">{sublabel}</p>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accentClass = "bg-surface-300/30",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-xl bg-surface-200/40 border border-surface-200/50 p-4 hover:bg-surface-200/60 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${accentClass}`}>{icon}</div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {label}
        </span>
      </div>
      <p className="text-xl font-black text-white leading-none tracking-tight">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] font-medium text-gray-500 mt-1.5 leading-snug">
          {sub}
        </p>
      )}
    </div>
  );
}

function HorizontalBar({
  label,
  value,
  max,
  color,
  formatValue,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  formatValue: (v: number) => string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <span className="text-xs font-bold text-white tabular-nums">
          {formatValue(value)}
        </span>
      </div>
      <div className="h-2 w-full bg-surface-300/40 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function VideoStatusBreakdown({ videos }: { videos: Video[] }) {
  const completed = videos.filter((v) => v.watchProgress >= 0.98).length;
  const inProgress = videos.filter(
    (v) => v.watchProgress > 0.02 && v.watchProgress < 0.98
  ).length;
  const unwatched = videos.filter((v) => v.watchProgress <= 0.02).length;
  const total = videos.length;

  const items = [
    {
      label: "Completed",
      count: completed,
      color: "#10b981",
      icon: <CheckCircle2 size={14} className="text-emerald-400" />,
    },
    {
      label: "In Progress",
      count: inProgress,
      color: "#6366f1",
      icon: <PlayCircle size={14} className="text-brand" />,
    },
    {
      label: "Not Started",
      count: unwatched,
      color: "rgba(255,255,255,0.12)",
      icon: <Circle size={14} className="text-gray-500" />,
    },
  ];

  return (
    <div className="rounded-xl bg-surface-200/40 border border-surface-200/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-surface-300/30">
          <BarChart3 size={15} className="text-sky-400" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Video Breakdown
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden mb-4 gap-0.5">
        {items.map(({ label, count, color }) =>
          count > 0 ? (
            <div
              key={label}
              title={`${label}: ${count}`}
              style={{
                flex: count / total,
                background: color,
                transition: "flex 0.7s ease",
              }}
            />
          ) : null
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-3">
        {items.map(({ label, count, icon }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              {icon}
              <span className="text-xs font-bold text-white">{count}</span>
            </div>
            <span className="text-[10px] text-gray-500 text-center">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CourseStatsTab({ categoryPath, courseTitle }: Props) {
  const { t, locale } = useTranslation();

  const { data: courseList, isLoading: videosLoading } = useQuery({
    queryKey: ["course-videos", categoryPath, "stats-tab"],
    queryFn: () =>
      api.videos.list({ category: categoryPath, page: 1, pageSize: 500, sort: "name" }),
    staleTime: 30_000,
  });

  const { data: savedPlan, isLoading: planLoading } = useQuery({
    queryKey: ["course-study-plan", categoryPath],
    queryFn: () => api.videos.getStudyPlan(categoryPath),
    staleTime: 10_000,
  });

  const videos: Video[] = courseList?.videos ?? [];
  const plan = savedPlan ?? defaultStudyPlan(categoryPath);

  const stats = useMemo(() => computeCourseStudyStats(videos, plan), [videos, plan]);

  const totalDuration = useMemo(
    () => videos.reduce((s, v) => s + v.duration, 0),
    [videos]
  );
  const watchedDuration = useMemo(
    () =>
      videos.reduce(
        (s, v) => s + Math.max(v.duration * Math.min(v.watchProgress, 1), 0),
        0
      ),
    [videos]
  );
  const remainingDuration = Math.max(totalDuration - watchedDuration, 0);

  const completionPct =
    stats.videosTotal > 0
      ? Math.round((stats.completedCount / stats.videosTotal) * 100)
      : 0;
  const watchedPct =
    totalDuration > 0 ? Math.round((watchedDuration / totalDuration) * 100) : 0;

  const finishLabel = stats.expectedFinishDate
    ? stats.expectedFinishDate.toLocaleDateString(
        locale === "ar" ? "ar" : undefined,
        { weekday: "short", month: "short", day: "numeric", year: "numeric" }
      )
    : t("coursePlanner.setSchedule");

  if (videosLoading || planLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
        <Loader2 size={24} className="animate-spin text-brand" />
        <span className="text-sm font-medium">Loading statistics…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Hero header */}
      <div className="rounded-2xl border border-surface-200/50 bg-gradient-to-br from-brand/10 via-surface-100/50 to-surface-50/30 overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-brand/20 text-brand">
              <TrendingUp size={14} />
            </span>
            <span className="text-[11px] font-bold text-brand uppercase tracking-widest">
              Course Statistics
            </span>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight mb-1">
            {courseTitle}
          </h3>
          <p className="text-sm text-gray-400 mb-6">
            A detailed breakdown of your progress and study schedule.
          </p>

          {/* Three ring progress indicators */}
          <div className="flex flex-wrap items-center justify-around gap-6">
            <RingProgress
              percent={completionPct}
              size={130}
              stroke={11}
              color="#10b981"
              label="Videos Completed"
              sublabel={`${stats.completedCount} of ${stats.videosTotal}`}
            />
            <RingProgress
              percent={watchedPct}
              size={130}
              stroke={11}
              color="var(--color-brand, #6366f1)"
              label="Duration Watched"
              sublabel={`${formatDuration(watchedDuration)} of ${formatDuration(totalDuration)}`}
            />
            <RingProgress
              percent={
                plan.studyDays.length > 0
                  ? Math.min(100, (plan.studyDays.length / 7) * 100)
                  : 0
              }
              size={130}
              stroke={11}
              color="#f59e0b"
              label="Study Days / Week"
              sublabel={`${plan.studyDays.length} of 7 days`}
            />
          </div>
        </div>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<PlayCircle size={16} className="text-brand" />}
          label="Total Videos"
          value={String(stats.videosTotal)}
          sub={`${formatDuration(totalDuration)} total`}
          accentClass="bg-brand/10"
        />
        <StatCard
          icon={<CheckCircle2 size={16} className="text-emerald-400" />}
          label="Completed"
          value={`${stats.completedCount} / ${stats.videosTotal}`}
          sub={`${completionPct}% done`}
          accentClass="bg-emerald-500/10"
        />
        <StatCard
          icon={<Clock size={16} className="text-sky-400" />}
          label="Time Remaining"
          value={formatDuration(remainingDuration)}
          sub={`${stats.videosRemaining} videos left`}
          accentClass="bg-sky-500/10"
        />
        <StatCard
          icon={<Flame size={16} className="text-amber-400" />}
          label="Time Watched"
          value={formatDuration(watchedDuration)}
          sub={`of ${formatDuration(totalDuration)}`}
          accentClass="bg-amber-500/10"
        />
      </div>

      {/* Video breakdown + duration bars side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VideoStatusBreakdown videos={videos} />

        {/* Duration bars */}
        <div className="rounded-xl bg-surface-200/40 border border-surface-200/50 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-surface-300/30">
              <Clock size={15} className="text-brand" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Duration Breakdown
            </span>
          </div>
          <HorizontalBar
            label="Watched"
            value={watchedDuration}
            max={totalDuration}
            color="#6366f1"
            formatValue={formatDuration}
          />
          <HorizontalBar
            label="Remaining"
            value={remainingDuration}
            max={totalDuration}
            color="#10b981"
            formatValue={formatDuration}
          />
          <HorizontalBar
            label="Total"
            value={totalDuration}
            max={totalDuration}
            color="rgba(255,255,255,0.15)"
            formatValue={formatDuration}
          />
        </div>
      </div>

      {/* Study schedule card */}
      <div className="rounded-xl bg-surface-200/40 border border-surface-200/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-surface-300/30">
            <CalendarCheck size={15} className="text-emerald-400" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Study Schedule
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Daily Target
            </p>
            <p className="text-lg font-black text-white">
              {formatDuration(plan.dailyMinutes * 60)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Weekly
            </p>
            <p className="text-lg font-black text-white">
              {formatDuration(stats.weeklyStudyMinutes * 60)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Study Days
            </p>
            <p className="text-lg font-black text-white">
              {plan.studyDays.length}
              <span className="text-sm font-medium text-gray-400"> / week</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Est. Finish
            </p>
            <p className="text-sm font-black text-white leading-tight">
              {finishLabel}
            </p>
          </div>
        </div>

        {/* Day chips */}
        {plan.studyDays.length > 0 && (
          <div className="mt-4 pt-4 border-t border-surface-200/30">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Scheduled Days
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day, i) => {
                  const active = plan.studyDays.includes(i);
                  return (
                    <span
                      key={day}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        active
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : "bg-surface-300/20 border-surface-300/30 text-gray-600"
                      }`}
                    >
                      {day}
                    </span>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>

      {/* Per-video progress list */}
      {videos.length > 0 && (
        <div className="rounded-xl bg-surface-200/40 border border-surface-200/50 overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-surface-200/30">
            <div className="p-1.5 rounded-lg bg-surface-300/30">
              <Target size={15} className="text-amber-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Per-Video Progress
            </span>
            <span className="ml-auto text-[10px] text-gray-500">
              {stats.completedCount} done · {stats.videosRemaining} left
            </span>
          </div>
          <ul className="divide-y divide-surface-200/20 max-h-[360px] overflow-y-auto">
            {videos.map((video) => {
              const pct = Math.min(Math.round(video.watchProgress * 100), 100);
              const done = video.watchProgress >= 0.98;
              const started =
                video.watchProgress > 0.02 && video.watchProgress < 0.98;
              return (
                <li key={video.id} className="px-4 py-3 hover:bg-surface-200/30 transition-colors">
                  <div className="flex items-center gap-3 mb-1.5">
                    {done ? (
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    ) : started ? (
                      <PlayCircle size={14} className="text-brand shrink-0" />
                    ) : (
                      <Circle size={14} className="text-gray-600 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-medium truncate flex-1 ${done ? "text-gray-500 line-through" : "text-gray-200"}`}
                    >
                      {video.title}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 tabular-nums shrink-0">
                      {pct}%
                    </span>
                  </div>
                  <div className="ml-[22px] h-1 w-full bg-surface-300/30 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: done
                          ? "#10b981"
                          : started
                          ? "var(--color-brand, #6366f1)"
                          : "transparent",
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
