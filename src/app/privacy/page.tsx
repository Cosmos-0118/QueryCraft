import type { Metadata } from 'next';
import { LegalPage } from '@/shared/ui/legal/legal-page';
import { privacyContent } from '@/shared/ui/legal/content';

export const metadata: Metadata = {
  title: 'Privacy Policy | QueryCraft',
  description: privacyContent.description,
};

export default function PrivacyPage() {
  return <LegalPage content={privacyContent} />;
}
