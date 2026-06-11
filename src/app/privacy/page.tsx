import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
import { privacyContent } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Privacy Policy | QueryCraft',
  description: privacyContent.description,
};

export default function PrivacyPage() {
  return <LegalPage content={privacyContent} />;
}
