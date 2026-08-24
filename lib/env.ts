export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;

  const first = value.at(0);
  const last = value.at(-1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}
