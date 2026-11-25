import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCareer, useCareerMutations } from "@/api/hooks";
import type { CareerEntry, CareerType } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNotice, PageHeader, Spinner } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export const CAREER_TYPES: Record<CareerType, string> = {
  work: "Experiencia",
  education: "Formación",
  achievement: "Logro",
  certification: "Certificación",
};

const schema = z
  .object({
    type: z.enum(["work", "education", "achievement", "certification"]),
    title: z.string().trim().min(1, "El título es obligatorio.").max(200),
    organization: z.string().trim().max(200).transform((v) => v || null),
    location: z.string().trim().max(200).transform((v) => v || null),
    start_date: z.string().min(1, "La fecha de inicio es obligatoria."),
    end_date: z.string().transform((v) => v || null),
    description_md: z.string().transform((v) => v || null),
    skills: z.string().transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    visible: z.boolean(),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "La fecha de fin no puede ser anterior a la de inicio.",
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function toValues(entry?: CareerEntry): FormInput {
  return {
    type: entry?.type ?? "work",
    title: entry?.title ?? "",
    organization: entry?.organization ?? "",
    location: entry?.location ?? "",
    start_date: entry?.start_date ?? "",
    end_date: entry?.end_date ?? "",
    description_md: entry?.description_md ?? "",
    skills: entry?.skills.join(", ") ?? "",
    visible: entry?.visible ?? true,
  };
}

export function CareerPage() {
  const career = useCareer();
  const { remove, reorder } = useCareerMutations();
  const [editing, setEditing] = useState<CareerEntry | "new" | null>(null);
  const entries = career.data ?? [];

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const ordered = [...entries];
    const [item] = ordered.splice(index, 1);
    ordered.splice(target, 0, item!);
    reorder.mutate(ordered.map((entry, i) => ({ id: entry.id, sort_order: i + 1 })));
  };

  return (
    <>
      <PageHeader
        title="Carrera"
        description="Línea de tiempo pública: experiencia, formación, logros y certificaciones."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> Nueva entrada
          </Button>
        }
      />
      <ErrorNotice error={career.error ?? remove.error ?? reorder.error} />
      {career.isPending ? (
        <Spinner />
      ) : !entries.length ? (
        <EmptyState title="La línea de tiempo está vacía." />
      ) : (
        <ol className="space-y-2">
          {entries.map((entry, index) => (
            <li key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-col">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, -1)}
                  aria-label={`Subir «${entry.title}»`}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={index === entries.length - 1 || reorder.isPending}
                  onClick={() => move(index, 1)}
                  aria-label={`Bajar «${entry.title}»`}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{CAREER_TYPES[entry.type]}</Badge>
                  <span className="font-medium">{entry.title}</span>
                  {!entry.visible ? <EyeOff className="size-4 text-muted" aria-label="Oculta" /> : null}
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  {[entry.organization, entry.location].filter(Boolean).join(" · ")}
                  {" — "}
                  {formatDate(entry.start_date)} → {entry.end_date ? formatDate(entry.end_date) : "actual"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing(entry)} aria-label={`Editar «${entry.title}»`}>
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Eliminar «${entry.title}»`}
                onClick={() => {
                  if (window.confirm(`¿Eliminar «${entry.title}»?`)) remove.mutate(entry.id);
                }}
              >
                <Trash2 className="size-4 text-danger" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nueva entrada" : "Editar entrada"}
        className="max-w-2xl"
      >
        {editing !== null ? (
          <CareerForm
            key={editing === "new" ? "new" : editing.id}
            entry={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function CareerForm({ entry, onDone }: { entry?: CareerEntry; onDone: () => void }) {
  const { save } = useCareerMutations();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toValues(entry),
  });

  const onSubmit = handleSubmit(async (values) => {
    await save.mutateAsync({ id: entry?.id, body: values });
    onDone();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select {...register("type")}>
            {Object.entries(CAREER_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Título" error={errors.title?.message}>
          <Input {...register("title")} />
        </Field>
        <Field label="Organización">
          <Input {...register("organization")} />
        </Field>
        <Field label="Ubicación">
          <Input {...register("location")} />
        </Field>
        <Field label="Inicio" error={errors.start_date?.message}>
          <Input type="date" {...register("start_date")} />
        </Field>
        <Field label="Fin" error={errors.end_date?.message} hint="Vacío = actual.">
          <Input type="date" {...register("end_date")} />
        </Field>
      </div>
      <Field label="Habilidades" hint="Separadas por comas.">
        <Input {...register("skills")} />
      </Field>
      <Field label="Descripción (Markdown)">
        <Textarea {...register("description_md")} rows={5} className="font-mono text-[13px]" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("visible")} className="size-4 accent-[var(--accent)]" />
        Visible en el sitio
      </label>
      <ErrorNotice error={save.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
