'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { resetAndRehydrateUserScopedStores } from '@/lib/utils/user-scoped-store-sync';

export function UserScopedStateSync() {
    const storageScopeId = useAuthStore((state) => state.user?.id ?? 'guest');
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