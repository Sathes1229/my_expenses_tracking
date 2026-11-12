/** What anyone but the owner gets. Worded like Next's own 404, so it says nothing about debts. */
export default function DebtsNotFound() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-ink">404</h1>
      <p className="mt-2 text-muted">This page could not be found.</p>
    </div>
  );
}
