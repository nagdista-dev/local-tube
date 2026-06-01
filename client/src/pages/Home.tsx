import { useStore } from '../store/useStore';
import VideoGrid from '../components/VideoGrid';

export default function Home() {
  const search   = useStore(s => s.filters.search);
  const category = useStore(s => s.filters.category);
  const sort     = useStore(s => s.filters.sort);

  // If search or category active, show filtered grid
  if (search || category) {
    // Show only the last path segment as the folder title (e.g. "Udemy/Animation" → "Animation")
    const folderName = category ? category.split('/').filter(Boolean).at(-1) ?? category : '';
    return (
      <div>
        <h1 className="text-xl font-semibold mb-6">
          {search ? `Results for "${search}"` : folderName}
        </h1>
        <VideoGrid search={search} category={category} sort={sort} />
      </div>
    );
  }


  return (
    <div className="animate-fade-in">
      {/* Recently Added */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recently Added</h2>
        </div>
        <VideoGrid sort="date" />
      </section>
    </div>
  );
}