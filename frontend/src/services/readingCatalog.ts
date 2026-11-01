import { api, type Page } from "./api";

// Hierarchy choices must include later API pages, not only the first 100 items.
export async function readingCatalog<T>(path: string): Promise<Page<T>> {
  const results: T[] = [];
  let next: string | null = path;
  while (next) {
    const page: Page<T> = await api<Page<T>>(next);
    results.push(...page.results);
    if (page.next) {
      const url = new URL(page.next, window.location.origin);
      next = url.pathname.split("/api/v1/")[1] + url.search;
    } else next = null;
  }
  return { results, count: results.length, next: null, previous: null };
}
