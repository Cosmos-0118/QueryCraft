export default function LessonPage({
  params,
}: {
  params: Promise<{ topicSlug: string; lessonSlug: string }>;
}) {
  return (
    <div>
      <h1 className="text-3xl font-bold">Lesson Player</h1>
      <p className="mt-2 text-muted-foreground">
        The interactive lesson player will be rendered here.
      </p>
    </div>
  );
}
