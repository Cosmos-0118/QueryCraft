import { useAlgebraStore } from '@/features/algebra/store';
import { useERStore } from '@/features/er-builder/store';
import { useGeneratorStore } from '@/features/generator/store';
import { useNormalizerStore } from '@/features/normalizer/store';
import { useSandboxStore } from '@/features/sandbox/store';
import { useTrcStore } from '@/features/tuple-calculus/store';
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
  await resetAndRehydrateStore(useGeneratorStore);
  await resetAndRehydrateStore(useERStore);
  await resetAndRehydrateStore(useNormalizerStore);
}