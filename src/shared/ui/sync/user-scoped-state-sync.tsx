'use client';

import { useEffect, useRef } from 'react';
import { useTestAuthStore } from '@/features/test-module/store';
import { resetAndRehydrateUserScopedStores } from '@/shared/lib/user-scoped-store-sync';

export function UserScopedStateSync() {
    const storageScopeId = useTestAuthStore((state) => state.user?.id ?? 'guest');
    const previousScopeIdRef = useRef(storageScopeId);

    useEffect(() => {
        if (previousScopeIdRef.current === storageScopeId) {
            return;
        }

        previousScopeIdRef.current = storageScopeId;
        void resetAndRehydrateUserScopedStores();
    }, [storageScopeId]);

    return null;
}