'use client';

import Image from 'next/image';
import { useState } from 'react';

type TeamMemberImageProps = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

export default function TeamMemberImage({
  src,
  alt,
  sizes,
  priority = false,
  className = '',
}: TeamMemberImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      {!loaded && !failed && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/30 via-muted/15 to-muted/40"
          aria-hidden
        />
      )}
      {!failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={`object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/25 text-muted-foreground">
          <span className="text-xs font-medium">Photo unavailable</span>
        </div>
      )}
    </>
  );
}
