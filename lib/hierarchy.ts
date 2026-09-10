export function assertAcyclicParent(id: string, parentId: string | null, nodes: { id: string; parentId: string | null }[]) {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]));
  const seen = new Set([id]);
  let current = parentId;
  while (current) {
    if (seen.has(current)) throw new Error("HIERARCHY_CYCLE");
    if (!parents.has(current)) throw new Error("INVALID_PARENT");
    seen.add(current);
    current = parents.get(current) ?? null;
  }
}
