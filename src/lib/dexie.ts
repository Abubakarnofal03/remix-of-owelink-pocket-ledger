import DexieRuntime from "dexie/dist/dexie.mjs";

export type Table<T = unknown, TKey = unknown, TInsertType = T> = any;

interface DexieLikeInstance {
  version(versionNumber: number): { stores: (schema: Record<string, string>) => unknown };
  on(eventName: string, callback: () => void): void;
  open(): Promise<unknown>;
  close(): void;
  [key: string]: any;
}

interface DexieLikeConstructor {
  new (name: string): DexieLikeInstance;
}

const Dexie = DexieRuntime as unknown as DexieLikeConstructor;

export default Dexie;
