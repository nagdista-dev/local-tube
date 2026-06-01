import { useCallback, useEffect } from "react";
import { useStore } from "../store/useStore";
import en from "./locales/en";
import ar from "./locales/ar";

export type Locale = "en" | "ar";

const dictionaries = { en, ar } as const;

type Path = string;

function getByPath(obj: Record<string, unknown>, path: Path): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`,
  );
}

export function translate(
  locale: Locale,
  key: Path,
  vars?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] as Record<string, unknown>;
  const value = getByPath(dict, key) ?? getByPath(dictionaries.en as Record<string, unknown>, key);
  if (!value) return key;
  return interpolate(value, vars);
}

export function applyDocumentLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === "ar" ? "rtl" : "ltr";
}

export function useTranslation() {
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const t = useCallback(
    (key: Path, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  );

  return {
    t,
    locale,
    setLocale,
    isRtl: locale === "ar",
    dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const),
  };
}

export { en, ar };
