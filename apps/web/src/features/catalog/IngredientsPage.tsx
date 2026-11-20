import { zodResolver } from '@hookform/resolvers/zod';
import {
  createIngredientSchema,
  INGREDIENT_UNITS,
  type CreateIngredient,
  type CreateIngredientInput,
  type Ingredient,
} from '@tus-antojos/shared';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { selectClassName } from '@/lib/utils';
import { CatalogNav } from './CatalogNav';
import {
  notifyCatalogError,
  useCreateIngredient,
  useIngredients,
  useProducts,
  useUpdateIngredient,
} from './api';
import { ListState, StatusBadge } from './common';
import { normalizeSearch, UNIT_LABELS } from './labels';

/** Productos (activos o no) que usan cada insumo en su receta. */
function useRecipeUsage(): Map<string, number> {
  const products = useProducts();
  return useMemo(() => {
    const usage = new Map<string, number>();
    for (const product of products.data ?? []) {
      for (const item of product.recipe) {
        usage.set(item.ingredientId, (usage.get(item.ingredientId) ?? 0) + 1);
      }
    }
    return usage;
  }, [products.data]);
}

export function IngredientsPage() {
  const ingredients = useIngredients();
  const usage = useRecipeUsage();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const term = normalizeSearch(search);
    return (ingredients.data ?? []).filter((i) => normalizeSearch(i.name).includes(term));
  }, [ingredients.data, search]);

  return (
    <section className="flex flex-col gap-6">
      <CatalogNav />
      <PageHeader
        eyebrow="Catálogo"
        title="Insumos"
        description="Lo que consume cada receta, medido en g, ml o unidades."
        actions={!creating && <Button onClick={() => setCreating(true)}>Nuevo insumo</Button>}
      />

      {creating && <NewIngredient onDone={() => setCreating(false)} />}

      <Input
        type="search"
        aria-label="Buscar insumo"
        placeholder="Buscar insumo…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <ListState query={ingredients} what="los insumos" />
      {ingredients.data && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {search ? 'Ningún insumo coincide con la búsqueda.' : 'Todavía no hay insumos.'}
        </p>
      )}
      {visible.length > 0 && (
        <div className="relative overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Medida</th>
                <th className="px-3 py-2 font-medium">Recetas</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((ingredient) => (
                <IngredientRow
                  key={ingredient.id}
                  ingredient={ingredient}
                  recipes={usage.get(ingredient.id) ?? 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NewIngredient({ onDone }: { onDone: () => void }) {
  const create = useCreateIngredient();
  return (
    <IngredientForm
      label="Nuevo insumo"
      submitLabel="Crear insumo"
      defaultValues={{ name: '', unit: 'g' }}
      onCancel={onDone}
      onSubmit={async (values) => {
        await create.mutateAsync(values);
        onDone();
      }}
    />
  );
}

function IngredientRow({ ingredient, recipes }: { ingredient: Ingredient; recipes: number }) {
  const update = useUpdateIngredient();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-t">
        <td colSpan={5} className="p-2">
          <IngredientForm
            label={`Editar ${ingredient.name}`}
            submitLabel="Guardar"
            defaultValues={{ name: ingredient.name, unit: ingredient.unit }}
            unitLockedReason={
              recipes > 0
                ? `No se puede cambiar: está en ${recipes} ${recipes === 1 ? 'receta' : 'recetas'}`
                : undefined
            }
            onCancel={() => setEditing(false)}
            onSubmit={async ({ name, unit }) => {
              const changes = unit === ingredient.unit ? { name } : { name, unit };
              await update.mutateAsync({ id: ingredient.id, changes });
              setEditing(false);
            }}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-medium">{ingredient.name}</td>
      <td className="px-3 py-2">{UNIT_LABELS[ingredient.unit]}</td>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{recipes}</td>
      <td className="px-3 py-2">
        <StatusBadge active={ingredient.isActive} />
      </td>
      <td className="flex justify-end gap-2 px-3 py-2">
        <Button
          size="sm"
          variant="outline"
          aria-label={`Editar ${ingredient.name}`}
          onClick={() => setEditing(true)}
        >
          Editar
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={`${ingredient.isActive ? 'Desactivar' : 'Activar'} ${ingredient.name}`}
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { id: ingredient.id, changes: { isActive: !ingredient.isActive } },
              { onError: notifyCatalogError },
            )
          }
        >
          {ingredient.isActive ? 'Desactivar' : 'Activar'}
        </Button>
      </td>
    </tr>
  );
}

function IngredientForm({
  label,
  submitLabel,
  defaultValues,
  unitLockedReason,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  defaultValues: { name: string; unit: Ingredient['unit'] };
  /** Si existe, la unidad no se puede cambiar y se explica por qué. */
  unitLockedReason?: string;
  onSubmit: (values: CreateIngredient) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<CreateIngredientInput, unknown, CreateIngredient>({
    resolver: zodResolver(createIngredientSchema),
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
      className="flex flex-wrap items-start gap-3 rounded-md border-l-4 border-primary bg-secondary/60 p-4"
    >
      <Field data-invalid={!!errors.name} className="min-w-48 flex-1">
        <FieldLabel htmlFor={id('name')}>Nombre</FieldLabel>
        <Input id={id('name')} aria-invalid={!!errors.name} {...form.register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.unit} className="w-48">
        <FieldLabel htmlFor={id('unit')}>Medida</FieldLabel>
        {unitLockedReason ? (
          // React Hook Form descarta los campos deshabilitados: la unidad viaja oculta.
          <>
            <select
              id={id('unit')}
              className={`${selectClassName} w-full`}
              disabled
              value={defaultValues.unit}
            >
              <option value={defaultValues.unit}>{UNIT_LABELS[defaultValues.unit]}</option>
            </select>
            <input type="hidden" {...form.register('unit')} />
          </>
        ) : (
          <select
            id={id('unit')}
            className={`${selectClassName} w-full`}
            {...form.register('unit')}
          >
            {INGREDIENT_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
        )}
        {unitLockedReason && <FieldDescription>{unitLockedReason}</FieldDescription>}
        <FieldError errors={[errors.unit]} />
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
