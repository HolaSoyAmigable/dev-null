import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import type { CountItem, TimeseriesPoint } from "@/api/types";

const SERIES = [
  { key: "views", label: "Visitas", color: "var(--series-1)" },
  { key: "unique_visitors", label: "Visitantes únicos", color: "var(--series-2)" },
] as const;

const dayFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDayFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeZone: "UTC" });
const numberFormatter = new Intl.NumberFormat("es-MX");

export const formatNumber = (value: number) => numberFormatter.format(value);
const formatDay = (value: string) => dayFormatter.format(new Date(`${value}T00:00:00Z`));

function SeriesTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-fg">{fullDayFormatter.format(new Date(`${String(label)}T00:00:00Z`))}</p>
      {SERIES.map((series) => {
        const entry = payload.find((p) => p.dataKey === series.key);
        return (
          <p key={series.key} className="flex items-center gap-2 text-muted">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: series.color }} aria-hidden />
            {series.label}: <span className="font-mono text-fg">{formatNumber(Number(entry?.value ?? 0))}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Visitas y únicos por día: misma escala, un solo eje, leyenda + tooltip + tabla. */
export function TrafficChart({ data }: { data: TimeseriesPoint[] }) {
  const last = data[data.length - 1];
  return (
    <figure>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted" aria-hidden>
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: series.color }} />
            {series.label}
            {last ? (
              <span className="font-mono text-fg">
                {formatNumber(last[series.key])} · {formatDay(last.date)}
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <div className="h-64" role="img" aria-label="Gráfico de visitas y visitantes únicos por día">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={SeriesTooltip} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
            {SERIES.map((series) => (
              <Line
                key={series.key}
                type="linear"
                dataKey={series.key}
                stroke={series.color}
                strokeWidth={2}
                dot={data.length <= 31 ? { r: 2.5, fill: series.color, strokeWidth: 0 } : false}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-fg">Ver como tabla</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-medium">Día</th>
                <th className="py-1 text-right font-medium">Visitas</th>
                <th className="py-1 text-right font-medium">Únicos</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {data.map((point) => (
                <tr key={point.date} className="border-t border-border">
                  <td className="py-1">{point.date}</td>
                  <td className="py-1 text-right">{formatNumber(point.views)}</td>
                  <td className="py-1 text-right">{formatNumber(point.unique_visitors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Lista con barras horizontales de una sola serie (ranking). Valores siempre en texto. */
export function BarList({
  items,
  empty = "Sin datos en este periodo.",
  formatKey = (key: string) => key,
}: {
  items: CountItem[];
  empty?: string;
  formatKey?: (key: string) => string;
}) {
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.views), 1);
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="group text-sm" title={`${formatKey(item.key)}: ${formatNumber(item.views)} visitas`}>
          <div className="mb-1 flex justify-between gap-2">
            <span className="truncate text-fg">{formatKey(item.key)}</span>
            <span className="font-mono text-muted">{formatNumber(item.views)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2">
            <div
              className="h-1.5 rounded-full bg-series-1 transition-opacity group-hover:opacity-80"
              style={{ width: `${(item.views / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-fg">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
