import { X } from "lucide-react";
import { useTranslation } from "../i18n";

const SHORTCUT_KEYS = [
  { keys: "Space / K", actionKey: "shortcuts.playPause" },
  { keys: "← / →", actionKey: "shortcuts.seek" },
  { keys: "↑ / ↓", actionKey: "shortcuts.volume" },
  { keys: "F", actionKey: "shortcuts.fullscreen" },
  { keys: "M", actionKey: "shortcuts.mute" },
  { keys: "?", actionKey: "shortcuts.help" },
  { keys: "N / P", actionKey: "shortcuts.nextPrev" },
] as const;

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({
  open,
  onClose,
}: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("shortcuts.dialogLabel")}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-surface-200/60 bg-surface-100 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{t("shortcuts.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label={t("shortcuts.close")}
          >
            <X size={18} />
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUT_KEYS.map(({ keys, actionKey }) => (
            <li
              key={keys}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <kbd className="rounded-md bg-surface-200 px-2 py-1 font-mono text-xs text-gray-200">
                {keys}
              </kbd>
              <span className="text-gray-400 text-end">{t(actionKey)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
