import { useStore } from "../store/useStore";
import VideoGrid from "../components/VideoGrid";
import { useTranslation } from "../i18n";

export default function Home() {
  const { t } = useTranslation();
  const search = useStore((s) => s.filters.search);
  const category = useStore((s) => s.filters.category);
  const sort = useStore((s) => s.filters.sort);

  if (search || category) {
    const folderName = (() => {
      if (!category) return "";
      const parts = category.split("/").filter(Boolean);
      return parts.length ? parts[parts.length - 1] : category;
    })();
    return (
      <div>
        <h1 className="text-xl font-semibold mb-6">
          {search ? t("home.resultsFor", { query: search }) : folderName}
        </h1>
        <VideoGrid search={search} category={category} sort={sort} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{t("home.recentlyAdded")}</h2>
        </div>
        <VideoGrid sort="date" />
      </section>
    </div>
  );
}
