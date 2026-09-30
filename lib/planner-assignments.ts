export function plannerAssigneeIds(assignments: unknown): string[] {
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) return [];
  return Object.keys(assignments as Record<string, unknown>).filter(Boolean).sort();
}

