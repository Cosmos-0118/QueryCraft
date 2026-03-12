export default function ExercisePage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  return (
    <div>
      <h1 className="text-3xl font-bold">Exercise</h1>
      <p className="mt-2 text-muted-foreground">Exercise workspace will render here.</p>
    </div>
  );
}
