import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { z } from "zod";

import { useDeleteProject, useProject, useSaveProject } from "@/api/hooks";
import type { Media, Project } from "@/api/types";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNotice, PageHeader, Spinner } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MediaPicker } from "@/features/media/MediaPicker";

import { PROJECT_STATUS } from "./ProjectsPage";

const url = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Debe ser una URL http(s).")
  .transform((v) => v || null);
const optionalDate = z.string().transform((v) => v || null);

const schema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
    slug: z
      .string()
      .trim()
      .regex(/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/, "Solo minúsculas, números y guiones."),
    summary: z.string().trim().max(1000).transform((v) => v || null),
    description_md: z.string().transform((v) => v || null),
    repo_url: url,
    demo_url: url,
    stack: z.string().transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    status: z.enum(["active", "finished", "paused"]),
    start_date: optionalDate,
    end_date: optionalDate,
    featured: z.boolean(),
    sort_order: z.coerce.number<string | number>().int(),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "La fecha de fin no puede ser anterior a la de inicio.",
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function toValues(project?: Project): FormInput {
  return {
    name: project?.name ?? "",
    slug: project?.slug ?? "",
    summary: project?.summary ?? "",
    description_md: project?.description_md ?? "",
    repo_url: project?.repo_url ?? "",
    demo_url: project?.demo_url ?? "",
    stack: project?.stack.join(", ") ?? "",
    status: project?.status ?? "active",
    start_date: project?.start_date ?? "",
    end_date: project?.end_date ?? "",
    featured: project?.featured ?? false,
    sort_order: project?.sort_order ?? 0,
  };
}

export function ProjectEditorPage() {
  const { id } = useParams();
  const projectId = id ? Number(id) : undefined;
  const project = useProject(projectId);
  if (projectId !== undefined && project.isPending) return <Spinner />;
  if (projectId !== undefined && project.error) return <ErrorNotice error={project.error} />;
  return <ProjectForm key={project.data?.id ?? "new"} project={project.data} />;
}

function ProjectForm({ project }: { project?: Project }) {
  const navigate = useNavigate();
  const save = useSaveProject(project?.id);
  const remove = useDeleteProject();
  const [cover, setCover] = useState<Media | null>(project?.cover ?? null);
  const [preview, setPreview] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toValues(project),
  });

  const onSubmit = handleSubmit(async (values) => {
    const saved = await save.mutateAsync({
      ...values,
      slug: values.slug || null,
      cover_media_id: cover?.id ?? null,
    });
    reset(toValues(saved));
    if (!project) navigate(`/projects/${saved.id}`, { replace: true });
  });

  return (
    <>
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Proyectos
      </Link>
      <PageHeader
        title={project ? project.name : "Nuevo proyecto"}
        actions={
          project ? (
            <Button
              variant="destructive"
              onClick={() => {
                if (window.confirm(`¿Eliminar «${project.name}»? Sus posts quedarán sin proyecto.`)) {
                  remove.mutate(project.id, { onSuccess: () => navigate("/projects") });
                }
              }}
            >
              Eliminar
            </Button>
          ) : undefined
        }
      />
      <ErrorNotice error={save.error ?? remove.error} />
      <form onSubmit={onSubmit} className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]" noValidate>
        <div className="space-y-4">
          <Field label="Nombre" error={errors.name?.message}>
            <Input {...register("name")} />
          </Field>
          <Field label="Slug" error={errors.slug?.message} hint="Vacío = se genera desde el nombre.">
            <Input {...register("slug")} className="font-mono" />
          </Field>
          <Field label="Resumen" error={errors.summary?.message}>
            <Textarea {...register("summary")} rows={2} />
          </Field>
          <div>
            <div className="mb-1.5 flex justify-between">
              <span className="text-sm font-medium">Descripción (Markdown)</span>
              <Button size="sm" variant="ghost" onClick={() => setPreview((v) => !v)}>
                {preview ? "Editar" : "Vista previa"}
              </Button>
            </div>
            {preview ? (
              <Card className="p-6">
                <MarkdownPreview source={watch("description_md") ?? ""} />
              </Card>
            ) : (
              <Textarea
                aria-label="Descripción en Markdown"
                {...register("description_md")}
                rows={14}
                className="font-mono text-[13px]"
              />
            )}
          </div>
        </div>
        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-4">
              <Field label="Estado">
                <Select {...register("status")}>
                  {Object.entries(PROJECT_STATUS).map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Stack" hint="Separado por comas.">
                <Input {...register("stack")} placeholder="FastAPI, Next.js, PostgreSQL" />
              </Field>
              <Field label="Repositorio" error={errors.repo_url?.message}>
                <Input {...register("repo_url")} placeholder="https://github.com/…" />
              </Field>
              <Field label="Demo" error={errors.demo_url?.message}>
                <Input {...register("demo_url")} placeholder="https://…" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Inicio">
                  <Input type="date" {...register("start_date")} />
                </Field>
                <Field label="Fin" error={errors.end_date?.message}>
                  <Input type="date" {...register("end_date")} />
                </Field>
              </div>
              <Field label="Orden" hint="Menor = aparece antes.">
                <Input type="number" {...register("sort_order")} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("featured")} className="size-4 accent-[var(--accent)]" />
                Destacado
              </label>
              <MediaPicker label="Portada" value={cover} onChange={setCover} />
            </CardContent>
          </Card>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Guardando…" : "Guardar proyecto"}
          </Button>
        </aside>
      </form>
    </>
  );
}
