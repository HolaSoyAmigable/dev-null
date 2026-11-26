import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, BarChart3, ExternalLink, History, Maximize2, Minimize2 } from "lucide-react";
import { lazy, Suspense, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, type UseFormRegister } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";

import {
  useCategories,
  useCreatePost,
  usePost,
  usePostAction,
  useProjects,
  useSchedulePost,
  useTags,
  useUpdatePost,
} from "@/api/hooks";
import type { Media, Post } from "@/api/types";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNotice, PageHeader, Spinner } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MediaDialog, MediaPicker } from "@/features/media/MediaPicker";
import { extractOutline } from "@/lib/outline";
import { cn, formatDateTime, slugify, toLocalInputValue } from "@/lib/utils";

import { DevMetadataFields } from "./editor/DevMetadataFields";
import { clearDraft, draftKey, findRestorableDraft, useDraftAutosave } from "./editor/draft";
import { DraftRestoreBanner, DraftStatusLabel } from "./editor/DraftNotice";
import { EditorStats } from "./editor/EditorStats";
import type { EditorHandle } from "./editor/handle";
import { MarkdownEditor } from "./editor/MarkdownEditor";
import { OutlineCard } from "./editor/OutlineCard";
import { imageMarkdown } from "./editor/snippets";
import { useEditorView, type EditorView } from "./editor/useEditorView";
import {
  postFormSchema,
  toFormValues,
  toPayload,
  type PostFormInput,
  type PostFormOutput,
} from "./postForm";
import { RevisionsDialog } from "./RevisionsDialog";
import { STATUS_LABELS, STATUS_TONES } from "./status";

// El editor visual (TipTap) es pesado: se descarga solo cuando se usa.
const VisualEditor = lazy(() => import("./visual/VisualEditor"));

const VIEW_TABS: readonly { value: EditorView; label: string }[] = [
  { value: "visual", label: "Editar" },
  { value: "markdown", label: "Markdown" },
  { value: "preview", label: "Vista previa" },
  { value: "split", label: "Dividida" },
];

export function PostEditorPage() {
  const { id } = useParams();
  const postId = id ? Number(id) : undefined;
  const post = usePost(postId);

  if (postId !== undefined && post.isPending) return <Spinner />;
  if (postId !== undefined && post.error) return <ErrorNotice error={post.error} />;
  return <PostEditor key={post.data?.id ?? "new"} post={post.data} />;
}

