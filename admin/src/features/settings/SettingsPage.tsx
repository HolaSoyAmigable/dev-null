import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { useChangePassword, useSiteSettings, useUpdateSettings } from "@/api/hooks";
import type { SiteSettings } from "@/api/types";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNotice, PageHeader, Spinner } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

const settingsSchema = z.object({
  site_name: z.string().trim().min(1, "Obligatorio.").max(100),
  author_name: z.string().trim().min(1, "Obligatorio.").max(150),
  short_bio: z.string().trim().max(500),
  about_md: z.string(),
  social_links: z.array(
    z.object({
      label: z.string().trim().min(1, "Obligatorio.").max(50),
      url: z.string().trim().regex(/^https?:\/\/\S+$/, "Debe ser una URL http(s)."),
    }),
  ),
});
type SettingsForm = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const settings = useSiteSettings();
  return (
    <>
      <PageHeader title="Ajustes" description="Información del sitio visible en cabecera, pie y /about." />
      <ErrorNotice error={settings.error} />
      {settings.isPending ? <Spinner /> : settings.data ? <SiteSettingsForm settings={settings.data} /> : null}
      <ChangePasswordCard />
    </>
  );
}

function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const update = useUpdateSettings();
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      site_name: settings.site_name ?? "dev/null",
      author_name: settings.author_name ?? "",
      short_bio: settings.short_bio ?? "",
      about_md: settings.about_md ?? "",
      social_links: settings.social_links ?? [],
    },
  });
  const links = useFieldArray({ control, name: "social_links" });

  const onSubmit = handleSubmit(async (values) => {
    const result = await update.mutateAsync(values);
    reset({
      site_name: result.site_name ?? "",
      author_name: result.author_name ?? "",
      short_bio: result.short_bio ?? "",
      about_md: result.about_md ?? "",
      social_links: result.social_links ?? [],
    });
    setSaved(true);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate onChange={() => setSaved(false)}>
      <Card>
        <CardHeader>
          <CardTitle>Identidad</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre del sitio" error={errors.site_name?.message}>
            <Input {...register("site_name")} />
          </Field>
          <Field label="Nombre del autor" error={errors.author_name?.message} hint="Aparece en el <title> de cada página.">
            <Input {...register("author_name")} />
          </Field>
          <Field label="Bio corta" error={errors.short_bio?.message} className="md:col-span-2">
            <Textarea {...register("short_bio")} rows={2} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Redes sociales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {links.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[10rem_1fr_auto] items-start gap-2">
              <Field label="Etiqueta" error={errors.social_links?.[index]?.label?.message}>
                <Input {...register(`social_links.${index}.label`)} placeholder="GitHub" />
              </Field>
              <Field label="URL" error={errors.social_links?.[index]?.url?.message}>
                <Input {...register(`social_links.${index}.url`)} placeholder="https://github.com/…" />
              </Field>
              <Button
                size="icon"
                variant="ghost"
                className="mt-7"
                aria-label="Quitar enlace"
                onClick={() => links.remove(index)}
              >
                <Trash2 className="size-4 text-danger" aria-hidden />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => links.append({ label: "", url: "" })}>
            <Plus className="size-4" aria-hidden /> Añadir enlace
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Página «Sobre mí»</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setPreview((v) => !v)}>
            {preview ? "Editar" : "Vista previa"}
          </Button>
        </CardHeader>
        <CardContent>
          {preview ? (
            <MarkdownPreview source={watch("about_md")} />
          ) : (
            <Textarea
              aria-label="Contenido de la página Sobre mí en Markdown"
              {...register("about_md")}
              rows={12}
              className="font-mono text-[13px]"
            />
          )}
        </CardContent>
      </Card>

      <ErrorNotice error={update.error} />
      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="text-sm text-accent" role="status">
            Guardado. El sitio se está regenerando.
          </span>
        ) : null}
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          Guardar ajustes
        </Button>
      </div>
    </form>
  );
}

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Obligatoria."),
    new_password: z.string().min(12, "Mínimo 12 caracteres."),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "No coincide." });
type PasswordForm = z.infer<typeof passwordSchema>;

function ChangePasswordCard() {
  const change = useChangePassword();
  const { logout } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = handleSubmit(async ({ current_password, new_password }) => {
    await change.mutateAsync({ current_password, new_password });
    window.alert("Contraseña cambiada. Vuelve a iniciar sesión.");
    await logout();
  });

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3" noValidate>
          <Field label="Contraseña actual" error={errors.current_password?.message}>
            <Input type="password" autoComplete="current-password" {...register("current_password")} />
          </Field>
          <Field label="Nueva contraseña" error={errors.new_password?.message}>
            <Input type="password" autoComplete="new-password" {...register("new_password")} />
          </Field>
          <Field label="Repite la nueva" error={errors.confirm?.message}>
            <Input type="password" autoComplete="new-password" {...register("confirm")} />
          </Field>
          <div className="md:col-span-3">
            <ErrorNotice error={change.error} />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button type="submit" variant="secondary" disabled={isSubmitting}>
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
