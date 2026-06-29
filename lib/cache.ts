// Caché en memoria (por pestaña) para datos que se repiten al navegar entre
// páginas — p. ej. la lista de perfiles, que antes se recargaba entera cada vez
// que se abría un partido. Evita refetches y hace la navegación instantánea.
//
// No persiste entre recargas de la página (es solo para la sesión de navegación
// actual) y se invalida por TTL, así que los datos no se quedan obsoletos.

interface Entry {
  at: number;
  data: unknown;
  // Promesa en vuelo: comparte la misma petición si se pide varias veces a la vez.
  inflight?: Promise<unknown>;
}

const store = new Map<string, Entry>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit) {
    if (Date.now() - hit.at < ttlMs && hit.inflight == null) {
      return hit.data as T;
    }
    if (hit.inflight) return hit.inflight as Promise<T>;
  }
  const promise = loader()
    .then((data) => {
      store.set(key, { at: Date.now(), data });
      return data;
    })
    .catch((err) => {
      // Si falla, no dejamos una entrada a medias bloqueando futuros intentos.
      const cur = store.get(key);
      if (cur?.inflight) store.delete(key);
      throw err;
    });
  store.set(key, { at: hit?.at ?? 0, data: hit?.data, inflight: promise });
  return promise as Promise<T>;
}

export function invalidate(key: string) {
  store.delete(key);
}
