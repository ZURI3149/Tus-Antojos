import { ChefHat } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/page-header';

// Pantalla provisional (módulo platform). Se construye en su propio módulo.
export function KitchenPage() {
  return (
    <section className="flex flex-col gap-8">
      <PageHeader eyebrow="Preparación" title="Cocina" />
      <ComingSoon icon={ChefHat} title="Los pedidos llegarán aquí al instante">
        En construcción. Aquí irá la cola de pedidos en tiempo real.
      </ComingSoon>
    </section>
  );
}
