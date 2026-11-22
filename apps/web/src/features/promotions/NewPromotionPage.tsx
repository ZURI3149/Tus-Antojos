import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { useCategories, useProducts } from '@/features/catalog/api';
import { useCreatePromotion } from './api';
import { PromotionForm } from './PromotionForm';

const LIST_PATH = '/admin/promociones';

function BackLink() {
  return (
    <Link
      to={LIST_PATH}
      className="w-fit font-heading text-xs tracking-wider text-muted-foreground uppercase hover:text-primary"
    >
      ← Promociones
    </Link>
  );
}

export function NewPromotionPage() {
  const navigate = useNavigate();
  const categories = useCategories();
  const products = useProducts();
  const createPromo = useCreatePromotion();

  const isLoading = categories.isLoading || products.isLoading;
  const isError = categories.isError || products.isError;

  return (
    <section className="flex flex-col gap-6">
      <BackLink />
      <PageHeader
        eyebrow="Administración"
        title="Nueva promoción"
        description="Descuento en porcentaje o monto fijo con vigencia para uno o varios productos."
      />

      {isLoading && <p className="text-sm text-muted-foreground">Cargando catálogo…</p>}
      {isError && (
        <p className="text-sm text-destructive">Error al cargar productos y categorías.</p>
      )}

      {categories.data && products.data && (
        <PromotionForm
          categories={categories.data}
          products={products.data}
          onSubmit={async (data) => {
            await createPromo.mutateAsync(data);
            toast.success('Promoción creada');
            await navigate(LIST_PATH);
          }}
          onCancel={() => navigate(LIST_PATH)}
        />
      )}
    </section>
  );
}
