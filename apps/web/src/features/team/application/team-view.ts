export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export type TeamFilter = {
  query?: string;
  role?: string;
};

/**
 * Filters team members by a free-text query (name/email) and an optional role.
 * Case-insensitive; pure and testable.
 */
export function filterTeamMembers(members: TeamMember[], filter: TeamFilter): TeamMember[] {
  const q = filter.query?.trim().toLowerCase();
  return members.filter((m) => {
    if (q) {
      const haystack = `${m.name} ${m.email}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filter.role && m.role !== filter.role) return false;
    return true;
  });
}
