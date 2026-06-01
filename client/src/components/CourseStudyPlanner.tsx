import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CalendarCheck,
  Clock,
  Loader2,
  Target,
  CheckCircle2,
  Circle,
  Play,
  ChevronDown,
  ChevronUp,
  Settings2,
  BarChart3,
  ListTodo,
  X,
} from "lucide-react";
import { api } from "../utils/api";
import { Info } from "lucide-react";
import { formatDuration } from "../utils/format";
import {
  buildTodayStudyTasks,
  combineDailyMinutes,
  computeCourseStudyStats,
  defaultStudyPlan,
  splitDailyMinutes,
  toDateKey,
  WEEKDAY_OPTIONS,
  type CourseStudyPlan,
} from "../utils/courseStudyPlan";
import { Video } from "../types";
import { useTranslation } from "../i18n";

const WEEKDAY_I18N = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

interface CourseStudyPlannerProps {
  categoryPath: string;
  courseTitle: string;
}

export default function CourseStudyPlanner({
  categoryPath,
  courseTitle,
}: CourseStudyPlannerProps) {
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const todayKey = toDateKey();

  const { data: courseList, isLoading: videosLoading } = useQuery({
    queryKey: ["course-videos", categoryPath, "study-planner"],
    queryFn: () =>
      api.videos.list({
        category: categoryPath,
        page: 1,
        pageSize: 500,
        sort: "name",
      }),
    staleTime: 30_000,
  });

  const { data: savedPlan, isLoading: planLoading } = useQuery({
    queryKey: ["course-study-plan", categoryPath],
    queryFn: () => api.videos.getStudyPlan(categoryPath),
    staleTime: 10_000,
  });

  const [plan, setPlan] = useState<CourseStudyPlan>(() =>
    defaultStudyPlan(categoryPath),
  );
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);

  // Collapse states
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showToday, setShowToday] = useState(true);

  useEffect(() => {
    if (!savedPlan) return;
    setPlan(savedPlan);
    const split = splitDailyMinutes(savedPlan.dailyMinutes);
    setHours(split.hours);
    setMinutes(split.minutes);
  }, [savedPlan]);

  const saveMutation = useMutation({
    mutationFn: (next: CourseStudyPlan) =>
      api.videos.saveStudyPlan(categoryPath, next),
    onSuccess: (data) => {
      queryClient.setQueryData(["course-study-plan", categoryPath], data);
    },
  });

  const videos: Video[] = courseList?.videos ?? [];

  const stats = useMemo(
    () => computeCourseStudyStats(videos, plan),
    [videos, plan],
  );

  const todayPlan = useMemo(
    () => buildTodayStudyTasks(videos, plan),
    [videos, plan],
  );

  const toggleStudyDay = (day: number) => {
    setPlan((prev) => {
      const has = prev.studyDays.includes(day);
      const studyDays = has
        ? prev.studyDays.filter((d) => d !== day)
        : [...prev.studyDays, day].sort((a, b) => a - b);
      const next = { ...prev, studyDays };
      saveMutation.mutate(next);
      return next;
    });
  };

  const applyDailyTime = (h: number, m: number) => {
    const dailyMinutes = combineDailyMinutes(h, m);
    setPlan((prev) => {
      const next = { ...prev, dailyMinutes };
      saveMutation.mutate(next);
      return next;
    });
  };

  const toggleTask = (videoId: string, checked: boolean) => {
    setPlan((prev) => {
      const dayChecks = { ...(prev.taskChecks[todayKey] ?? {}) };
      if (checked) {
        dayChecks[videoId] = true;
      } else {
        delete dayChecks[videoId];
      }
      const next = {
        ...prev,
        taskChecks: { ...prev.taskChecks, [todayKey]: dayChecks },
      };
      saveMutation.mutate(next);
      return next;
    });
  };

  const loading = videosLoading || planLoading;
  const [showDTabNotice, setShowDTabNotice] = useState(true);

  if (loading) {
    return (
      <div className="mb-4 rounded-2xl border border-surface-200/70 bg-surface-100/50 p-8 flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 size={24} className="animate-spin text-brand" />
        <span className="text-sm font-medium">
          {t("coursePlanner.loading")}
        </span>
      </div>
    );
  }

  const todayChecked = todayPlan.tasks.filter((t) => t.checked).length;
  const finishLabel = stats.expectedFinishDate
    ? stats.expectedFinishDate.toLocaleDateString(
        locale === "ar" ? "ar" : undefined,
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        },
      )
    : t("coursePlanner.setSchedule");

  const progressPercent =
    stats.videosTotal > 0
      ? Math.round((stats.completedCount / stats.videosTotal) * 100)
      : 0;

  return (
    <div className="mb-6 rounded-2xl border border-surface-200/50 bg-surface-50/30 overflow-hidden shadow-sm">
      {/* Header Section */}
      <div className="relative p-6 bg-gradient-to-br from-emerald-500/10 via-surface-100/50 to-surface-50/30 border-b border-surface-200/50">
        <div className="absolute top-4 right-4">
          {saveMutation.isPending && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-200/80 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              <Loader2 size={12} className="animate-spin" />{" "}
              {t("coursePlanner.saving")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400">
            <Target size={14} />
          </span>
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
            {t("coursePlanner.badge")}
          </span>
        </div>

        <h3 className="text-2xl font-black text-white tracking-tight mb-1">
          {courseTitle}
        </h3>
        <p className="text-sm text-gray-400 max-w-2xl leading-relaxed mb-5">
          {t("coursePlanner.subtitle")}
        </p>

        {/* Master Progress Bar */}
        <div className="max-w-2xl">
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
              Overall Progress
            </span>
            <span className="text-sm font-bold text-white">
              {progressPercent}%
            </span>
          </div>
          <div className="h-2 w-full bg-surface-300/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-2 sm:p-4 space-y-2">
        {/* Settings Collapsible */}
        <div className="rounded-xl border border-surface-200/50 bg-surface-100/30 overflow-hidden transition-all duration-200">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between p-4 hover:bg-surface-200/30 transition-colors focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-200/80 text-gray-400">
                <Settings2 size={16} />
              </div>
              <span className="font-semibold text-white text-sm">
                {t("coursePlanner.dailyTime")} & {t("coursePlanner.studyDays")}
              </span>
            </div>
            {showSettings ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>

          {showSettings && (
            <div className="p-4 pt-0 border-t border-surface-200/30 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    {t("coursePlanner.dailyTime")}
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase">
                        {t("coursePlanner.hours")}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={12}
                        value={hours}
                        onChange={(e) =>
                          setHours(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        onBlur={() => applyDailyTime(hours, minutes)}
                        className="w-24 rounded-lg border border-surface-300 bg-surface-200/50 px-3 py-2 text-sm font-semibold text-white focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-all"
                      />
                    </label>
                    <span className="text-xl text-gray-500 font-light mt-5">
                      :
                    </span>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase">
                        {t("coursePlanner.minutes")}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={minutes}
                        onChange={(e) =>
                          setMinutes(
                            Math.min(
                              59,
                              Math.max(0, parseInt(e.target.value, 10) || 0),
                            ),
                          )
                        }
                        onBlur={() => applyDailyTime(hours, minutes)}
                        className="w-24 rounded-lg border border-surface-300 bg-surface-200/50 px-3 py-2 text-sm font-semibold text-white focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-all"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium mt-3 px-1">
                    {t("coursePlanner.perStudyDay", {
                      duration: formatDuration(plan.dailyMinutes * 60),
                    })}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    {t("coursePlanner.studyDays")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map(({ value }) => {
                      const label = t(
                        `coursePlanner.weekdays.${WEEKDAY_I18N[value]}`,
                      );
                      const active = plan.studyDays.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => toggleStudyDay(value)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                            active
                              ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                              : "border-surface-300 bg-surface-200/50 text-gray-400 hover:text-white hover:border-gray-500 hover:bg-surface-300"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Collapsible */}
        <div className="rounded-xl border border-surface-200/50 bg-surface-100/30 overflow-hidden transition-all duration-200">
          <button
            onClick={() => setShowStats(!showStats)}
            className="w-full flex items-center justify-between p-4 hover:bg-surface-200/30 transition-colors focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-200/80 text-sky-400">
                <BarChart3 size={16} />
              </div>
              <span className="font-semibold text-white text-sm">
                Course Statistics
              </span>
            </div>
            {showStats ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>

          {showStats && (
            <div className="p-4 pt-0 border-t border-surface-200/30 animate-fade-in">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                <StatCard
                  icon={<Clock size={16} className="text-brand" />}
                  label={t("coursePlanner.remaining")}
                  value={formatDuration(stats.totalRemainingSeconds)}
                  sub={t("coursePlanner.videosLeft", {
                    count: stats.videosRemaining,
                  })}
                />
                <StatCard
                  icon={<Calendar size={16} className="text-emerald-400" />}
                  label={t("coursePlanner.estFinish")}
                  value={finishLabel}
                  sub={t("coursePlanner.scheduleSummary", {
                    days: plan.studyDays.length,
                    duration: formatDuration(stats.weeklyStudyMinutes * 60),
                  })}
                />
                <StatCard
                  icon={<CalendarCheck size={16} className="text-sky-400" />}
                  label={t("coursePlanner.progress")}
                  value={`${stats.completedCount} / ${stats.videosTotal}`}
                  sub={t("coursePlanner.percentComplete", {
                    percent: progressPercent,
                  })}
                />
                <StatCard
                  icon={<Target size={16} className="text-amber-400" />}
                  label={t("coursePlanner.today")}
                  value={
                    stats.isStudyDayToday
                      ? formatDuration(todayPlan.budgetSeconds)
                      : t("coursePlanner.restDay")
                  }
                  sub={
                    stats.isStudyDayToday
                      ? t("coursePlanner.tasksDone", {
                          done: todayChecked,
                          total: todayPlan.tasks.length,
                        })
                      : t("coursePlanner.notScheduled")
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Today's Plan Collapsible */}
        <div className="rounded-xl border border-surface-200/50 bg-surface-100/30 overflow-hidden transition-all duration-200">
          <button
            onClick={() => setShowToday(!showToday)}
            className="w-full flex items-center justify-between p-4 hover:bg-surface-200/30 transition-colors focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-200/80 text-amber-400">
                <ListTodo size={16} />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-sm">
                  {t("coursePlanner.todayPlan", { date: todayKey })}
                </span>
                {stats.isStudyDayToday && todayPlan.tasks.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                    {todayChecked}/{todayPlan.tasks.length}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {stats.isStudyDayToday && todayPlan.tasks.length > 0 && (
                <span className="hidden sm:inline-block text-xs font-medium text-gray-500">
                  {t("coursePlanner.planned", {
                    planned: formatDuration(todayPlan.plannedSeconds),
                    total: formatDuration(todayPlan.budgetSeconds),
                  })}
                </span>
              )}
              {showToday ? (
                <ChevronUp size={18} className="text-gray-500" />
              ) : (
                <ChevronDown size={18} className="text-gray-500" />
              )}
            </div>
          </button>

          {showToday && (
            <div className="border-t border-surface-200/30 bg-surface-50/50 animate-fade-in">
              {!stats.isStudyDayToday ? (
                <div className="px-6 py-10 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-surface-200/50 flex items-center justify-center mb-3 text-gray-400">
                    <Calendar size={20} />
                  </div>
                  <p className="text-sm font-semibold text-gray-300 mb-1">
                    Rest Day
                  </p>
                  <p className="text-xs text-gray-500 max-w-sm">
                    {t("coursePlanner.restDayBody")}
                  </p>
                </div>
              ) : todayPlan.tasks.length === 0 ? (
                <div className="px-6 py-10 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 text-emerald-400">
                    <CheckCircle2 size={24} />
                  </div>
                  <p className="text-sm font-semibold text-emerald-400 mb-1">
                    All Caught Up!
                  </p>
                  <p className="text-xs text-emerald-500/70 max-w-sm">
                    {t("coursePlanner.allCaughtUp")}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-surface-200/40 max-h-[min(60vh,500px)] overflow-y-auto p-2">
                  {todayPlan.tasks.map((task) => (
                    <li
                      key={task.video.id}
                      className={`flex items-center gap-4 px-4 py-3 m-1 rounded-xl transition-all ${
                        task.checked
                          ? "bg-surface-200/30 opacity-70"
                          : "bg-surface-100 hover:bg-surface-200/70 shadow-sm border border-surface-200/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTask(task.video.id, !task.checked)}
                        className={`shrink-0 p-1 rounded-full transition-all hover:scale-110 active:scale-95 ${
                          task.checked
                            ? "text-emerald-400"
                            : "text-gray-400 hover:text-emerald-400"
                        }`}
                        aria-label={
                          task.checked
                            ? t("coursePlanner.markIncomplete")
                            : t("coursePlanner.markComplete")
                        }
                      >
                        {task.checked ? (
                          <CheckCircle2
                            size={24}
                            className="fill-emerald-500/20"
                          />
                        ) : (
                          <Circle size={24} />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-bold leading-snug truncate ${
                            task.checked
                              ? "text-gray-500 line-through"
                              : "text-gray-200"
                          }`}
                        >
                          {task.video.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-300/40 text-gray-400">
                            {formatDuration(task.remainingSeconds)} left
                          </span>
                          {task.video.watchProgress > 0.02 &&
                            task.video.watchProgress < 0.98 && (
                              <span className="text-[11px] font-medium text-brand">
                                {t("coursePlanner.started", {
                                  percent: Math.round(
                                    task.video.watchProgress * 100,
                                  ),
                                })}
                              </span>
                            )}
                        </div>
                      </div>
                      <Link
                        to={`/watch/${task.video.id}`}
                        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-brand/10 text-brand hover:bg-brand hover:text-white transition-all shadow-sm hover:shadow-brand/20"
                        title={t("coursePlanner.watch")}
                      >
                        <Play size={16} className="ml-0.5 fill-current" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl bg-surface-200/40 p-4 border border-surface-200/50 shadow-sm hover:bg-surface-200/60 transition-colors">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        <div className="p-1.5 rounded-lg bg-surface-300/30">{icon}</div>
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-lg font-black text-white leading-none tracking-tight mb-1.5">
        {value}
      </p>
      <p className="text-[11px] font-medium text-gray-500 leading-snug">
        {sub}
      </p>
    </div>
  );
}
