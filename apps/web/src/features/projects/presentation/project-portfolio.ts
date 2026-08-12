export type ProjectFilters = {
  query: string;
  status: string;
  sector: string;
  sort: "updated" | "deadline" | "title";
  page: number;
  archived: boolean;
};

export const DEFAULT_PROJECT_FILTERS: ProjectFilters = {
  query: "",
  status: "all",
  sector: "all",
  sort: "deadline",
  page: 1,
  archived: false,
};

export type PortfolioProject = {
  id: string;
  title: string;
  projectCode: string;
  donorName: string;
  country: string;
  status: string;
  reportingFrequency: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  sector?: string;
};

export const PROJECT_PAGE_SIZE = 12;

export function filterProjects<T extends PortfolioProject>(projects: T[], filters: ProjectFilters): T[] {
  const query = filters.query.trim().toLowerCase();
  return projects.filter((p) => {
    if (filters.archived === false && p.status === "ARCHIVED") return false;
    if (filters.status !== "all" && p.status !== filters.status) return false;
    if (filters.sector !== "all" && p.sector !== filters.sector) return false;
    if (query) {
      const haystack = `${p.title} ${p.projectCode} ${p.donorName} ${p.country}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function sortProjects<T extends PortfolioProject>(projects: T[], sort: ProjectFilters["sort"]): T[] {
  const sorted = [...projects];
  if (sort === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "deadline") {
    sorted.sort((a, b) => a.daysRemaining - b.daysRemaining);
  } else {
    sorted.sort((a, b) => b.endDate.localeCompare(a.endDate));
  }
  return sorted;
}
