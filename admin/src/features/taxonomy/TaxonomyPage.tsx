import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { useCategories, useTags, useTaxonomyMutations } from "@/api/hooks";
import type { Category, Tag } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNotice, PageHeader, Spinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";

type Item = Tag | Category;

export function TaxonomyPage() {
  const tags = useTags();
  const categories = useCategories();
  const m = useTaxonomyMutations();
  const error =
    tags.error ?? categories.error ?? m.createTag.error ?? m.updateTag.error ?? m.deleteTag.error ??
    m.createCategory.error ?? m.updateCategory.error ?? m.deleteCategory.error;

  return (
    <>
      <PageHeader title="Etiquetas y categorías" description="Cada post tiene una categoría y varias etiquetas." />
      <ErrorNotice error={error} />
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <TaxonomyList
          title="Categorías"
          items={categories.data}
          loading={categories.isPending}
          onCreate={(name) => m.createCategory.mutateAsync({ name })}
          onUpdate={(item, name, slug) =>
            m.updateCategory.mutateAsync({ id: item.id, name, slug, description: (item as Category).description })
          }
          onDelete={(item) => m.deleteCategory.mutate(item.id)}
        />
        <TaxonomyList
          title="Etiquetas"
          prefix="#"
          items={tags.data}
          loading={tags.isPending}
          onCreate={(name) => m.createTag.mutateAsync(name)}
          onUpdate={(item, name, slug) => m.updateTag.mutateAsync({ id: item.id, name, slug })}
          onDelete={(item) => m.deleteTag.mutate(item.id)}
        />
      </div>
    </>
  );
}

type ListProps = {
  title: string;
  prefix?: string;
  items: Item[] | undefined;
  loading: boolean;
  onCreate: (name: string) => Promise<unknown>;
  onUpdate: (item: Item, name: string, slug: string) => Promise<unknown>;
  onDelete: (item: Item) => void;
};

function TaxonomyList({ title, prefix = "", items, loading, onCreate, onUpdate, onDelete }: ListProps) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string; slug: string } | null>(null);
  const inputId = `new-${title}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            await onCreate(name.trim());
            setName("");
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Nombre de la nueva {title.toLowerCase()}
          </label>
          <Input id={inputId} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre…" />
          <Button type="submit" variant="secondary">
            Añadir
          </Button>
        </form>
        {loading ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-border">
            {items?.map((item) =>
              editing?.id === item.id ? (
                <li key={item.id} className="flex gap-2 py-2">
                  <Input
                    aria-label="Nombre"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="h-8"
                  />
                  <Input
                    aria-label="Slug"
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    className="h-8 font-mono"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Guardar"
                    onClick={async () => {
                      await onUpdate(item, editing.name, editing.slug);
                      setEditing(null);
                    }}
                  >
                    <Check className="size-4" aria-hidden />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Cancelar" onClick={() => setEditing(null)}>
                    <X className="size-4" aria-hidden />
                  </Button>
                </li>
              ) : (
                <li key={item.id} className="flex items-center justify-between py-2">
                  <span>
                    {prefix}
                    {item.name} <span className="font-mono text-xs text-muted">/{item.slug}</span>
                  </span>
                  <span className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={`Editar ${item.name}`}
                      onClick={() => setEditing({ id: item.id, name: item.name, slug: item.slug })}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={`Eliminar ${item.name}`}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar «${item.name}»? Se quitará de los posts.`)) onDelete(item);
                      }}
                    >
                      <Trash2 className="size-4 text-danger" aria-hidden />
                    </Button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
