import { formatMoneyInput } from '@tus-antojos/shared';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { useCategories, useProducts } from '@/features/catalog/api';
import { usePromotion, useUpdatePromotion } from './api';
import { toBoliviaDatetimeLocal } from './format';
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

export function PromotionEditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const promotionQuery = usePromotion(id);
  const categories = useCategories();
  const products = useProducts();
  const updatePromo = useUpdatePromotion();

  const promo = promotionQuery.data;
  const isLoading = promotionQuery.isLoading || categories.isLoading || products.isLoading;
  const isError = promotionQuery.isError || categories.isError || products.isError;

  return (
    <section className="flex flex-col gap-6">
      <BackLink />
      <PageHeader
        eyebrow="Administración"
        title="Editar promoción"
        description="Modifica los datos, descuento, vigencia y productos de la promoción."
      />

      {isLoading && <p className="text-sm text-muted-foreground">Cargando promoción…</p>}
      {isError && <p className="text-sm text-destructive">Error al cargar la información.</p>}
      {!isLoading && !promo && (
        <p className="text-sm text-muted-foreground">La promoción no existe o fue eliminada.</p>
      )}

      {promo && categories.data && products.data && (
        <PromotionForm
          isEdit
          promotionId={promo.id}
          categories={categories.data}
          products={products.data}
          defaultValues={{
            name: promo.name,
            kind: promo.kind,
            value:
              promo.kind === 'porcentaje' ? String(promo.value) : formatMoneyInput(promo.value),
            startsAt: toBoliviaDatetimeLocal(promo.startsAt),
            endsAt: promo.endsAt ? toBoliviaDatetimeLocal(promo.endsAt) : '',
            productIds: promo.productIds,
            isActive: promo.isActive,
          }}
          submitLabel="Guardar cambios"
          onSubmit={async (data) => {
            await updatePromo.mutateAsync({
              id: promo.id,
              changes: data,
            });
            toast.success('Promoción actualizada');
            await navigate(LIST_PATH);
          }}
          onCancel={() => navigate(LIST_PATH)}
        />
      )}
    </section>
  );
}
