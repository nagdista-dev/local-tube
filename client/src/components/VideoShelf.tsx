import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Video } from "../types";
import VideoCard from "./VideoCard";
import { useTranslation } from "../i18n";
import { SkeletonGrid } from "./SkeletonCard";

interface VideoShelfProps {
  title: string;
  videos: Video[];
  isLoading?: boolean;
  seeAllHref?: string;
  limit?: number;
}

export default function VideoShelf({
  title,
  videos,
  isLoading = false,
  seeAllHref,
  limit = 12,
}: VideoShelfProps) {
  const { t } = useTranslation();
  if (!isLoading && videos.length === 0) return null;

  const shown = videos.slice(0, limit);

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {seeAllHref && videos.length > 0 && (
          <Link
            to={seeAllHref}
            className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-brand transition-colors"
          >
            {t("shelf.seeAll")}
            <ChevronRight size={14} />
          </Link>
        )}
      </div>
      {isLoading ? (
        <SkeletonGrid count={6} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {shown.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </section>
  );
}
