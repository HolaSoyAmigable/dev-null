import { Radio } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { useMetrics, usePostMetrics, useRealtime, type DateRange } from "@/api/hooks";
import type { Overview } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNotice, PageHeader, Spinner } from "@/components/ui/feedback";
import { Select } from "@/components/ui/input";
import { isoDay } from "@/lib/utils";

import { BarList, formatNumber, StatTile, TrafficChart } from "./charts";

const RANGES = [
  { days: 7, label: "Últimos 7 días" },
  { days: 30, label: "Últimos 30 días" },
  { days: 90, label: "Últimos 90 días" },
  { days: 365, label: "Último año" },
];

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Escritorio",
  mobile: "Móvil",
  tablet: "Tablet",
};

function rangeFor(days: number): DateRange {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { start: isoDay(start), end: isoDay(end) };
}

function OverviewTiles({ overview }: { overview: Overview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Visitas" value={formatNumber(overview.views)} />
      <StatTile label="Visitantes únicos" value={formatNumber(overview.unique_visitors)} hint="Suma de únicos diarios" />
      <StatTile
        label="Lectura media"
        value={`${Math.round(overview.avg_seconds)} s`}
        hint={`Scroll medio ${Math.round(overview.avg_scroll_pct)} %`}
      />
      <StatTile label="Tasa de lectura" value={`${overview.read_rate.toFixed(0)} %`} hint="≥ 75 % de scroll y ≥ 30 s" />
    </div>
  );
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const days = Number(params.get("days") ?? "30");
  const postId = params.get("post") ? Number(params.get("post")) : undefined;
  const range = rangeFor(days);

  return (
    <>
      <PageHeader
        title="Métricas"
        description="Sin cookies ni IPs. Bots, DNT y el navegador del administrador quedan fuera. Los días se cuentan en UTC."
        actions={
          <>
            <label htmlFor="range" className="sr-only">
              Periodo
            </label>
            <Select
              id="range"
              value={days}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                next.set("days", event.target.value);
                setParams(next);
              }}
              className="w-44"
            >
              {RANGES.map((r) => (
                <option key={r.days} value={r.days}>
                  {r.label}
                </option>
              ))}
            </Select>
          </>
        }
      />
      {postId ? <PostMetricsView postId={postId} range={range} /> : <SiteMetrics range={range} />}
    </>
  );
}

function SiteMetrics({ range }: { range: DateRange }) {
  const m = useMetrics(range);
  const realtime = useRealtime();
  const error = m.overview.error ?? m.timeseries.error ?? m.topPosts.error;

  return (
    <div className="space-y-6">
      <ErrorNotice error={error} />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4">
          <span className="flex items-center gap-2 text-sm">
            <Radio className="size-4 text-accent" aria-hidden />
            <span className="font-medium">Tiempo real</span>
            <span className="text-xs text-muted">(últimos 30 min)</span>
          </span>
          {realtime.data ? (
            <>
              <span className="text-sm">
                <span className="font-mono text-lg font-semibold">{realtime.data.active_visitors}</span>{" "}
                <span className="text-muted">visitantes</span>
              </span>
              <span className="text-sm">
                <span className="font-mono text-lg font-semibold">{realtime.data.views}</span>{" "}
                <span className="text-muted">visitas</span>
              </span>
              <span className="truncate font-mono text-xs text-muted">
                {realtime.data.pages.slice(0, 3).map((p) => `${p.path} (${p.views})`).join(" · ")}
              </span>
            </>
          ) : (
            <Spinner />
          )}
        </CardContent>
      </Card>

      {m.overview.data ? <OverviewTiles overview={m.overview.data} /> : <Spinner />}

      <Card>
        <CardHeader>
          <CardTitle>Tráfico diario</CardTitle>
        </CardHeader>
        <CardContent>{m.timeseries.data ? <TrafficChart data={m.timeseries.data} /> : <Spinner />}</CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Posts más leídos</CardTitle>
          </CardHeader>
          <CardContent>
            {m.topPosts.data ? (
              m.topPosts.data.length ? (
                <ol className="space-y-2 text-sm">
                  {m.topPosts.data.map((post, index) => (
                    <li key={post.post_id} className="flex items-center justify-between gap-2">
                      <Link to={`/?post=${post.post_id}`} className="truncate hover:text-accent">
                        <span className="mr-2 font-mono text-muted">{index + 1}.</span>
                        {post.title}
                      </Link>
                      <span className="shrink-0 font-mono text-muted">
                        {formatNumber(post.views)} · {formatNumber(post.unique_visitors)} únicos
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">Sin lecturas en este periodo.</p>
              )
            ) : (
              <Spinner />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fuentes de tráfico</CardTitle>
          </CardHeader>
          <CardContent>
            {m.referrers.data ? <BarList items={m.referrers.data} empty="Todo el tráfico es directo." /> : <Spinner />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dispositivos</CardTitle>
          </CardHeader>
          <CardContent>
            {m.devices.data ? (
              <BarList items={m.devices.data} formatKey={(k) => DEVICE_LABELS[k] ?? k} />
            ) : (
              <Spinner />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Navegadores</CardTitle>
          </CardHeader>
          <CardContent>{m.browsers.data ? <BarList items={m.browsers.data} /> : <Spinner />}</CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Países</CardTitle>
          </CardHeader>
          <CardContent>
            {m.countries.data ? (
              <BarList items={m.countries.data} empty="La geolocalización (GeoLite2) aún no está activa." />
            ) : (
              <Spinner />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PostMetricsView({ postId, range }: { postId: number; range: DateRange }) {
  const metrics = usePostMetrics(postId, range);
  if (metrics.isPending) return <Spinner />;
  if (metrics.error) return <ErrorNotice error={metrics.error} />;
  const data = metrics.data;
  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link to="/" className="text-muted hover:text-fg">
          Métricas del sitio
        </Link>{" "}
        / <span className="font-medium">{data.title}</span>{" "}
        <Link to={`/posts/${data.post_id}`} className="text-accent hover:underline">
          (editar)
        </Link>
      </p>
      <OverviewTiles overview={data.overview} />
      <Card>
        <CardHeader>
          <CardTitle>Tráfico diario del post</CardTitle>
        </CardHeader>
        <CardContent>
          <TrafficChart data={data.timeseries} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Fuentes de tráfico</CardTitle>
        </CardHeader>
        <CardContent>
          <BarList items={data.referrers} empty="Todo el tráfico es directo." />
        </CardContent>
      </Card>
    </div>
  );
}
