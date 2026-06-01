/** Natural title sort (Lesson 2 before Lesson 10). */
export function compareVideoTitles(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortVideosByTitle<T extends { title: string }>(videos: T[]): T[] {
  return [...videos].sort((a, b) => compareVideoTitles(a.title, b.title));
}
