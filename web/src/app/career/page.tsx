import type { Metadata } from "next";

import { Markdown } from "@/components/Markdown";
import { PageTitle } from "@/components/PostList";
import type { CareerEntry } from "@/lib/api/client";
import { getCareer } from "@/lib/data";
import { formatMonth } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Carrera",
  description: "Formación, experiencia, logros y certificaciones.",
  alternates: { canonical: "/career" },
};

const TYPE_LABEL: Record<CareerEntry["type"], string> = {
  work: "experiencia",
  education: "formación",
  achievement: "logro",
  certification: "certificación",
};

export default async function CareerPage() {
  const entries = await getCareer();
  const skills = [...new Set(entries.flatMap((e) => e.skills))];

  return (
    <>
      <PageTitle prompt="git log --career" title="Carrera" description="Formación, experiencia, logros y certificaciones." />
      {entries.length ? (
        <ol className="relative ml-2 border-l border-border">
          {entries.map((entry, index) => (
            <li key={`${entry.title}-${index}`} className="mb-10 ml-6">
              <span
                className={`absolute -left-[5px] mt-2 size-2.5 rounded-full ${entry.end_date ? "bg-border" : "bg-accent"}`}
                aria-hidden
              />
              <p className="font-mono text-xs text-muted">
                <span className="text-accent">[{TYPE_LABEL[entry.type]}]</span>{" "}
                <time dateTime={entry.start_date}>{formatMonth(entry.start_date)}</time> →{" "}
                {entry.end_date ? <time dateTime={entry.end_date}>{formatMonth(entry.end_date)}</time> : "actual"}
              </p>
              <h2 className="mt-1 font-mono text-lg font-semibold">{entry.title}</h2>
              {entry.organization || entry.location ? (
                <p className="text-sm text-muted">{[entry.organization, entry.location].filter(Boolean).join(" · ")}</p>
              ) : null}
              {entry.description_md ? (
                <div className="mt-3 text-sm">
                  <Markdown source={entry.description_md} />
                </div>
              ) : null}
              {entry.skills.length ? (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Habilidades">
                  {entry.skills.map((skill) => (
                    <li key={skill} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="font-mono text-sm text-muted">El historial aún no tiene commits.</p>
      )}
      {skills.length ? (
        <section aria-labelledby="skills" className="mt-8 border-t border-border pt-8">
          <h2 id="skills" className="font-mono text-xl font-semibold">
            Habilidades
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li key={skill} className="rounded-md border border-border px-2 py-1 font-mono text-sm">
                {skill}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
