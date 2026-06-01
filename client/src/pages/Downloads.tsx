import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { api } from "../utils/api";
import { DownloadJob } from "../types";
import { useTranslation } from "../i18n";

type TrackedJob = DownloadJob & { jobId: string };

export default function Downloads() {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const pollJob = useCallback((jobId: string) => {
    if (timersRef.current.has(jobId)) return;

    const tick = async () => {
      try {
        const status = await api.download.status(jobId);
        setJobs((prev) =>
          prev.map((j) =>
            j.jobId === jobId ? { ...status, jobId } : j,
          ),
        );
        if (status.status === "completed" || status.status === "failed") {
          const t = timersRef.current.get(jobId);
          if (t) clearInterval(t);
          timersRef.current.delete(jobId);
        }
      } catch {
        /* keep polling */
      }
    };

    tick();
    const id = setInterval(tick, 1500);
    timersRef.current.set(jobId, id);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearInterval(t));
      timers.clear();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setStarting(true);
    setError(null);
    try {
      const { jobId } = await api.download.start(trimmed);
      const placeholder: TrackedJob = {
        jobId,
        id: jobId,
        url: trimmed,
        status: "pending",
        percent: 0,
        speed: "",
        eta: "",
        title: trimmed,
      };
      setJobs((prev) => [placeholder, ...prev]);
      setUrl("");
      pollJob(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("downloads.startError"));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="animate-fade-in w-full">
      <div className="flex items-center gap-3 mb-6">
        <Download size={24} className="text-brand" />
        <h1 className="text-2xl font-bold">{t("downloads.title")}</h1>
      </div>

      <p className="text-sm text-gray-400 mb-4 max-w-3xl">
        {t("downloads.intro")}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-8">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("downloads.placeholder")}
          className="flex-1 rounded-xl border border-surface-300 bg-surface-100 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={starting || !url.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {t("downloads.download")}
        </button>
      </form>

      {error && (
        <p className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {jobs.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          {t("downloads.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li
              key={job.jobId}
              className="rounded-xl border border-surface-200/60 bg-surface-100/60 p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-white line-clamp-2">
                  {job.title || job.url}
                </p>
                <StatusIcon status={job.status} />
              </div>
              {(job.status === "downloading" || job.status === "pending") && (
                <div className="mb-2">
                  <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className="h-full bg-brand transition-all duration-300"
                      style={{ width: `${Math.min(job.percent, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {job.percent.toFixed(0)}%
                    {job.speed ? ` · ${job.speed}` : ""}
                    {job.eta ? ` · ${t("downloads.eta", { eta: job.eta })}` : ""}
                  </p>
                </div>
              )}
              {job.status === "failed" && job.error && (
                <p className="text-xs text-red-300 mb-2">{job.error}</p>
              )}
              {job.status === "completed" && job.videoId && (
                <Link
                  to={`/watch/${job.videoId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                >
                  <ExternalLink size={13} />
                  {t("downloads.openInLibrary")}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: DownloadJob["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />;
  }
  if (status === "failed") {
    return <XCircle size={18} className="text-red-400 shrink-0" />;
  }
  return <Loader2 size={18} className="text-brand animate-spin shrink-0" />;
}
