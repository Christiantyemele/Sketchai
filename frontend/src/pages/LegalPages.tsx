import React from 'react';
import { Link } from 'react-router-dom';

type LegalLayoutProps = {
    title: string;
    children: React.ReactNode;
};

const LegalLayout: React.FC<LegalLayoutProps> = ({ title, children }) => {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="h-16 border-b border-slate-200 bg-background/80 backdrop-blur-xl flex items-center">
                <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900">
                        SketchAI
                    </Link>
                    <nav className="flex items-center gap-4 text-sm font-semibold">
                        <Link to="/terms" className="text-slate-600 hover:text-slate-900 transition-colors">
                            Terms
                        </Link>
                        <Link to="/privacy" className="text-slate-600 hover:text-slate-900 transition-colors">
                            Privacy
                        </Link>
                        <Link to="/register" className="text-primary hover:text-primary/80 transition-colors">
                            Create account
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="card p-6 sm:p-10">
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
                        <p className="mt-2 text-sm text-slate-600">Last updated: {new Date().toLocaleDateString()}</p>
                        <div className="mt-8 prose prose-slate max-w-none">
                            {children}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export const TermsPage: React.FC = () => {
    return (
        <LegalLayout title="Terms of Service">
            <p>
                These Terms of Service ("Terms") govern your access to and use of SketchAI (the "Service"). By creating an
                account, accessing, or using the Service, you agree to these Terms.
            </p>

            <h2>1. Eligibility</h2>
            <p>
                You must be at least 13 years old (or the minimum age of digital consent in your country) to use the Service.
                If you use the Service on behalf of an organization, you represent that you have authority to bind that
                organization.
            </p>

            <h2>2. Accounts</h2>
            <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all activity under
                your account. You agree to provide accurate information and keep it up to date.
            </p>

            <h2>3. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
                <li>Use the Service in a way that violates any applicable law or regulation.</li>
                <li>Attempt to gain unauthorized access to the Service or other users' accounts.</li>
                <li>Interfere with or disrupt the integrity or performance of the Service.</li>
                <li>Upload or generate content that is unlawful, harmful, or infringing.</li>
            </ul>

            <h2>4. Your Content</h2>
            <p>
                You retain ownership of the content you submit, generate, or store on the Service ("Your Content"). You grant
                us a limited license to host, store, process, and display Your Content solely to provide and improve the
                Service.
            </p>

            <h2>5. AI-Generated Output</h2>
            <p>
                The Service may generate diagrams and other output using AI. Output may be inaccurate or incomplete. You are
                responsible for reviewing and validating results before using them.
            </p>

            <h2>6. Paid Plans, Billing, and Refunds</h2>
            <p>
                Certain features may require payment. Prices and plan terms may change over time. Payments are processed by
                third-party providers. Unless required by law, fees are non-refundable.
            </p>

            <h2>7. Termination</h2>
            <p>
                You may stop using the Service at any time. We may suspend or terminate access if you violate these Terms or
                if we reasonably believe your use could cause harm to the Service or others.
            </p>

            <h2>8. Disclaimers</h2>
            <p>
                The Service is provided "as is" and "as available" without warranties of any kind, express or implied,
                including warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>

            <h2>9. Limitation of Liability</h2>
            <p>
                To the maximum extent permitted by law, SketchAI and its affiliates will not be liable for any indirect,
                incidental, special, consequential, or punitive damages, or any loss of profits or revenues.
            </p>

            <h2>10. Changes to These Terms</h2>
            <p>
                We may update these Terms from time to time. Continued use of the Service after changes become effective
                constitutes acceptance of the updated Terms.
            </p>

            <h2>11. Contact</h2>
            <p>
                For questions about these Terms, contact us at <a href="mailto:support@sketchai.app">support@sketchai.app</a>.
            </p>
        </LegalLayout>
    );
};

export const PrivacyPage: React.FC = () => {
    return (
        <LegalLayout title="Privacy Policy">
            <p>
                This Privacy Policy explains how SketchAI collects, uses, and shares information when you use the Service.
            </p>

            <h2>1. Information We Collect</h2>
            <ul>
                <li>
                    <strong>Account information</strong>: email address and authentication identifiers.
                </li>
                <li>
                    <strong>Usage data</strong>: basic analytics such as feature usage, timestamps, and diagnostics.
                </li>
                <li>
                    <strong>Content</strong>: prompts and diagrams you create or upload as part of using the Service.
                </li>
            </ul>

            <h2>2. How We Use Information</h2>
            <ul>
                <li>Provide and operate the Service (authentication, saving diagrams, billing).</li>
                <li>Improve reliability, performance, and user experience.</li>
                <li>Prevent fraud, abuse, and security incidents.</li>
                <li>Communicate about account-related issues and important updates.</li>
            </ul>

            <h2>3. How We Share Information</h2>
            <p>
                We may share information with service providers that help us operate the Service (for example: hosting,
                analytics, payment processors). We do not sell your personal information.
            </p>

            <h2>4. Data Retention</h2>
            <p>
                We retain information for as long as needed to provide the Service and comply with legal obligations. You may
                request deletion of your account data where applicable.
            </p>

            <h2>5. Security</h2>
            <p>
                We implement reasonable safeguards to protect information. No method of transmission or storage is 100%
                secure, so we cannot guarantee absolute security.
            </p>

            <h2>6. Your Choices</h2>
            <ul>
                <li>Access and update certain account information through your account.</li>
                <li>Request deletion of your account by contacting us.</li>
            </ul>

            <h2>7. International Transfers</h2>
            <p>
                Your information may be processed in countries other than where you live. We take steps to ensure appropriate
                protections where required.
            </p>

            <h2>8. Changes to This Policy</h2>
            <p>
                We may update this Privacy Policy from time to time. We will post the updated version with a revised “Last
                updated” date.
            </p>

            <h2>9. Contact</h2>
            <p>
                For privacy questions, contact us at <a href="mailto:privacy@sketchai.app">privacy@sketchai.app</a>.
            </p>
        </LegalLayout>
    );
};
