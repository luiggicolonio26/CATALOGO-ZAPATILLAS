import { getCatalog, persistenceMode } from '@/lib/store';
import CatalogApp from '@/components/CatalogApp';
import type { Zapatilla } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let initialItems: Zapatilla[] = [];
  let initialError: string | null = null;

  try {
    initialItems = await getCatalog();
  } catch (err) {
    console.error(err);
    initialError = 'No se pudo cargar el catálogo. Revisá la configuración de almacenamiento.';
  }

  return (
    <CatalogApp
      initialItems={initialItems}
      initialError={initialError}
      persistenceMode={persistenceMode()}
    />
  );
}
