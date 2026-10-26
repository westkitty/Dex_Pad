/** Test/development adapter with the same revision contract as IndexedDB. */
export function createMemoryStore() {
  const items = new Map();
  const revisions = new Map();
  const events = [];
  let injectedError = null;
  const clone = (value) => structuredClone(value);

  return {
    setCommitError(error) { injectedError = error; },
    async getItem(id) { return items.has(id) ? clone(items.get(id)) : null; },
    async listItems() { return [...items.values()].map(clone); },
    async listRevisions(id) { return clone(revisions.get(id) ?? []); },
    async listEvents() { return clone(events); },
    async commit(item, event) {
      if (injectedError) throw injectedError;
      const old = items.get(item.id);
      if ((item.revision === 1 && old) || (item.revision !== 1 && old?.revision !== item.revision - 1)) {
        throw new Error('Stale revision or duplicate item');
      }
      const prior = revisions.get(item.id) ?? [];
      items.set(item.id, clone(item));
      revisions.set(item.id, [...prior, clone(item)]);
      events.push(clone(event));
      return clone(item);
    },
    close() {},
  };
}
