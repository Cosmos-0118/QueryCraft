export default function NormalizerLoading() {
    return (
        <div className="flex h-full flex-col gap-3 p-4 lg:p-6">
            <div className="h-20 animate-pulse rounded-2xl border border-border bg-card/50" />
            <div className="h-28 animate-pulse rounded-2xl border border-border bg-card/40" />
            <div className="min-h-[460px] flex-1 animate-pulse rounded-2xl border border-border bg-card/35" />
            <div className="h-36 animate-pulse rounded-2xl border border-border bg-card/45" />
        </div>
    );
}
