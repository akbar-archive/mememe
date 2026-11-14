/**
 * Runs `attempt` up to twice. An attempt fails by throwing or returning null.
 * Returns null after the second failure so the caller can skip that item.
 */
export async function retryOnce<T>(label: string, attempt: () => Promise<T | null>): Promise<T | null> {
  for (let tryNumber = 1; tryNumber <= 2; tryNumber++) {
    try {
      const result = await attempt();
      if (result !== null) return result;
      console.warn(`${label}: invalid response (try ${tryNumber})`);
    } catch (err) {
      console.warn(`${label}: ${String(err)} (try ${tryNumber})`);
    }
  }
  return null;
}
