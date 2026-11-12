import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/empty-state';

/** Also what a guest gets for someone else's transaction: the page cannot tell them it exists. */
export default function TransactionNotFound() {
  return (
    <div className="max-w-3xl">
      <EmptyState
        title="That transaction is not available"
        action={<ButtonLink href="/transactions">Back to transactions</ButtonLink>}
      >
        It may have been deleted, or you may not have access to it.
      </EmptyState>
    </div>
  );
}
