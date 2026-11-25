import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, BarChart3, ExternalLink, History } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { cn, formatDateTime, slugify, toLocalInputValue } from "@/lib/utils";

import { DevMetadataFields } from "./editor/DevMetadataFields";
import { clearDraft, draftKey, findRestorableDraft, useDraftAutosave } from "./editor/draft";
import { DraftRestoreBanner, DraftStatusLabel } from "./editor/DraftNotice";
import { EditorStats } from "./editor/EditorStats";
import { MarkdownEditor, type MarkdownEditorHandle } from "./editor/MarkdownEditor";
import { imageMarkdown } from "./editor/snippets";
import {
  postFormSchema,
  toFormValues,
  toPayload,
  type PostFormInput,
  type PostFormOutput,
} from "./postForm";
import { RevisionsDialog } from "./RevisionsDialog";
import { STATUS_LABELS, STATUS_TONES } from "./status";

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
  const [tab, setTab] = useState<"write" | "preview">("write");
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
  const editorRef = useRef<MarkdownEditorHandle>(null);
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

  return (
    <>
      <Link to="/posts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Posts
      </Link>
      <PageHeader
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
        className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]"
      >
        <div className="min-w-0 space-y-4">
          <Field label="Título" error={errors.title?.message}>
            <Input {...register("title")} className="h-11 text-base" />
          </Field>
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

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div role="tablist" aria-label="Editor" className="flex gap-1">
                  {(["write", "preview"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={tab === value}
                      onClick={() => setTab(value)}
                      className={cn(
                        "cursor-pointer rounded-md px-3 py-1 text-sm",
                        tab === value ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      {value === "write" ? "Escribir" : "Vista previa"}
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
              </div>
            </div>
            {tab === "write" ? (
              <Controller
                name="content_md"
                control={control}
                render={({ field }) => (
                  <MarkdownEditor
                    id="content-md"
                    ref={editorRef}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            ) : (
              <Card className="min-h-96 p-6">
                <MarkdownPreview source={content ?? ""} />
              </Card>
            )}
          </div>
        </div>

        <aside className="space-y-4">
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
            // Desde la vista previa el editor no está montado: se añade al final.
            setValue(
              "content_md",
              `${content ?? ""}\n\n${imageMarkdown(media.alt_text ?? "", media.url)}\n`,
              { shouldDirty: true },
            );
          }
          setInsertImage(false);
          setTab("write");
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
