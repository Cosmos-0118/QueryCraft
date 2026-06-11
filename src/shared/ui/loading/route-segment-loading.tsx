'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/shared/ui/loading/store';

interface RouteSegmentLoadingProps {
    message?: string;
}

export function RouteSegmentLoading({
    message = 'Loading…',
}: RouteSegmentLoadingProps) {
    const { start, stop } = useLoadingStore();

    useEffect(() => {
        start(message);
        return () => stop();
    }, [message, start, stop]);

    return null;
}
