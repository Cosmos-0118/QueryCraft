import type { Lesson, LessonMeta, Topic, Unit } from '@/types/lesson';
import { unit1Lessons } from './unit1';
import { unit2Lessons } from './unit2';
import { unit3Lessons } from './unit3';
import { unit4Lessons } from './unit4';
import { unit5Lessons } from './unit5';

const allLessons: Record<string, Lesson[]> = {
  'database-fundamentals': unit1Lessons,
  'relational-model': unit2Lessons,
  sql: unit3Lessons,
  normalization: unit4Lessons,
  'transactions-advanced': unit5Lessons,
};

export const units: Unit[] = [
  {
    number: 1,
    title: 'Database Fundamentals',
    description: 'Core concepts: data models, architecture, and ER diagrams.',
    color: 'blue',
    topics: [
      {
        slug: 'database-fundamentals',
        title: 'Database Fundamentals',
        description: 'Introduction to databases, data models, DBMS architecture, and ER diagrams.',
        unitNumber: 1,
        icon: 'Database',
        lessons: unit1Lessons.map((l) => ({
          slug: l.slug,
          title: l.title,
          description: l.description,
          topicSlug: 'database-fundamentals',
          stepCount: l.steps.length,
          estimatedMinutes: Math.max(3, l.steps.length * 2),
        })),
      },
    ],
  },
  {
    number: 2,
    title: 'Relational Model & Algebra',
    description: 'ER-to-relational mapping, relational algebra, and calculus.',
    color: 'violet',
    topics: [
      {
        slug: 'relational-model',
        title: 'Relational Model & Algebra',
        description: 'ER-to-relational conversion, algebra operations, and relational calculus.',
        unitNumber: 2,
        icon: 'Sigma',
        lessons: unit2Lessons.map((l) => ({
          slug: l.slug,
          title: l.title,
          description: l.description,
          topicSlug: 'relational-model',
          stepCount: l.steps.length,
          estimatedMinutes: Math.max(3, l.steps.length * 2),
        })),
      },
    ],
  },
  {
    number: 3,
    title: 'SQL',
    description: 'DDL, DML, queries, joins, subqueries, procedures, and triggers.',
    color: 'emerald',
    topics: [
      {
        slug: 'sql',
        title: 'SQL',
        description: 'Complete SQL coverage from DDL to triggers and stored procedures.',
        unitNumber: 3,
        icon: 'Terminal',
        lessons: unit3Lessons.map((l) => ({
          slug: l.slug,
          title: l.title,
          description: l.description,
          topicSlug: 'sql',
          stepCount: l.steps.length,
          estimatedMinutes: Math.max(3, l.steps.length * 2),
        })),
      },
    ],
  },
  {
    number: 4,
    title: 'Normalization',
    description: 'Functional dependencies, normal forms 1NF through 5NF.',
    color: 'amber',
    topics: [
      {
        slug: 'normalization',
        title: 'Normalization',
        description: 'Why normalize, 1NF, 2NF, 3NF, BCNF, and higher normal forms.',
        unitNumber: 4,
        icon: 'RefreshCw',
        lessons: unit4Lessons.map((l) => ({
          slug: l.slug,
          title: l.title,
          description: l.description,
          topicSlug: 'normalization',
          stepCount: l.steps.length,
          estimatedMinutes: Math.max(3, l.steps.length * 2),
        })),
      },
    ],
  },
  {
    number: 5,
    title: 'Transactions & Advanced',
    description: 'ACID properties, concurrency control, and NoSQL.',
    color: 'rose',
    topics: [
      {
        slug: 'transactions-advanced',
        title: 'Transactions & Advanced Topics',
        description: 'Transactions, concurrency control, and NoSQL databases.',
        unitNumber: 5,
        icon: 'Shield',
        lessons: unit5Lessons.map((l) => ({
          slug: l.slug,
          title: l.title,
          description: l.description,
          topicSlug: 'transactions-advanced',
          stepCount: l.steps.length,
          estimatedMinutes: Math.max(3, l.steps.length * 2),
        })),
      },
    ],
  },
];

export const lessonRegistry: LessonMeta[] = units.flatMap((u) =>
  u.topics.flatMap((t) => t.lessons),
);

export function getLessonsByTopic(topicSlug: string): Lesson[] {
  return allLessons[topicSlug] ?? [];
}

export function getLesson(topicSlug: string, lessonSlug: string): Lesson | undefined {
  return getLessonsByTopic(topicSlug).find((l) => l.slug === lessonSlug);
}

export function getTopic(topicSlug: string): Topic | undefined {
  return units.flatMap((u) => u.topics).find((t) => t.slug === topicSlug);
}

export function getUnit(unitNumber: number): Unit | undefined {
  return units.find((u) => u.number === unitNumber);
}
