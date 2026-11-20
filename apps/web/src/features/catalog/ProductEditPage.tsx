import {
  formatMoneyInput,
  toDisplayQuantity,
  type Category,
  type Ingredient,
  type Product,
  type RecipeItem,
  type UpdateProduct,
} from '@tus-antojos/shared';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { CatalogNav } from './CatalogNav';
import {
  useCategories,
  useCreateProduct,
  useIngredients,
  useProducts,
  useSetProductRecipe,
  useUpdateProduct,
} from './api';
import { ListState, StatusBadge } from './common';
import { ProductImageField } from './ProductImageField';
import { ProductForm, type ProductFormValues, type RecipeRowInput } from './ProductForm';

const LIST_PATH = '/admin/productos';

function BackLink() {
  return (
    <Link to={LIST_PATH} className="text-sm text-muted-foreground hover:underline">
      ← Productos
    </Link>
  );
}

/** /admin/productos/nuevo — datos, receta y estado se crean en una sola transacción. */
export function NewProductPage() {
  const categories = useCategories();
  const ingredients = useIngredients();
  const create = useCreateProduct();
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-4">
      <CatalogNav />
      <BackLink />
      <h1 className="text-2xl font-semibold">Nuevo producto</h1>
      <p className="text-sm text-muted-foreground">La foto se agrega después de crearlo.</p>
      <ListState query={categories} what="las categorías" />
      <ListState query={ingredients} what="los insumos" />
      {categories.data && ingredients.data && (
        <ProductForm
          categories={categories.data}
          ingredients={ingredients.data}
          defaultValues={{
            name: '',
            description: '',
            categoryId: '',
            price: '',
            isActive: false,
            recipe: [],
          }}
          submitLabel="Crear producto"
          onSubmit={async ({ price, ...values }) => {
            const product = await create.mutateAsync({ ...values, priceCents: price });
            await navigate(`${LIST_PATH}/${product.id}`);
          }}
        />
      )}
    </section>
  );
}

/** /admin/productos/:id */
export function ProductEditPage() {
  const { id } = useParams();
  const products = useProducts();
  const categories = useCategories();
  const ingredients = useIngredients();
  const product = products.data?.find((p) => p.id === id);

  return (
    <section className="flex flex-col gap-4">
      <CatalogNav />
      <BackLink />
      <ListState query={products} what="el producto" />
      <ListState query={categories} what="las categorías" />
      <ListState query={ingredients} what="los insumos" />
      {products.data && !product && (
        <p className="text-sm text-muted-foreground">El producto no existe o fue eliminado.</p>
      )}
      {product && categories.data && ingredients.data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <StatusBadge active={product.isActive} />
          </div>
          <ProductImageField product={product} />
          <EditProductForm
            // Al cambiar de producto se reinicia el formulario.
            key={product.id}
            product={product}
            categories={categories.data}
            ingredients={ingredients.data}
          />
        </>
      )}
    </section>
  );
}

function EditProductForm({
  product,
  categories,
  ingredients,
}: {
  product: Product;
  categories: Category[];
  ingredients: Ingredient[];
}) {
  const update = useUpdateProduct();
  const setRecipe = useSetProductRecipe();

  return (
    <ProductForm
      categories={categories}
      ingredients={ingredients}
      defaultValues={{
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        price: formatMoneyInput(product.priceCents),
        isActive: product.isActive,
        recipe: product.recipe.map((item) => toRecipeRow(item, ingredients)),
      }}
      submitLabel="Guardar cambios"
      onSubmit={async (values) => {
        const changes = changedFields(product, values);
        const hasChanges = Object.keys(changes).length > 0;
        const recipeChanged = !sameRecipe(product.recipe, values.recipe);
        if (!hasChanges && !recipeChanged) return;

        // Activar exige la receta nueva ya guardada; desactivar va antes de vaciarla.
        const saveRecipe = () => setRecipe.mutateAsync({ id: product.id, items: values.recipe });
        const activating = changes.isActive === true;
        if (recipeChanged && activating) await saveRecipe();
        if (hasChanges) await update.mutateAsync({ id: product.id, changes });
        if (recipeChanged && !activating) await saveRecipe();
        toast.success('Producto guardado');
      }}
    />
  );
}

/** 1500 g → { quantity: "1,5", unit: "kg" }. */
function toRecipeRow(item: RecipeItem, ingredients: Ingredient[]): RecipeRowInput {
  const unit = ingredients.find((i) => i.id === item.ingredientId)?.unit ?? 'unidad';
  const display = toDisplayQuantity(item.quantity, unit);
  return { ingredientId: item.ingredientId, quantity: display.text, unit: display.unit };
}

/** Solo lo que cambió: el PATCH exige al menos un campo y no pisa lo demás. */
function changedFields(product: Product, values: ProductFormValues): UpdateProduct {
  const changes: UpdateProduct = {};
  if (values.name !== product.name) changes.name = values.name;
  if (values.description !== product.description) changes.description = values.description;
  if (values.categoryId !== product.categoryId) changes.categoryId = values.categoryId;
  if (values.price !== product.priceCents) changes.priceCents = values.price;
  if (values.isActive !== product.isActive) changes.isActive = values.isActive;
  return changes;
}

/** Misma receta sin importar el orden de las filas. */
function sameRecipe(a: RecipeItem[], b: RecipeItem[]): boolean {
  const key = (items: RecipeItem[]) =>
    items
      .map((i) => `${i.ingredientId}:${i.quantity}`)
      .sort()
      .join('|');
  return key(a) === key(b);
}
