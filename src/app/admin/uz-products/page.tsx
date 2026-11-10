import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/require-auth';
import { UzProductCatalog } from '@/components/uz-product-catalog';

export default async function UzProductsPage() {
  const auth = await requireAdmin();
  if (auth.error) redirect('/admin');

  return <UzProductCatalog />;
}
