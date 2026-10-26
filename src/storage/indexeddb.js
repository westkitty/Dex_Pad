/** Durable local development storage. Plaintext! Not a production vault. */
const DB_VERSION = 1;
const COPY = (value) => structuredClone(value);

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(COPY(request.result));
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}
function open(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of ['items', 'revisions', 'events']) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: store === 'items' ? 'id' : store === 'revisions' ? 'revisionId' : 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open local storage'));
    request.onblocked = () => reject(new Error('Storage upgrade blocked by another tab'));
  });
}
export async function openIndexedDbStore(name = 'dex-pad-development-v1') {
  if (!globalThis.indexedDB) throw new Error('IndexedDB unavailable: data cannot be saved');
  const db = await open(name);
  async function get(storeName, key) {
    return requestResult(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
  }
  async function all(storeName) {
    return requestResult(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
  }
  return {
    async getItem(id) { return (await get('items', id)) ?? null; },
    async listItems() { return all('items'); },
    async listRevisions(id) {
      const records = await all('revisions');
      return records.filter(record => record.itemId === id).map(record => record.item).sort((a, b) => a.revision - b.revision);
    },
    async listEvents() { return all('events'); },
    async commit(item, event) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['items', 'revisions', 'events'], 'readwrite');
        let commitError = null;
        const objectStore = tx.objectStore('items');
        const read = objectStore.get(item.id);
        read.onsuccess = () => {
          const previous = read.result;
          if ((item.revision === 1 && previous) || (item.revision !== 1 && previous?.revision !== item.revision - 1)) {
            commitError = new Error('Stale revision or duplicate item');
            tx.abort();
            return;
          }
          objectStore.put(COPY(item));
          tx.objectStore('revisions').put({ revisionId: `${item.id}:${item.revision}`, itemId: item.id, item: COPY(item) });
          tx.objectStore('events').put(COPY(event));
        };
        read.onerror = () => { commitError = read.error; };
        tx.oncomplete = () => resolve(COPY(item));
        tx.onabort = () => reject(commitError || tx.error || new Error('Local storage transaction aborted'));
        tx.onerror = () => { commitError ||= tx.error; };
      });
    },
    close() { db.close(); },
  };
}
