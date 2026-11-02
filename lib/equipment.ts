export type EquipmentSpec = { label: string; value: string };

export type Equipment = {
  id: string;
  name: string;
  category: string;
  operators: string;
  aliases: string[];
  summary: string;
  image: { url: string; page: string; attribution: string } | null;
  specs: EquipmentSpec[];
  sources: { name: string; url: string }[];
};

export type TextPart = { text: string; equipmentId?: string };

export function splitEquipment(text: string, catalog: Equipment[]): TextPart[] {
  const aliases = catalog
    .flatMap((item) => item.aliases.map((alias) => ({ alias, id: item.id })))
    .sort((left, right) => right.alias.length - left.alias.length);
  const parts: TextPart[] = [];
  let index = 0;
  while (index < text.length) {
    let hit: { alias: string; id: string } | null = null;
    for (const alias of aliases) {
      const slice = text.slice(index, index + alias.alias.length);
      if (slice.toLowerCase() !== alias.alias.toLowerCase()) continue;
      const before = index === 0 || /[^A-Za-z0-9]/.test(text[index - 1] || "");
      const afterIndex = index + alias.alias.length;
      const after = afterIndex >= text.length || /[^A-Za-z0-9]/.test(text[afterIndex] || "");
      if (before && after) {
        hit = alias;
        break;
      }
    }
    if (hit) {
      parts.push({ text: text.slice(index, index + hit.alias.length), equipmentId: hit.id });
      index += hit.alias.length;
      continue;
    }
    const last = parts[parts.length - 1];
    if (last && !last.equipmentId) last.text += text[index];
    else parts.push({ text: text[index] });
    index += 1;
  }
  return parts;
}

export function equipmentCounts(texts: string[], catalog: Equipment[]) {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const seen = new Set<string>();
    for (const part of splitEquipment(text, catalog)) {
      if (!part.equipmentId || seen.has(part.equipmentId)) continue;
      seen.add(part.equipmentId);
      counts.set(part.equipmentId, (counts.get(part.equipmentId) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ item: catalog.find((entry) => entry.id === id)!, count }))
    .filter((row) => row.item)
    .sort((left, right) => right.count - left.count);
}
