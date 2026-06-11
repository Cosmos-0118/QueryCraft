import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
import { termsContent } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Terms of Service | QueryCraft',
  description: termsContent.description,
};

export default function TermsPage() {
  return <LegalPage content={termsContent} />;
}
