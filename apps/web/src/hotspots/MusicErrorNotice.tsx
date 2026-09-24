/** Extracts a readable message from a failed request — the api client throws
 * Error objects carrying the backend's real error text (see api/client.ts's
 * request()), so this is usually the actual HA/Music Assistant failure reason
 * rather than a generic "something went wrong". */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-center text-sm text-red-300">
      {message}
    </div>
  );
}
