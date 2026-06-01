import { Languages } from "lucide-react";
import { useTranslation, type Locale } from "../i18n";

const LOCALES: { id: Locale; labelKey: "lang.en" | "lang.ar" }[] = [
  { id: "en", labelKey: "lang.en" },
  { id: "ar", labelKey: "lang.ar" },
];

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, locale, setLocale } = useTranslation();

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setLocale(locale === "en" ? "ar" : "en")}
        className="h-9 w-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
        title={t("lang.switch")}
        aria-label={t("lang.switch")}
      >
        <Languages size={17} />
      </button>
    );
  }

  return (
    <div
      className="flex h-9 items-center rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]"
      role="group"
      aria-label={t("lang.switch")}
    >
      {LOCALES.map(({ id, labelKey }) => (
        <button
          key={id}
          type="button"
          onClick={() => setLocale(id)}
          className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all ${
            locale === id
              ? "bg-white/10 text-white shadow-sm"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
