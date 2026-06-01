import { Video } from "../types";
import { sortVideosByTitle } from "./sort";

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

export interface CourseStudyPlan {
  category: string;
  dailyMinutes: number;
  studyDays: number[];
  taskChecks: Record<string, Record<string, boolean>>;
  updatedAt?: string;
}

export interface TodayStudyTask {
  video: Video;
  remainingSeconds: number;
  checked: boolean;
}

export interface CourseStudyStats {
  totalRemainingSeconds: number;
  videosRemaining: number;
  videosTotal: number;
  completedCount: number;
  expectedFinishDate: Date | null;
  weeklyStudyMinutes: number;
  isStudyDayToday: boolean;
}

export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getVideoRemainingSeconds(video: Video): number {
  if (video.watchProgress >= 0.98) return 0;
  const watched = Math.max(0, Math.min(video.watchProgress, 1)) * video.duration;
  return Math.max(0, video.duration - watched);
}

export function splitDailyMinutes(totalMinutes: number): {
  hours: number;
  minutes: number;
} {
  const safe = Math.max(0, Math.round(totalMinutes));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function combineDailyMinutes(hours: number, minutes: number): number {
  return Math.max(0, Math.round(hours) * 60 + Math.round(minutes));
}

export function estimateFinishDate(
  from: Date,
  remainingSeconds: number,
  dailyMinutes: number,
  studyDays: number[],
): Date | null {
  if (remainingSeconds <= 0) return from;
  if (dailyMinutes <= 0 || studyDays.length === 0) return null;

  const studySet = new Set(studyDays);
  let left = remainingSeconds;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  for (let guard = 0; guard < 3650 && left > 0; guard++) {
    if (studySet.has(cursor.getDay())) {
      left -= dailyMinutes * 60;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return cursor;
}

export function computeCourseStudyStats(
  videos: Video[],
  plan: Pick<CourseStudyPlan, "dailyMinutes" | "studyDays">,
  today: Date = new Date(),
): CourseStudyStats {
  const totalRemainingSeconds = videos.reduce(
    (sum, v) => sum + getVideoRemainingSeconds(v),
    0,
  );
  const videosRemaining = videos.filter((v) => v.watchProgress < 0.98).length;
  const completedCount = videos.length - videosRemaining;

  return {
    totalRemainingSeconds,
    videosRemaining,
    videosTotal: videos.length,
    completedCount,
    expectedFinishDate: estimateFinishDate(
      today,
      totalRemainingSeconds,
      plan.dailyMinutes,
      plan.studyDays,
    ),
    weeklyStudyMinutes: plan.dailyMinutes * plan.studyDays.length,
    isStudyDayToday: plan.studyDays.includes(today.getDay()),
  };
}

export function buildTodayStudyTasks(
  videos: Video[],
  plan: Pick<CourseStudyPlan, "dailyMinutes" | "studyDays" | "taskChecks">,
  today: Date = new Date(),
): {
  isStudyDay: boolean;
  tasks: TodayStudyTask[];
  budgetSeconds: number;
  plannedSeconds: number;
} {
  const isStudyDay = plan.studyDays.includes(today.getDay());
  const budgetSeconds = plan.dailyMinutes * 60;
  const dateKey = toDateKey(today);
  const checkedMap = plan.taskChecks[dateKey] ?? {};

  if (!isStudyDay || budgetSeconds <= 0) {
    return { isStudyDay, tasks: [], budgetSeconds, plannedSeconds: 0 };
  }

  const sorted = sortVideosByTitle(videos);
  const tasks: TodayStudyTask[] = [];
  let plannedSeconds = 0;

  for (const video of sorted) {
    const remainingSeconds = getVideoRemainingSeconds(video);
    if (remainingSeconds <= 0) continue;

    if (tasks.length > 0 && plannedSeconds + remainingSeconds > budgetSeconds) {
      break;
    }

    tasks.push({
      video,
      remainingSeconds,
      checked: Boolean(checkedMap[video.id]),
    });
    plannedSeconds += remainingSeconds;
  }

  return { isStudyDay, tasks, budgetSeconds, plannedSeconds };
}

export function defaultStudyPlan(category: string): CourseStudyPlan {
  return {
    category,
    dailyMinutes: 60,
    studyDays: [1, 2, 3, 4, 5],
    taskChecks: {},
  };
}
