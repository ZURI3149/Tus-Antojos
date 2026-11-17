import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCategorySchema,
  type Category,
  type CreateCategory,
  type CreateCategoryInput,
} from '@tus-antojos/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { CatalogNav } from './CatalogNav';
import { notifyCatalogError, useCategories, useCreateCategory, useUpdateCategory } from './api';
import { ListState, StatusBadge } from './common';

export function CategoriesPage() {
  const categories = useCategories();
  const [creating, setCreating] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <CatalogNav />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Categorías</h1>
        {!creating && <Button onClick={() => setCreating(true)}>Nueva categoría</Button>}
      </div>

      {creating && <NewCategory onDone={() => setCreating(false)} />}

      <ListState query={categories} what="las categorías" />
      {categories.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no hay categorías.</p>
      )}
      {categories.data && categories.data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="w-24 px-3 py-2 font-medium">Orden</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.data.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NewCategory({ onDone }: { onDone: () => void }) {
  const create = useCreateCategory();
  return (
    <CategoryForm
      label="Nueva categoría"
      submitLabel="Crear categoría"
      defaultValues={{ name: '', sortOrder: 0 }}
      onCancel={onDone}
      onSubmit={async (values) => {
        await create.mutateAsync(values);
        onDone();
      }}
    />
  );
}

function CategoryRow({ category }: { category: Category }) {
  const update = useUpdateCategory();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-t">
        <td colSpan={4} className="p-2">
          <CategoryForm
            label={`Editar ${category.name}`}
            submitLabel="Guardar"
            defaultValues={{ name: category.name, sortOrder: category.sortOrder }}
            onCancel={() => setEditing(false)}
            onSubmit={async ({ name, sortOrder }) => {
              await update.mutateAsync({ id: category.id, changes: { name, sortOrder } });
              setEditing(false);
            }}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t">
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{category.sortOrder}</td>
      <td className="px-3 py-2 font-medium">{category.name}</td>
      <td className="px-3 py-2">
        <StatusBadge active={category.isActive} />
      </td>
      <td className="flex justify-end gap-2 px-3 py-2">
        <Button
          size="sm"
          variant="outline"
          aria-label={`Editar ${category.name}`}
          onClick={() => setEditing(true)}
        >
          Editar
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={`${category.isActive ? 'Desactivar' : 'Activar'} ${category.name}`}
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { id: category.id, changes: { isActive: !category.isActive } },
              { onError: notifyCatalogError },
            )
          }
        >
          {category.isActive ? 'Desactivar' : 'Activar'}
        </Button>
      </td>
    </tr>
  );
}

function CategoryForm({
  label,
  submitLabel,
  defaultValues,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  defaultValues: { name: string; sortOrder: number };
  onSubmit: (values: CreateCategory) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<CreateCategoryInput, unknown, CreateCategory>({
    resolver: zodResolver(createCategorySchema),
    defaultValues,
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        form.setError('name', { message: error.message });
        return;
      }
      notifyCatalogError(error);
    }
  });

  const id = (field: string) => `${label}-${field}`.replace(/\s+/g, '-');

  return (
    <form
      aria-label={label}
      onSubmit={submit}
      noValidate
      className="flex flex-wrap items-start gap-3 rounded-lg border p-3"
    >
      <Field data-invalid={!!errors.name} className="min-w-48 flex-1">
        <FieldLabel htmlFor={id('name')}>Nombre</FieldLabel>
        <Input id={id('name')} aria-invalid={!!errors.name} {...form.register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.sortOrder} className="w-28">
        <FieldLabel htmlFor={id('sortOrder')}>Orden</FieldLabel>
        <Input
          id={id('sortOrder')}
          type="number"
          min={0}
          max={9999}
          aria-invalid={!!errors.sortOrder}
          {...form.register('sortOrder', { valueAsNumber: true })}
        />
        <FieldError errors={[errors.sortOrder]} />
      </Field>
      <div className="flex gap-2 self-end pb-0.5">
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
