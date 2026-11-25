import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { PostFormInput } from "../postForm";

type Props = {
  register: UseFormRegister<PostFormInput>;
  errors: FieldErrors<PostFormInput>;
  /** El orden en la serie solo aplica cuando el post pertenece a un proyecto (bitácora). */
  hasProject: boolean;
};

/** Metadatos para desarrolladores del bloque "Organización": repositorio, serie y destacado. */
export function DevMetadataFields({ register, errors, hasProject }: Props) {
  return (
    <>
      <Field
        label="Repositorio de GitHub"
        error={errors.github_repo?.message}
        hint="Opcional. usuario/repositorio o URL."
      >
        <Input {...register("github_repo")} placeholder="usuario/repositorio" className="font-mono" />
      </Field>
      <Field
        label="Orden en la serie"
        error={errors.series_order?.message}
        hint={hasProject ? "Posición dentro de la bitácora del proyecto." : "Elige un proyecto para ordenar la serie."}
      >
        <Input
          {...register("series_order")}
          inputMode="numeric"
          placeholder="1"
          // `readOnly` (y no `disabled`): react-hook-form ignoraría el valor de un input deshabilitado.
          readOnly={!hasProject}
          aria-disabled={!hasProject}
          className={cn("w-24 font-mono", !hasProject && "cursor-not-allowed opacity-50")}
        />
      </Field>
      <Switch
        {...register("featured")}
        label="Fijar en la portada"
        hint="Aparece destacado al inicio del blog."
      />
    </>
  );
}
