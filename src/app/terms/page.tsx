import type { Metadata } from 'next';
import { LegalPage } from '@/shared/ui/legal/legal-page';
import { termsContent } from '@/shared/ui/legal/content';

export const metadata: Metadata = {
  title: 'Terms of Service | QueryCraft',
  description: termsContent.description,
};

export default function TermsPage() {
  return <LegalPage content={termsContent} />;
}
