import { useAlgebraStore } from '@/stores/algebra-store';
import { useERStore } from '@/stores/er-store';
import { useGeneratorStore } from '@/stores/generator-store';
import { useNormalizerStore } from '@/stores/normalizer-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useTrcStore } from '@/stores/trc-store';
import type { StoreApi } from 'zustand';

type ResettableUserScopedStore<TState> = {
  getInitialState: () => TState;
  setState: StoreApi<TState>['setState'];
  persist?: {
    rehydrate: () => Promise<void> | void;
  };
};

async function resetAndRehydrateStore<TState>(store: ResettableUserScopedStore<TState>): Promise<void> {
  store.setState(store.getInitialState(), true);
  await store.persist?.rehydrate();
}

export async function resetAndRehydrateUserScopedStores(): Promise<void> {
  await resetAndRehydrateStore(useSandboxStore);
  await resetAndRehydrateStore(useAlgebraStore);
  await resetAndRehydrateStore(useTrcStore);
  await resetAndRehydrateStore(useNormalizerStore);
  await resetAndRehydrateStore(useGeneratorStore);
  await resetAndRehydrateStore(useERStore);
}