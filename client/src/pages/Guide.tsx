import { Link } from "react-router-dom";
import {
  BookOpen,
  Download,
  FolderTree,
  HardDrive,
  Heart,
  History,
  Keyboard,
  Play,
  Search,
  Server,
  Terminal,
  Tv2,
  ChevronRight,
  CheckCircle2,
  Film,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "../i18n";

const VIDEO_FORMATS = ["MP4", "MKV", "AVI", "MOV", "WebM", "M4V", "FLV"];

const TOC = [
  { id: "requirements", labelKey: "guide.requirements" },
  { id: "library", labelKey: "guide.library" },
  { id: "setup", labelKey: "guide.setup" },
  { id: "downloads", labelKey: "guide.downloading" },
  { id: "features", labelKey: "guide.features" },
  { id: "player", labelKey: "guide.player" },
] as const;

const SHORTCUT_KEYS = [
  { keys: "Space / K", actionKey: "shortcuts.playPause" },
  { keys: "← / →", actionKey: "shortcuts.seek" },
  { keys: "↑ / ↓", actionKey: "shortcuts.volume" },
  { keys: "F", actionKey: "shortcuts.fullscreen" },
  { keys: "M", actionKey: "shortcuts.mute" },
  { keys: "?", actionKey: "guide.shortcutsHelp" },
  { keys: "N / P", actionKey: "guide.shortcutsNextPrev" },
] as const;

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-surface-200/80 px-1.5 py-0.5 text-xs font-mono text-gray-200">
      {children}
    </code>
  );
}

function GuideSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-2xl border border-surface-200/70 bg-surface-100/40 overflow-hidden"
    >
      <div className="border-b border-surface-200/60 bg-surface-100/60 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {description && (
              <p className="text-sm text-gray-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function FeatureCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-xl border border-surface-200/50 bg-surface/50 p-4 transition-colors hover:border-brand/40 hover:bg-surface-100/80"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand group-hover:bg-brand/20">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-white text-sm flex items-center gap-1 mb-1">
          {title}
          <ChevronRight
            size={14}
            className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </h3>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

