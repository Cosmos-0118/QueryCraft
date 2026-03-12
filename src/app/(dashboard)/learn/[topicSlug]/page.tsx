export default function TopicPage({ params }: { params: Promise<{ topicSlug: string }> }) {
  return (
    <div>
      <h1 className="text-3xl font-bold">Topic Lessons</h1>
      <p className="mt-2 text-muted-foreground">Lessons for this topic will load here.</p>
    </div>
  );
}
