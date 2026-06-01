import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, RotateCcw, Timer, Settings2, Coffee, BrainCircuit, X, Save, Loader2, Plus, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { useTranslation } from "../i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../utils/api";

type Mode = "work" | "shortBreak" | "longBreak";

export default function Pomodoro() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["pomodoro-settings"],
    queryFn: api.settings.getPomodoro,
  });

  const WORK_TIME = (settings?.workTime || 25) * 60;
  const SHORT_BREAK_TIME = (settings?.shortBreakTime || 5) * 60;
  const LONG_BREAK_TIME = (settings?.longBreakTime || 15) * 60;
  const CYCLES_BEFORE_LONG_BREAK = settings?.cyclesBeforeLongBreak || 4;

  const [mode, setMode] = useState<Mode>("work");
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  const [draftSettings, setDraftSettings] = useState({
    workTime: 25,
    shortBreakTime: 5,
    longBreakTime: 15,
    cyclesBeforeLongBreak: 4,
  });

  useEffect(() => {
    if (settings && !isActive && mode === "work" && timeLeft === 25 * 60 && settings.workTime !== 25) {
      // Initialize time left if settings just loaded and timer hasn't started
      setTimeLeft(settings.workTime * 60);
    }
  }, [settings, isActive, mode, timeLeft]);

  useEffect(() => {
    if (settings) {
      setDraftSettings({
        workTime: settings.workTime,
        shortBreakTime: settings.shortBreakTime,
        longBreakTime: settings.longBreakTime,
        cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak,
      });
    }
  }, [settings, showSettings]);

  const saveMutation = useMutation({
    mutationFn: api.settings.savePomodoro,
    onSuccess: (data) => {
      queryClient.setQueryData(["pomodoro-settings"], data);
      setShowSettings(false);
      setIsActive(false);
      if (mode === "work") setTimeLeft(data.workTime * 60);
      else if (mode === "shortBreak") setTimeLeft(data.shortBreakTime * 60);
      else setTimeLeft(data.longBreakTime * 60);
    },
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof Audio !== "undefined" && !audioRef.current) {
      audioRef.current = new Audio("/notification.mp3");
    }
  }, []);

  const playNotification = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(() => {});
    }
  };

  const switchMode = useCallback((newMode: Mode) => {
    setIsActive(false);
    setMode(newMode);
    if (newMode === "work") setTimeLeft(WORK_TIME);
    if (newMode === "shortBreak") setTimeLeft(SHORT_BREAK_TIME);
    if (newMode === "longBreak") setTimeLeft(LONG_BREAK_TIME);
  }, [WORK_TIME, SHORT_BREAK_TIME, LONG_BREAK_TIME]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["pomodoro-tasks"],
    queryFn: api.settings.getPomodoroTasks,
  });

  const addTaskMutation = useMutation({
    mutationFn: api.settings.addPomodoroTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pomodoro-tasks"] }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => api.settings.updatePomodoroTask(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pomodoro-tasks"] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: api.settings.deletePomodoroTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pomodoro-tasks"] }),
  });

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");

  const handleComplete = useCallback(() => {
    playNotification();
    if (mode === "work") {
      const newCompleted = completedCycles + 1;
      setCompletedCycles(newCompleted);

      // Increment task cycle if one is active
      if (activeTaskId) {
        const activeTask = tasks.find(t => t.id === activeTaskId);
        if (activeTask) {
          updateTaskMutation.mutate({
            id: activeTask.id,
            updates: {
              name: activeTask.name,
              completedCycles: activeTask.completedCycles + 1,
              isCompleted: activeTask.isCompleted,
            }
          });
        }
      }

      if (newCompleted % CYCLES_BEFORE_LONG_BREAK === 0) {
        switchMode("longBreak");
      } else {
        switchMode("shortBreak");
      }
    } else {
      switchMode("work");
    }
  }, [mode, completedCycles, switchMode, CYCLES_BEFORE_LONG_BREAK, activeTaskId, tasks, updateTaskMutation]);

  useEffect(() => {
    let interval: number | undefined;

    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (isActive && timeLeft <= 0) {
      handleComplete();
    }

    return () => {
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [isActive, timeLeft, handleComplete]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    if (mode === "work") setTimeLeft(WORK_TIME);
    if (mode === "shortBreak") setTimeLeft(SHORT_BREAK_TIME);
    if (mode === "longBreak") setTimeLeft(LONG_BREAK_TIME);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progress =
    mode === "work"
      ? ((WORK_TIME - timeLeft) / WORK_TIME) * 100
      : mode === "shortBreak"
      ? ((SHORT_BREAK_TIME - timeLeft) / SHORT_BREAK_TIME) * 100
      : ((LONG_BREAK_TIME - timeLeft) / LONG_BREAK_TIME) * 100;

  if (loadingSettings) {
    return (
      <div className="w-full min-h-[80vh] flex flex-col items-center justify-center text-gray-500">
        <Loader2 size={32} className="animate-spin text-brand mb-4" />
        <p className="text-sm font-semibold uppercase tracking-wider">Loading Pomodoro...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in w-full pb-10 flex flex-col items-center justify-center min-h-[80vh] relative">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Timer size={28} className="text-brand shrink-0" />
          <h1 className="text-3xl font-black text-white tracking-tight">{t("sidebar.pomodoro") || "Pomodoro Timer"}</h1>
        </div>
        <p className="text-sm text-gray-400 max-w-lg leading-relaxed">
          Stay focused with timed work sessions and scheduled breaks.
        </p>
      </div>

      <div className="w-full max-w-md p-8 rounded-3xl border border-surface-200/50 bg-gradient-to-b from-surface-100/80 to-surface/80 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        
        {/* Settings Modal Overlay */}
        {showSettings && (
          <div className="absolute inset-0 z-10 bg-surface-100/95 backdrop-blur-2xl p-6 flex flex-col animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings2 size={18} className="text-brand" /> Settings
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1.5 rounded-full hover:bg-surface-200 text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 flex-1">
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-300">Work Time (min)</span>
                <input 
                  type="number" min="1" max="120"
                  value={draftSettings.workTime}
                  onChange={(e) => setDraftSettings({ ...draftSettings, workTime: parseInt(e.target.value) || 25 })}
                  className="w-20 bg-surface-200 border border-surface-300 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:border-brand focus:outline-none"
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-300">Short Break (min)</span>
                <input 
                  type="number" min="1" max="60"
                  value={draftSettings.shortBreakTime}
                  onChange={(e) => setDraftSettings({ ...draftSettings, shortBreakTime: parseInt(e.target.value) || 5 })}
                  className="w-20 bg-surface-200 border border-surface-300 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-300">Long Break (min)</span>
                <input 
                  type="number" min="1" max="60"
                  value={draftSettings.longBreakTime}
                  onChange={(e) => setDraftSettings({ ...draftSettings, longBreakTime: parseInt(e.target.value) || 15 })}
                  className="w-20 bg-surface-200 border border-surface-300 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:border-sky-500 focus:outline-none"
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-300">Cycles before Long Break</span>
                <input 
                  type="number" min="1" max="10"
                  value={draftSettings.cyclesBeforeLongBreak}
                  onChange={(e) => setDraftSettings({ ...draftSettings, cyclesBeforeLongBreak: parseInt(e.target.value) || 4 })}
                  className="w-20 bg-surface-200 border border-surface-300 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:border-brand focus:outline-none"
                />
              </label>
            </div>

            <button
              onClick={() => saveMutation.mutate(draftSettings)}
              disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-sm shadow-lg shadow-brand/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saveMutation.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex bg-surface-200/50 rounded-xl p-1.5 mb-10">
          <button
            onClick={() => switchMode("work")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === "work"
                ? "bg-brand text-white shadow-md shadow-brand/20"
                : "text-gray-400 hover:text-white hover:bg-surface-300/40"
            }`}
          >
            <BrainCircuit size={16} /> Focus
          </button>
          <button
            onClick={() => switchMode("shortBreak")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === "shortBreak"
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                : "text-gray-400 hover:text-white hover:bg-surface-300/40"
            }`}
          >
            <Coffee size={16} /> Short Break
          </button>
          <button
            onClick={() => switchMode("longBreak")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === "longBreak"
                ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                : "text-gray-400 hover:text-white hover:bg-surface-300/40"
            }`}
          >
            <Coffee size={16} /> Long Break
          </button>
        </div>

        {/* Timer Display */}
        <div className="relative flex items-center justify-center w-64 h-64 mx-auto mb-10">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="128"
              cy="128"
              r="120"
              className="fill-none stroke-surface-200/50"
              strokeWidth="10"
            />
            <circle
              cx="128"
              cy="128"
              r="120"
              className={`fill-none transition-all duration-1000 ease-linear ${
                mode === "work"
                  ? "stroke-brand"
                  : mode === "shortBreak"
                  ? "stroke-emerald-500"
                  : "stroke-sky-500"
              }`}
              strokeWidth="10"
              strokeDasharray={2 * Math.PI * 120}
              strokeDashoffset={
                2 * Math.PI * 120 * (1 - (isNaN(progress) ? 0 : progress) / 100)
              }
              strokeLinecap="round"
            />
          </svg>
          <div className="flex flex-col items-center justify-center">
            <span className="text-6xl font-black text-white tracking-tighter tabular-nums drop-shadow-md">
              {formatTime(timeLeft)}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-2">
              {mode === "work"
                ? "Time to focus"
                : mode === "shortBreak"
                ? "Take a breather"
                : "Time to recharge"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={resetTimer}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-surface-200/60 text-gray-400 hover:text-white hover:bg-surface-300 transition-all active:scale-95"
            title="Reset Timer"
          >
            <RotateCcw size={20} />
          </button>
          <button
            onClick={toggleTimer}
            className={`flex items-center justify-center w-16 h-16 rounded-full text-white shadow-xl transition-all active:scale-95 ${
              mode === "work"
                ? "bg-brand hover:bg-brand-hover shadow-brand/30"
                : mode === "shortBreak"
                ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30"
                : "bg-sky-500 hover:bg-sky-600 shadow-sky-500/30"
            }`}
          >
            {isActive ? <Pause size={28} className="fill-current" /> : <Play size={28} className="fill-current ml-1" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-surface-200/60 text-gray-400 hover:text-white hover:bg-surface-300 transition-all active:scale-95"
            title="Timer Settings"
          >
            <Settings2 size={20} />
          </button>
        </div>

        {/* Cycles */}
        <div className="flex flex-col items-center justify-center border-t border-surface-200/50 pt-6">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Completed Cycles
          </span>
          <div className="flex gap-2">
            {[...Array(CYCLES_BEFORE_LONG_BREAK)].map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all ${
                  i < (completedCycles % CYCLES_BEFORE_LONG_BREAK)
                    ? "bg-brand shadow-sm shadow-brand/40"
                    : "bg-surface-300"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-gray-500 font-medium mt-3">
            {CYCLES_BEFORE_LONG_BREAK - (completedCycles % CYCLES_BEFORE_LONG_BREAK)} sessions until long break
          </p>
        </div>
      </div>
    </div>
  );
}
