/** A plain form (works without script): choosing a project reloads the tab with `?project=`. */
export function ProjectFilter({ projects, selected, action }: { projects: { id: string; title: string }[]; selected?: string; action: string }) {
  return (
    <form method="get" action={action} className="flex items-center gap-2 text-sm">
      <label htmlFor="project-filter" className="text-slate-500">Project</label>
      <select id="project-filter" name="project" defaultValue={selected ?? ""} className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900">
        <option value="">All projects</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <button className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600" type="submit">Show</button>
    </form>
  );
}
