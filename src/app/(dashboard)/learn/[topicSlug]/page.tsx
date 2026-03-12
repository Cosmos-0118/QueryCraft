'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTopic } from '@/lib/lessons/content';
import {
  ArrowLeft, BookOpen, ChevronRight, Clock, PlayCircle,
} from 'lucide-react';

export default function TopicPage({ params }: { params: Promise<{ topicSlug: string }> }) {
  const { topicSlug } = use(params);
  const topic = getTopic(topicSlug);
  const router = useRouter();

  if (!topic) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-zinc-200">Topic Not Found</h2>
          <p className="mt-2 text-sm text-zinc-500">The topic you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/learn" className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300">
            ← Back to Learn
          </Link>
        </div>
      </div>
    );
  }

  const totalMinutes = topic.lessons.reduce((s, l) => s + l.estimatedMinutes, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Back + Header */}
      <button
        onClick={() => router.push('/learn')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft size={14} /> Back to Learn
      </button>

      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-800/80 to-zinc-900 p-8">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <span>Unit {topic.unitNumber}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-zinc-100">{topic.title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{topic.description}</p>
        <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <BookOpen size={12} /> {topic.lessons.length} lessons
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} /> ~{totalMinutes} min total
          </span>
        </div>
      </div>

      {/* Lesson List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Lessons</h2>
        {topic.lessons.map((lesson, index) => (
          <Link
            key={lesson.slug}
            href={`/learn/${topicSlug}/${lesson.slug}`}
            className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold text-zinc-400 group-hover:bg-blue-500/10 group-hover:text-blue-400">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-zinc-200 group-hover:text-white">{lesson.title}</h3>
              <p className="mt-0.5 truncate text-sm text-zinc-500">{lesson.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1 text-xs text-zinc-600 sm:flex">
                <Clock size={10} /> {lesson.estimatedMinutes} min
              </span>
              <span className="hidden items-center gap-1 text-xs text-zinc-600 sm:flex">
                {lesson.stepCount} steps
              </span>
              <div className="flex items-center gap-1 text-zinc-600 group-hover:text-blue-400">
                <PlayCircle size={18} />
                <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
