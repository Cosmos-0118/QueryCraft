'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CircuitBoard,
  GraduationCap,
  Github,
  Linkedin,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import TeamMemberImage from '@/components/our-team/TeamMemberImage';
import { preloadImages } from '@/lib/preload-images';
import { useLoadingStore } from '@/stores/loading-store';
import { useThemeStore } from '@/stores/theme-store';

const TileWaveCanvas = dynamic(() => import('@/components/visual/TileWaveCanvas'), { ssr: false });
const GlitterField = dynamic(() => import('@/components/visual/GlitterField'), { ssr: false });

type TeamMember = {
  name: string;
  role: string;
  tag: string;
  image?: string;
  github?: string;
  linkedin?: string;
};

const mentors: TeamMember[] = [
  { name: 'Mentor Name', role: 'Faculty Mentor', tag: 'Guidance' },
  { name: 'Mentor Name', role: 'Faculty Mentor', tag: 'Strategy' },
  { name: 'Mentor Name', role: 'Faculty Mentor', tag: 'Review' },
];

const developers: TeamMember[] = [
  {
    name: 'Dhanush',
    role: 'Developer',
    tag: 'Developer',
    image: '/team/dhanush.jpeg',
    github: 'https://github.com/Cosmos-0118',
    linkedin: 'https://www.linkedin.com/in/dhanushs-dev/',
  },
  {
    name: 'Priyan',
    role: 'Developer',
    tag: 'Developer',
    image: '/team/priyan.png',
    github: 'https://github.com/Skygazer1111',
    linkedin: 'https://www.linkedin.com/in/priyan-rajarajan-b8128b2a2',
  },
  {
    name: 'Sathappan PL',
    role: 'Developer',
    tag: 'Developer',
    image: '/team/sathappan.png',
    github: 'https://github.com/sathappan25',
    linkedin: 'http://linkedin.com/in/sathappan-palaniappan-6755a7330',
  },
  {
    name: 'Raghul S',
    role: 'Developer',
    tag: 'Developer',
    image: '/team/Raghul.png',
    github: 'https://github.com/Raghul-Saba',
    linkedin: 'https://www.linkedin.com/in/raghul-sabapathy-131681355',
  },
];

const TEAM_IMAGE_SOURCES = developers
  .map((member) => member.image)
  .filter((image): image is string => Boolean(image));

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

const shouldUseLiteMode = () => {
  if (typeof window === 'undefined') return false;

  const connection = (window.navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || (connection?.saveData ?? false);
};

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mb-3 flex w-fit items-center gap-3">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-primary/30" />
      <span className="rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-primary shadow-[0_0_30px_-16px_var(--primary)]">
        {children}
      </span>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-primary/30" />
    </div>
  );
}

const TeamCard = memo(function TeamCard({
  member,
  index,
  variant,
}: {
  member: TeamMember;
  index: number;
  variant: 'mentor' | 'developer';
}) {
  const isMentor = variant === 'mentor';

  if (!isMentor) {
    return (
      <motion.article
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.5, delay: index * 0.06, ease: 'easeOut' }}
        className="group relative h-[330px] overflow-hidden rounded-[1.65rem] border border-border/55 bg-card/70 shadow-[0_24px_70px_-48px_var(--shadow-color)] transition-transform duration-300 hover:-translate-y-2"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_12%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_34%),linear-gradient(180deg,color-mix(in_oklab,var(--surface-elevated)_72%,transparent),color-mix(in_oklab,var(--background)_88%,transparent))]" />
        {member.image ? (
          <TeamMemberImage
            src={member.image}
            alt={`${member.name} profile photo`}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            priority={index < 2}
            className="transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <UserRound size={58} strokeWidth={1.3} suppressHydrationWarning />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/22 to-transparent" />
        <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
          <div className="absolute inset-0 bg-gradient-to-t from-background/88 via-background/20 to-transparent" />
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <a
              href={member.github ?? '#'}
              aria-label={`${member.name} GitHub profile`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/75 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black"
            >
              <Github size={17} suppressHydrationWarning />
            </a>
            <a
              href={member.linkedin ?? '#'}
              aria-label={`${member.name} LinkedIn profile`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-300/20 bg-sky-600 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-sky-500"
            >
              <Linkedin size={16} suppressHydrationWarning />
            </a>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-lg font-black tracking-tight text-foreground drop-shadow-sm">{member.name}</h3>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{member.role}</p>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: 'easeOut' }}
      className="group relative h-[310px] overflow-hidden rounded-[1.65rem] border border-border/55 bg-card/70 shadow-[0_24px_70px_-48px_var(--shadow-color)] transition-transform duration-300 hover:-translate-y-2"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_12%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_32%),linear-gradient(180deg,color-mix(in_oklab,var(--surface-elevated)_72%,transparent),color-mix(in_oklab,var(--background)_88%,transparent))]" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/72 to-transparent" />
      <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
        <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-16 left-4 h-36 w-36 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-border/50 bg-background/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {member.tag}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <GraduationCap size={15} suppressHydrationWarning />
          </span>
        </div>

        <div className="group/photo relative mx-auto mt-4 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/35 text-muted-foreground shadow-[0_18px_50px_-28px_var(--shadow-color)] transition group-hover:border-primary/40 group-hover:text-primary sm:h-32 sm:w-32">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,color-mix(in_oklab,var(--foreground)_16%,transparent),transparent_42%),linear-gradient(180deg,color-mix(in_oklab,var(--surface-elevated)_88%,transparent),color-mix(in_oklab,var(--background)_92%,transparent))]" />
          {member.image ? (
            <TeamMemberImage
              src={member.image}
              alt={`${member.name} profile photo`}
              sizes="128px"
              className="transition duration-500 group-hover/photo:scale-105"
            />
          ) : (
            <UserRound size={42} className="relative" strokeWidth={1.4} suppressHydrationWarning />
          )}
        </div>

        <div className="relative">
          <div className="absolute -inset-x-4 -top-10 h-20 bg-gradient-to-t from-background/95 to-transparent" />
          <div className="relative">
            <h3 className="text-lg font-black tracking-tight text-foreground">{member.name}</h3>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{member.role}</p>
          </div>
        </div>
      </div>
    </motion.article>
  );
});

