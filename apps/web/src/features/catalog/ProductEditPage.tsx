import {
  formatMoneyInput,
  type Category,
  type Product,
  type UpdateProduct,
} from '@tus-antojos/shared';
import { Link, useNavigate, useParams } from 'react-router';
import { CatalogNav } from './CatalogNav';
import { useCategories, useCreateProduct, useProducts, useUpdateProduct } from './api';
import { ListState, StatusBadge } from './common';
import { ProductForm, type ProductFormValues } from './ProductForm';

const LIST_PATH = '/admin/productos';

function BackLink() {
  return (
    <Link to={LIST_PATH} className="text-sm text-muted-foreground hover:underline">
      ← Productos
    </Link>
  );
}

/** /admin/productos/nuevo — el producto nace inactivo; tras crearlo se sigue en su edición. */
export function NewProductPage() {
  const categories = useCategories();
  const create = useCreateProduct();
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-4">
      <CatalogNav />
      <BackLink />
      <h1 className="text-2xl font-semibold">Nuevo producto</h1>
      <ListState query={categories} what="las categorías" />
      {categories.data && (
        <ProductForm
          categories={categories.data}
          defaultValues={{ name: '', description: '', categoryId: '', price: '' }}
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
  const product = products.data?.find((p) => p.id === id);

  return (
    <section className="flex flex-col gap-4">
      <CatalogNav />
      <BackLink />
      <ListState query={products} what="el producto" />
      <ListState query={categories} what="las categorías" />
      {products.data && !product && (
        <p className="text-sm text-muted-foreground">El producto no existe o fue eliminado.</p>
      )}
      {product && categories.data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <StatusBadge active={product.isActive} />
          </div>
          <EditProductForm
            // Al cambiar de producto se reinicia el formulario.
            key={product.id}
            product={product}
            categories={categories.data}
          />
        </>
      )}
    </section>
  );
}

function EditProductForm({ product, categories }: { product: Product; categories: Category[] }) {
  const update = useUpdateProduct();
  return (
    <ProductForm
      categories={categories}
      defaultValues={{
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        price: formatMoneyInput(product.priceCents),
      }}
      submitLabel="Guardar cambios"
      onSubmit={async (values) => {
        const changes = changedFields(product, values);
        if (Object.keys(changes).length === 0) return;
        await update.mutateAsync({ id: product.id, changes });
      }}
    />
  );
}

/** Solo lo que cambió: el PATCH exige al menos un campo y no pisa lo demás. */
function changedFields(product: Product, values: ProductFormValues): UpdateProduct {
  const changes: UpdateProduct = {};
  if (values.name !== product.name) changes.name = values.name;
  if (values.description !== product.description) changes.description = values.description;
  if (values.categoryId !== product.categoryId) changes.categoryId = values.categoryId;
  if (values.price !== product.priceCents) changes.priceCents = values.price;
  return changes;
}