function PostEditor({ post }: { post: Post | undefined }) {
  const navigate = useNavigate();
  const tags = useTags();
  const categories = useCategories();
  const projects = useProjects();
  const create = useCreatePost();
  const update = useUpdatePost(post?.id ?? 0);
  const action = usePostAction();
  const schedule = useSchedulePost(post?.id ?? 0);

  const [cover, setCover] = useState<Media | null>(post?.cover ?? null);
  const [og, setOg] = useState<Media | null>(post?.og_media ?? null);
  // Vista del editor (se recuerda), modo enfoque y altura de la cabecera fija (para anclar la barra).
  const [view, setView] = useEditorView();
  const [focus, setFocus] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => setBarHeight(Math.round(bar.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  const [scheduleAt, setScheduleAt] = useState(
    post?.scheduled_for
      ? toLocalInputValue(new Date(post.scheduled_for))
      : toLocalInputValue(new Date(Date.now() + 3600_000)),
  );
  const [showRevisions, setShowRevisions] = useState(false);
  const [insertImage, setInsertImage] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const form = useForm<PostFormInput, unknown, PostFormOutput>({
    resolver: zodResolver(postFormSchema),
    defaultValues: toFormValues(post),
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  // Autoguardado local de borradores (localStorage, cada 30 s) y restauración al abrir.
  const editorRef = useRef<EditorHandle>(null);
  const storageKey = draftKey(post?.id);
  const [restorable, setRestorable] = useState(() =>
    findRestorableDraft<PostFormInput>(storageKey, toFormValues(post), post?.updated_at ?? null),
  );
  const draft = useDraftAutosave<PostFormInput>({
    storageKey,
    values: watch(),
    dirty: isDirty,
    baseUpdatedAt: post?.updated_at ?? null,
  });

  const mediaDirty = (cover?.id ?? null) !== (post?.cover_media_id ?? null) ||
    (og?.id ?? null) !== (post?.og_media_id ?? null);
  const dirty = isDirty || mediaDirty;

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = handleSubmit(async (values) => {
    const payload = toPayload(values, cover, og);
    if (post) {
      const saved = await update.mutateAsync(payload);
      reset(toFormValues(saved));
      draft.discard(); // lo guardado en el servidor sustituye al borrador local
      setRestorable(null);
      setSavedAt(saved.updated_at);
    } else {
      const created = await create.mutateAsync(payload);
      reset(toFormValues(created));
      draft.discard();
      setRestorable(null);
      navigate(`/posts/${created.id}`, { replace: true });
    }
  });

  // Ctrl/Cmd + S guarda.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  const runAction = async (kind: "publish" | "unpublish" | "archive") => {
    if (!post) return;
    if (dirty) await save();
    const updated = await action.mutateAsync({ id: post.id, action: kind });
    reset(toFormValues(updated));
  };

  const title = watch("title");
  const slug = watch("slug");
  const content = watch("content_md");
  const selectedTags = watch("tag_ids");
  const seoTitle = watch("seo_title");
  const seoDescription = watch("seo_description");
  const excerpt = watch("excerpt");
  const projectId = watch("project_id");
  const seriesOrder = watch("series_order");
  const mutationError = create.error ?? update.error ?? action.error ?? schedule.error;

  // El orden en la serie solo existe dentro de un proyecto: al quitarlo se limpia el campo.
  useEffect(() => {
    if (!projectId && seriesOrder) setValue("series_order", "", { shouldDirty: true });
  }, [projectId, seriesOrder, setValue]);

  // La vista previa y el índice se calculan con el texto "diferido" para no frenar la escritura.
  const deferredContent = useDeferredValue(content ?? "");
  const outline = useMemo(() => extractOutline(deferredContent), [deferredContent]);
  const jumpTo = (offset: number, index: number) => {
    if (view === "preview") setView("visual");
    // Si el editor acaba de montarse, se espera a que exista.
    window.setTimeout(() => editorRef.current?.jumpTo({ offset, index }), view === "preview" ? 150 : 0);
  };

  // Editor visual (WYSIWYG) o de texto (Markdown); ambos comparten el mismo campo `content_md`.
  const editor = (
    <Controller
      name="content_md"
      control={control}
      render={({ field }) =>
        view === "visual" ? (
          <Suspense fallback={<div className="min-h-96 rounded-md border border-border bg-surface" aria-busy="true" />}>
            <VisualEditor
              id="content-md"
              ref={editorRef}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              stickyTop={barHeight}
            />
          </Suspense>
        ) : (
          <MarkdownEditor
            id="content-md"
            ref={editorRef}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            stickyTop={barHeight}
          />
        )
      }
    />
  );

  return (
    <>
      <Link to="/posts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Posts
      </Link>
      {/* Cabecera fija: Guardar, Publicar y el estado quedan a la vista al hacer scroll. */}
      <div
        ref={barRef}
        className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-bg/95 px-4 pb-3 pt-3 backdrop-blur md:-mx-8 md:px-8"
      >
        <PageHeader
          className="mb-0"
          title={post ? "Editar post" : "Nuevo post"}
          description={
            post
              ? `Actualizado ${formatDateTime(savedAt ?? post.updated_at)}`
              : "Se guarda como borrador."
          }
          actions={
            <>
              {post ? (
                <Badge tone={STATUS_TONES[post.status]} className="self-center">
                  {STATUS_LABELS[post.status]}
                </Badge>
              ) : null}
              {post ? (
                <Button variant="ghost" onClick={() => setShowRevisions(true)}>
                  <History className="size-4" aria-hidden /> Revisiones
                </Button>
              ) : null}
              {post?.status === "published" ? (
                <>
                  <Link
                    to={`/?post=${post.id}`}
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    <BarChart3 className="size-4" aria-hidden /> Métricas
                  </Link>
                  <a
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    <ExternalLink className="size-4" aria-hidden /> Ver
                  </a>
                </>
              ) : null}
              <Button onClick={() => void save()} disabled={isSubmitting} variant="secondary">
                {isSubmitting ? "Guardando…" : dirty ? "Guardar*" : "Guardar"}
              </Button>
            </>
          }
        />
      </div>

      <ErrorNotice error={mutationError} />

      {restorable ? (
        <DraftRestoreBanner
          savedAt={restorable.savedAt}
          onRestore={() => {
            // Se conservan los valores originales como referencia: lo restaurado cuenta como cambio sin guardar.
            reset(restorable.values, { keepDefaultValues: true });
            setRestorable(null);
          }}
          onDiscard={() => {
            clearDraft(storageKey);
            setRestorable(null);
          }}
        />
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className={cn("mt-4 grid gap-6", !focus && "lg:grid-cols-[1fr_20rem]")}
      >
        <div className={cn("min-w-0 space-y-4", focus && "mx-auto w-full max-w-5xl")}>
          <Field label="Título" error={errors.title?.message}>
            <Input {...register("title")} className="h-11 text-base" />
          </Field>
          {/* En modo enfoque solo quedan el título y el editor (slug y extracto siguen en el formulario). */}
          <div className={cn("space-y-4", focus && "hidden")}>
            <Field
              label="Slug"
              error={errors.slug?.message}
              hint={<span className="font-mono">/blog/{slug || slugify(title || "")}</span>}
            >
              <Input {...register("slug")} placeholder="Se genera desde el título" className="font-mono" />
            </Field>
            <Field label="Extracto" error={errors.excerpt?.message} hint="Resumen corto para listados y SEO.">
              <Textarea {...register("excerpt")} rows={2} />
            </Field>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div role="tablist" aria-label="Editor" className="flex gap-1">
                  {VIEW_TABS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={view === value}
                      onClick={() => setView(value)}
                      className={cn(
                        "cursor-pointer rounded-md px-3 py-1 text-sm",
                        value === "split" && "max-lg:hidden",
                        view === value ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <EditorStats markdown={content ?? ""} />
              </div>
              <div className="flex items-center gap-3">
                <DraftStatusLabel status={draft.status} savedAt={draft.savedAt} />
                <Button size="sm" variant="ghost" onClick={() => setInsertImage(true)}>
                  Insertar imagen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-pressed={focus}
                  onClick={() => setFocus((value) => !value)}
                  title={focus ? "Volver al formulario completo" : "Oculta el panel lateral para escribir sin distracciones"}
                >
                  {focus ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
                  {focus ? "Salir del enfoque" : "Enfoque"}
                </Button>
              </div>
            </div>
            {view === "visual" || view === "markdown" ? (
              editor
            ) : view === "preview" ? (
              <Card className="min-h-96 p-6">
                <MarkdownPreview source={deferredContent} />
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="min-w-0">{editor}</div>
                {/* La vista previa acompaña al scroll, bajo la cabecera fija. */}
                <div
                  className="min-w-0 self-start lg:sticky lg:overflow-auto"
                  style={{ top: barHeight + 12, maxHeight: `calc(100vh - ${barHeight + 24}px)` }}
                >
                  <Card className="min-h-96 p-6">
                    <MarkdownPreview source={deferredContent} />
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className={cn("space-y-4", focus && "hidden")}>
          <OutlineCard items={outline} onJump={jumpTo} />
          {post ? (
            <PublishCard
              post={post}
              scheduleAt={scheduleAt}
              onScheduleChange={setScheduleAt}
              busy={action.isPending || schedule.isPending}
              onAction={(kind) => void runAction(kind)}
              onSchedule={async () => {
                if (dirty) await save();
                const updated = await schedule.mutateAsync(new Date(scheduleAt).toISOString());
                reset(toFormValues(updated));
              }}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Organización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Categoría">
                <Select {...register("category_id")}>
                  <option value="">Sin categoría</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Proyecto (bitácora)">
                <Select {...register("project_id")}>
                  <option value="">Ninguno</option>
                  {projects.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <DevMetadataFields register={register} errors={errors} hasProject={Boolean(projectId)} />
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Etiquetas</legend>
                {tags.data?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.data.map((tag) => {
                      const checked = selectedTags?.includes(tag.id) ?? false;
                      return (
                        <label
                          key={tag.id}
                          className={cn(
                            "cursor-pointer rounded border px-2 py-1 font-mono text-xs",
                            checked
                              ? "border-accent bg-accent/15 text-accent"
                              : "border-border text-muted hover:text-fg",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() =>
                              setValue(
                                "tag_ids",
                                checked
                                  ? (selectedTags ?? []).filter((t) => t !== tag.id)
                                  : [...(selectedTags ?? []), tag.id],
                                { shouldDirty: true },
                              )
                            }
                          />
                          #{tag.name}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Crea etiquetas en <Link to="/taxonomy" className="text-accent">Etiquetas</Link>.
                  </p>
                )}
              </fieldset>
              <MediaPicker label="Portada" value={cover} onChange={setCover} />
            </CardContent>
          </Card>

          <SeoCard
            register={register}
            errors={errors}
            title={seoTitle || title}
            description={seoDescription || excerpt || ""}
            slug={slug || slugify(title || "")}
            og={og}
            onOgChange={setOg}
          />
        </aside>
      </form>

      {post ? (
        <RevisionsDialog
          postId={post.id}
          open={showRevisions}
          onClose={() => setShowRevisions(false)}
          onRestored={(restored) => reset(toFormValues(restored))}
        />
      ) : null}
      <MediaDialog
        open={insertImage}
        title="Insertar imagen"
        onClose={() => setInsertImage(false)}
        onSelect={(media) => {
          if (editorRef.current) {
            editorRef.current.insertMedia(media); // en la posición del cursor
          } else {
            // Desde la vista previa no hay editor montado: se añade al final.
            setValue(
              "content_md",
              `${content ?? ""}\n\n${imageMarkdown(media.alt_text ?? "", media.url)}\n`,
              { shouldDirty: true },
            );
          }
          setInsertImage(false);
          if (view === "preview") setView("visual");
        }}
      />
    </>
  );
}

type PublishCardProps = {
  post: Post;
  scheduleAt: string;
  busy: boolean;
  onScheduleChange: (value: string) => void;
  onAction: (kind: "publish" | "unpublish" | "archive") => void;
  onSchedule: () => Promise<void>;
};

function PublishCard({ post, scheduleAt, busy, onScheduleChange, onAction, onSchedule }: PublishCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Publicación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {post.published_at ? (
          <p className="text-xs text-muted">Publicado por primera vez: {formatDateTime(post.published_at)}</p>
        ) : null}
        {post.status === "scheduled" ? (
          <p className="text-xs text-info">Programado para {formatDateTime(post.scheduled_for)}</p>
        ) : null}
        {post.status !== "published" ? (
          <Button className="w-full" disabled={busy} onClick={() => onAction("publish")}>
            Publicar ahora
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" disabled={busy} onClick={() => onAction("unpublish")}>
            Volver a borrador
          </Button>
        )}
        {post.status !== "published" ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <Field label="Programar para">
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => onScheduleChange(event.target.value)}
              />
            </Field>
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => void onSchedule()}>
              Programar
            </Button>
          </div>
        ) : null}
        {post.status !== "archived" ? (
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => onAction("archive")}>
            Archivar
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

type SeoCardProps = {
  register: UseFormRegister<PostFormInput>;
  errors: ReturnType<typeof useForm<PostFormInput>>["formState"]["errors"];
  title: string;
  description: string;
  slug: string;
  og: Media | null;
  onOgChange: (media: Media | null) => void;
};

function SeoCard({ register, errors, title, description, slug, og, onOgChange }: SeoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-bg p-3" aria-label="Vista previa en buscadores">
          <p className="truncate text-sm text-info">{title || "Título del post"}</p>
          <p className="truncate font-mono text-xs text-accent">…/blog/{slug}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">{description || "Sin descripción."}</p>
        </div>
        <Field label="Título SEO" error={errors.seo_title?.message} hint={`${title.length}/60 recomendado`}>
          <Input {...register("seo_title")} />
        </Field>
        <Field
          label="Descripción SEO"
          error={errors.seo_description?.message}
          hint={`${description.length}/160 recomendado`}
        >
          <Textarea {...register("seo_description")} rows={3} />
        </Field>
        <Field label="URL canónica" error={errors.canonical_url?.message} hint="Solo si se publicó antes en otro sitio.">
          <Input {...register("canonical_url")} placeholder="https://…" />
        </Field>
        <MediaPicker label="Imagen Open Graph" value={og} onChange={onOgChange} />
      </CardContent>
    </Card>
  );
}
