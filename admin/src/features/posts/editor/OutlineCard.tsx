import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OutlineItem } from "@/lib/outline";
import { cn } from "@/lib/utils";

type Props = {
  items: OutlineItem[];
  /** `offset`: posición en el Markdown; `index`: número de orden del título. */
  onJump: (offset: number, index: number) => void;
};

/** Índice con los títulos del post; al pulsar uno, el editor salta a esa sección. */
export function OutlineCard({ items, onJump }: Props) {
  if (!items.length) return null;
  const base = Math.min(...items.map((item) => item.level));
  return (
    <Card>
      <details open>
        <CardHeader>
          <summary className="cursor-pointer list-none">
            <CardTitle>Índice</CardTitle>
          </summary>
        </CardHeader>
        <CardContent>
          <ul className="max-h-64 space-y-0.5 overflow-y-auto text-sm" aria-label="Títulos del post">
            {items.map((item, index) => (
              <li key={item.offset} style={{ paddingLeft: `${(item.level - base) * 0.75}rem` }}>
                <button
                  type="button"
                  onClick={() => onJump(item.offset, index)}
                  className={cn(
                    "w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left transition-colors hover:bg-surface-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    item.level === base ? "text-fg" : "text-muted",
                  )}
                  title={item.text}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </details>
    </Card>
  );
}
