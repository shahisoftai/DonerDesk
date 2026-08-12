export type HierarchyNode<T extends { id: string; parentId?: string | null }> = T & {
  children: HierarchyNode<T>[];
};

export function buildHierarchy<T extends { id: string; parentId?: string | null }>(items: T[]): HierarchyNode<T>[] {
  const byId = new Map<string, HierarchyNode<T>>();
  for (const item of items) {
    byId.set(item.id, { ...item, children: [] });
  }
  const roots: HierarchyNode<T>[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function flattenHierarchy<T extends { id: string; parentId?: string | null }>(items: T[]): T[] {
  return items;
}

export function walkHierarchy<T extends { id: string; parentId?: string | null }>(
  nodes: HierarchyNode<T>[],
  visitor: (node: HierarchyNode<T>, depth: number) => void,
): void {
  const visit = (list: HierarchyNode<T>[], depth: number) => {
    for (const node of list) {
      visitor(node, depth);
      visit(node.children, depth + 1);
    }
  };
  visit(nodes, 0);
}
