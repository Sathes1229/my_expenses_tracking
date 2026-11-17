import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/empty-state';
import { getMessages } from '@/i18n/server';

/** Also what a guest gets for someone else's transaction: the page cannot tell them it exists. */
export default async function TransactionNotFound() {
  const t = (await getMessages()).transactions;
  return (
    <div className="max-w-3xl">
      <EmptyState title={t.notFoundTitle} action={<ButtonLink href="/transactions">{t.backToList}</ButtonLink>}>
        {t.notFoundBody}
      </EmptyState>
    </div>
  );
}
