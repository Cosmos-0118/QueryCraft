export type LegalSection = {
  id: string;
  title: string;
  body?: string[];
  bullets?: string[];
};

export type LegalPageContent = {
  badge: string;
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
  related: {
    label: string;
    href: string;
  };
};

export const privacyContent: LegalPageContent = {
  badge: 'Data Protection',
  title: 'Privacy Policy',
  description:
    'This policy explains what QueryCraft collects, why we collect it, and how user data is handled across local workspaces, test flows, browser storage, and optional AI features.',
  lastUpdated: 'June 11, 2026',
  related: {
    label: 'Terms of Service',
    href: '/terms',
  },
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction',
      body: [
        'This Privacy Policy explains how QueryCraft collects, uses, stores, and protects information when you use the Service. QueryCraft is designed primarily as a local-first educational app, but some features may use server-side APIs, configured databases, cookies, or third-party AI services.',
      ],
    },
    {
      id: 'information-we-collect',
      title: '2. Information We Collect',
      body: [
        'Depending on the features you use, QueryCraft may collect or store local account details, Test module account information, learning workspace content, test content, AI analysis inputs, and account export or import data.',
        'QueryCraft may also process browser storage data, essential cookies, request metadata, and Test DB diagnostic information when those features are used.',
      ],
      bullets: [
        'Local account data: display name, account ID, role selection, creation time, and local password hash.',
        'Workspace content: SQL queries, schemas, query history, ER diagrams, normalization inputs, generated datasets, and settings.',
        'Test module data: accounts, questions, assignments, attempts, answers, scores, and reviews.',
        'Optional AI inputs: table names, column names, dependencies, workflow state, and sample table data submitted for analysis.',
      ],
    },
    {
      id: 'how-we-use-information',
      title: '3. How We Use Information',
      body: [
        'We use information to provide database learning workflows, store local progress, authenticate Test module users, authorize role-based access, save tests and attempts, run optional AI-assisted analysis, export user-requested outputs, diagnose errors, and protect the Service from misuse.',
      ],
    },
    {
      id: 'local-first-storage',
      title: '4. Local-First Storage',
      body: [
        'Many QueryCraft features store data directly in your browser using localStorage or sessionStorage. This may include account details, workspace state, history, preferences, diagrams, generated tables, and learning artifacts.',
        'Local browser data stays on the device and browser profile where it was created unless you export it, import it elsewhere, synchronize it through browser or operating system features, or submit it to a server-backed feature.',
      ],
    },
    {
      id: 'cookies',
      title: '5. Cookies and Browser Storage',
      body: [
        'QueryCraft uses essential browser storage and cookies for local account sessions, user-scoped workspace persistence, preferences, Test module authentication, and test workflow continuity.',
        'QueryCraft does not intentionally use advertising cookies. Analytics, monitoring, or hosting logs may depend on the deployment environment.',
      ],
    },
    {
      id: 'ai-services',
      title: '6. AI Services Disclosure',
      body: [
        'If the optional AI-assisted normalization feature is enabled and you choose to use it, QueryCraft may send selected schema, dependency, workflow, and sample data to the configured AI provider. Do not submit sensitive, confidential, proprietary, regulated, or credential-like data to this feature unless your deployment is approved for that use.',
      ],
    },
    {
      id: 'data-security',
      title: '7. Data Security',
      body: [
        'QueryCraft includes security measures appropriate to its local-first educational design. No system can guarantee absolute security, and browser storage can be exposed if your device, browser profile, extensions, or operating system are compromised.',
      ],
      bullets: [
        'Workspace data is scoped by user-specific browser storage keys.',
        'Test module features may use server-signed session tokens and HTTP-only cookies.',
        'Protected Test module routes may enforce role-based access for administrators, teachers, and students.',
        'SQL sandbox execution is designed for in-browser SQLite practice rather than direct production database access.',
      ],
    },
    {
      id: 'data-sharing',
      title: '8. Data Sharing',
      body: [
        'We do not sell your personal information. Information may be shared with authorized administrators or teachers, service providers, configured database providers, AI providers when you intentionally use AI features, or when required by law, policy, security investigation, or to protect rights and safety.',
      ],
    },
    {
      id: 'data-retention',
      title: '9. Data Retention',
      body: [
        'Local account and workspace data remain in browser storage until you delete the account, clear site data, reset the browser profile, or remove the data manually. Test module data remains in the configured database until removed by an administrator, retention policy, or database maintenance process.',
      ],
    },
    {
      id: 'your-rights',
      title: '10. Your Choices and Rights',
      body: [
        'Depending on your deployment and applicable law, you may be able to view, update, export, import, or delete local accounts and local workspace data; clear browser storage and cookies; request access, correction, or deletion of Test module account data; and avoid optional AI features.',
      ],
    },
    {
      id: 'childrens-privacy',
      title: "11. Children's Privacy",
      body: [
        'QueryCraft is intended for students, teachers, administrators, and learners using the Service in permitted educational contexts. If a deployment is used by minors, the responsible institution, teacher, parent, guardian, or administrator must ensure compliance with applicable consent, privacy, and education laws.',
      ],
    },
    {
      id: 'changes',
      title: '12. Changes to This Policy',
      body: [
        'We may update this Privacy Policy periodically. Updates will be posted with a revised last updated date. Continued use of QueryCraft after changes are posted means you accept the updated policy.',
      ],
    },
  ],
};