export default function Guide() {
  const { t } = useTranslation();

  return (
    <div className="animate-fade-in w-full pb-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={24} className="text-brand shrink-0" />
          <h1 className="text-2xl font-bold text-white">{t("guide.title")}</h1>
        </div>
        <p className="text-sm text-gray-400 max-w-3xl leading-relaxed">
          {t("guide.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        {/* Table of contents */}
        <nav
          className="xl:w-52 xl:shrink-0 xl:sticky xl:top-3 rounded-xl border border-surface-200/60 bg-surface-100/30 p-4"
          aria-label={t("guide.onThisPage")}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 px-1">
            {t("guide.onThisPage")}
          </p>
          <ul className="flex flex-wrap gap-2 xl:flex-col xl:gap-0.5">
            {TOC.map(({ id, labelKey }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-surface-200/60 hover:text-white transition-colors"
                >
                  {t(labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <GuideSection
            id="requirements"
            icon={Server}
            title={t("guide.requirementsTitle")}
            description={t("guide.requirementsDesc")}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-surface-200/50 bg-surface/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal size={16} className="text-emerald-400" />
                  <h3 className="font-semibold text-white text-sm">{t("guide.required")}</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  <li className="flex gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <span className="text-gray-200 font-medium">Node.js 22+</span>
                      {" — "}{t("guide.nodeDesc")}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <span className="text-gray-200 font-medium">FFmpeg</span>
                      {" — "}{t("guide.ffmpegDesc")}
                    </span>
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-surface-200/50 bg-surface/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Download size={16} className="text-brand" />
                  <h3 className="font-semibold text-white text-sm">{t("guide.optional")}</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  <li className="flex gap-2">
                    <CheckCircle2 size={15} className="text-brand shrink-0 mt-0.5" />
                    <span>
                      <span className="text-gray-200 font-medium">yt-dlp</span>
                      {" — "}{t("guide.ytdlpDesc")}
                    </span>
                  </li>
                </ul>
                <p className="mt-3 text-xs text-gray-500 border-t border-surface-200/50 pt-3">
                  {t("guide.noYtdlp")}
                </p>
              </div>
            </div>
          </GuideSection>

          <GuideSection
            id="library"
            icon={HardDrive}
            title={t("guide.libraryTitle")}
            description={t("guide.libraryDesc")}
          >
            <p className="text-sm text-gray-400 mb-4">{t("guide.libraryIntro")}</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {VIDEO_FORMATS.map((ext) => (
                <span
                  key={ext}
                  className="rounded-md bg-surface-200/60 px-2.5 py-1 text-xs font-medium text-gray-300"
                >
                  .{ext.toLowerCase()}
                </span>
              ))}
            </div>
            <div className="rounded-xl bg-surface/80 border border-surface-200/50 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                {t("guide.exampleLayout")}
              </p>
              <pre className="text-sm text-gray-400 font-mono leading-relaxed overflow-x-auto">
{`VIDEOS_DIR/
├── Courses/
│   └── React Basics/
│       ├── 01 - Intro.mp4
│       └── 02 - Components.mp4
├── Movies/
│   └── My Film.mkv
└── Downloads/`}
              </pre>
              <p className="mt-3 text-xs text-gray-500">{t("guide.libraryFooter")}</p>
            </div>
          </GuideSection>

          <GuideSection
            id="setup"
            icon={Film}
            title={t("guide.setupTitle")}
            description={t("guide.setupDesc")}
          >
            <ol className="grid gap-4 md:grid-cols-3">
              {[
                { n: 1, title: t("guide.step1Title"), body: t("guide.step1Body") },
                { n: 2, title: t("guide.step2Title"), body: t("guide.step2Body") },
                { n: 3, title: t("guide.step3Title"), body: t("guide.step3Body") },
              ].map(({ n, title, body }) => (
                <li
                  key={n}
                  className="list-none rounded-xl border border-surface-200/50 bg-surface/40 p-4 flex flex-col"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white text-xs font-bold mb-3">
                    {n}
                  </span>
                  <h3 className="font-semibold text-white text-sm mb-2">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed flex-1 whitespace-pre-line">
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </GuideSection>

          <GuideSection
            id="downloads"
            icon={Download}
            title={t("guide.downloadTitle")}
            description={t("guide.downloadDesc")}
          >
            <ol className="grid gap-3 sm:grid-cols-3">
              <li className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-gray-400">
                <span className="block text-brand font-bold mb-2">{t("guide.step", { n: 1 })}</span>
                {t("guide.downloadStep1")}
              </li>
              <li className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-gray-400">
                <span className="block text-brand font-bold mb-2">{t("guide.step", { n: 2 })}</span>
                {t("guide.downloadStep2")}{" "}
                <Link to="/downloads" className="text-brand hover:underline font-medium">
                  →
                </Link>
              </li>
              <li className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-gray-400">
                <span className="block text-brand font-bold mb-2">{t("guide.step", { n: 3 })}</span>
                {t("guide.downloadStep3")}
              </li>
            </ol>
          </GuideSection>

          <GuideSection
            id="features"
            icon={Tv2}
            title={t("guide.featuresTitle")}
            description={t("guide.featuresDesc")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FeatureCard to="/" icon={Search} title={t("guide.featureHomeTitle")} description={t("guide.featureHomeDesc")} />
              <FeatureCard to="/" icon={FolderTree} title={t("guide.featureFoldersTitle")} description={t("guide.featureFoldersDesc")} />
              <FeatureCard to="/continue-watching" icon={Play} title={t("guide.featureContinueTitle")} description={t("guide.featureContinueDesc")} />
              <FeatureCard to="/history" icon={History} title={t("guide.featureHistoryTitle")} description={t("guide.featureHistoryDesc")} />
              <FeatureCard to="/favorites" icon={Heart} title={t("guide.featureFavoritesTitle")} description={t("guide.featureFavoritesDesc")} />
              <FeatureCard to="/downloads" icon={Download} title={t("guide.featureDownloadsTitle")} description={t("guide.featureDownloadsDesc")} />
            </div>
          </GuideSection>

          <GuideSection
            id="player"
            icon={Keyboard}
            title={t("guide.playerTitle")}
            description={t("guide.playerDesc")}
          >
            <p className="text-sm text-gray-400 mb-4">{t("guide.playerIntro")}</p>
            <div className="rounded-xl border border-surface-200/50 overflow-hidden mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-200/40 text-start text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-semibold w-36 sm:w-44">{t("guide.key")}</th>
                    <th className="px-4 py-2.5 font-semibold">{t("guide.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200/50">
                  {SHORTCUT_KEYS.map(({ keys, actionKey }) => (
                    <tr
                      key={keys}
                      className="bg-surface/30 hover:bg-surface-100/40 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <kbd className="rounded-md bg-surface-200 px-2 py-0.5 font-mono text-xs text-gray-200">
                          {keys}
                        </kbd>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">{t(actionKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <BookOpen size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm text-gray-400 leading-relaxed">
                <p className="font-semibold text-white mb-1">{t("guide.coursesTitle")}</p>
                {t("guide.coursesBody")}
              </div>
            </div>
          </GuideSection>
        </div>
      </div>
    </div>
  );
}