export default function OurTeamPage() {
  const { theme } = useThemeStore();
  const start = useLoadingStore((state) => state.start);
  const setProgress = useLoadingStore((state) => state.setProgress);
  const setMessage = useLoadingStore((state) => state.setMessage);
  const stop = useLoadingStore((state) => state.stop);
  const [isReady, setIsReady] = useState(false);

  const liteMode = useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleChange = () => onStoreChange();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    },
    shouldUseLiteMode,
    () => false,
  );

  useEffect(() => {
    let cancelled = false;

    const preparePage = async () => {
      start('Loading team…');

      await preloadImages(TEAM_IMAGE_SOURCES, (loaded, total) => {
        if (cancelled) return;
        const progress = total === 0 ? 100 : Math.round((loaded / total) * 100);
        setProgress(progress);
        if (loaded === total) {
          setMessage('Almost ready…');
        }
      });

      if (cancelled) return;

      await new Promise((resolve) => window.setTimeout(resolve, 220));
      if (cancelled) return;

      setIsReady(true);
      stop();
    };

    void preparePage();

    return () => {
      cancelled = true;
    };
  }, [start, setProgress, setMessage, stop]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {isReady && !liteMode && <TileWaveCanvas theme={theme} />}

      <div className="pointer-events-none fixed inset-0 z-[1]">
        <div className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,transparent_0%,color-mix(in_oklab,var(--background)_18%,transparent)_32%,var(--background)_94%)]" />
      </div>

      {isReady && !liteMode && <GlitterField />}

      <header className="sticky top-0 z-30 border-b border-border/25 bg-background/62 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="qc-brand-mark flex h-7 w-7 items-center justify-center rounded-lg">
              <CircuitBoard size={13} suppressHydrationWarning />
            </span>
            <span className="text-sm font-bold tracking-tight text-foreground">
              Query<span className="text-primary">Craft</span>
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft size={12} suppressHydrationWarning />
            Home
          </Link>
        </div>
      </header>

      <motion.main
        className="relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: isReady ? 1 : 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <section className="mx-auto flex min-h-[72svh] w-full max-w-[1200px] flex-col items-center justify-center px-6 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={isReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_50px_-24px_var(--primary)]">
              <UsersRound size={24} suppressHydrationWarning />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Our Team</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[1.02] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-7xl">
              The people behind <span className="text-primary">QueryCraft</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Meet the mentors and student builders shaping QueryCraft into a focused learning studio.
            </p>
          </motion.div>

          <motion.div
            className="mt-12 flex items-center gap-2 rounded-full border border-border/50 bg-card/55 px-4 py-2 text-xs font-semibold text-muted-foreground backdrop-blur-md"
            initial={{ opacity: 0, y: 16 }}
            animate={isReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.5, delay: 0.18 }}
          >
            <Sparkles size={13} className="text-primary" suppressHydrationWarning />
            Scroll to meet the team
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-[980px] px-6 pb-24">
          <SectionBadge>Mentors</SectionBadge>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mx-auto mb-10 max-w-xl text-center text-sm text-muted-foreground"
          >
            Faculty guidance and strategic direction for the project.
          </motion.p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {mentors.map((member, index) => (
              <TeamCard key={`${member.role}-${index}`} member={member} index={index} variant="mentor" />
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1180px] px-6 pb-28">
          <SectionBadge>Developers</SectionBadge>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mx-auto mb-10 max-w-xl text-center text-sm text-muted-foreground"
          >
            The student builders who brought the learning studio to life.
          </motion.p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {developers.map((member, index) => (
              <TeamCard key={`${member.role}-${index}`} member={member} index={index} variant="developer" />
            ))}
          </div>
        </section>
      </motion.main>
    </div>
  );
}