export const termsContent: LegalPageContent = {
  badge: 'Legal Document',
  title: 'Terms of Service',
  description:
    'Please review these terms before using QueryCraft. They explain account responsibilities, acceptable usage, educational use, and service boundaries.',
  lastUpdated: 'June 11, 2026',
  related: {
    label: 'Privacy Policy',
    href: '/privacy',
  },
  sections: [
    {
      id: 'acceptance',
      title: '1. Acceptance of Terms',
      body: [
        'By accessing or using QueryCraft, you agree to be bound by these Terms of Service. If you do not agree to these Terms, do not use the Service.',
      ],
    },
    {
      id: 'description',
      title: '2. Description of Service',
      body: [
        'QueryCraft is an educational database learning platform. It provides tools for practicing SQL, relational algebra, tuple relational calculus, ER diagramming, database normalization, synthetic table generation, and test-based database exercises.',
        'Most learning features are local-first and run in the browser. Some features may use server-side API routes, including seed dataset loading, Test DB health checks, Test module authentication, test management, attempt submission, and optional AI-assisted normalization analysis.',
      ],
    },
    {
      id: 'eligibility',
      title: '3. Eligibility',
      body: [
        'You may use QueryCraft only if you can comply with these Terms and all applicable laws, institutional rules, or classroom policies. If QueryCraft is provided by a teacher, administrator, institution, or organization, your access may also be subject to their rules.',
      ],
    },
    {
      id: 'accounts',
      title: '4. User Accounts',
      body: [
        'QueryCraft may support local learning accounts stored on your device and Test module accounts managed by an administrator, teacher, institution, or authorized project operator.',
        'You are responsible for keeping your credentials, account export codes, device access, and browser profile secure.',
      ],
    },
    {
      id: 'acceptable-use',
      title: '5. Acceptable Use',
      body: ['You agree not to misuse QueryCraft or interfere with the security, availability, or integrity of the Service.'],
      bullets: [
        'Do not access another user account, test, answer, submission, or workspace data without permission.',
        'Do not overload, exploit, probe, or disrupt QueryCraft systems, APIs, databases, or networks.',
        'Do not upload malicious files, scripts, payloads, or unauthorized content.',
        'Do not circumvent authentication, authorization, attempt controls, test restrictions, or classroom rules.',
        'Do not use automated scraping, bots, or scripts unless expressly authorized.',
      ],
    },
    {
      id: 'academic-integrity',
      title: '6. Educational Use and Academic Integrity',
      body: [
        'QueryCraft is intended to support learning and assessment. If you use QueryCraft in a class, lab, test, or institutional setting, you are responsible for following the academic integrity rules that apply to that setting.',
      ],
    },
    {
      id: 'privacy',
      title: '7. Data and Privacy',
      body: [
        'Your use of QueryCraft is also governed by the Privacy Policy, which explains how information is collected, stored, used, and protected.',
      ],
    },
    {
      id: 'security',
      title: '8. Security Measures',
      body: [
        'QueryCraft uses a local-first architecture for most learning features, with user-scoped browser storage to separate workspace data between local accounts. For Test module features, QueryCraft may use server-side authentication, HTTP-only cookies, signed session tokens, role-based access controls, database-backed test data, and server-side validation for protected routes.',
      ],
    },
    {
      id: 'third-party-services',
      title: '9. Third-Party Services',
      body: [
        'QueryCraft may use third-party services or libraries to provide parts of the Service. Optional AI-assisted normalization analysis may send sanitized schema, dependency, and sample table data to an AI provider when enabled and used. Third-party services are governed by their own terms and privacy policies.',
      ],
    },
    {
      id: 'user-content',
      title: '10. User Content',
      body: [
        'You retain responsibility for content you create, import, enter, or submit in QueryCraft, including SQL statements, schemas, diagrams, generated tables, test questions, test answers, and sample data.',
      ],
    },
    {
      id: 'intellectual-property',
      title: '11. Intellectual Property',
      body: [
        'QueryCraft and its original content, interface, features, and functionality are protected by applicable intellectual property laws. You may not copy, modify, distribute, or create derivative works from the Service except as permitted by the applicable project license, written permission, or law.',
      ],
    },
    {
      id: 'availability',
      title: '12. Service Availability',
      body: [
        'QueryCraft is provided on an as available basis. We do not guarantee uninterrupted access, error-free operation, data availability, or compatibility with every browser, device, or deployment environment.',
      ],
    },
    {
      id: 'liability',
      title: '13. Limitation of Liability',
      body: [
        'To the fullest extent permitted by law, QueryCraft and its maintainers, operators, contributors, administrators, or affiliated organizations will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from your use of or inability to use the Service.',
      ],
    },
    {
      id: 'termination',
      title: '14. Account Suspension or Termination',
      body: [
        'We or an authorized administrator may suspend, restrict, or terminate access to QueryCraft if we believe a user has violated these Terms, misused the Service, compromised security, violated academic rules, or created risk for other users or systems.',
      ],
    },
    {
      id: 'changes',
      title: '15. Changes to These Terms',
      body: [
        'We may update these Terms from time to time. Updated terms will be posted with a revised last updated date. Continued use of QueryCraft after changes are posted means you accept the updated Terms.',
      ],
    },
  ],
};
