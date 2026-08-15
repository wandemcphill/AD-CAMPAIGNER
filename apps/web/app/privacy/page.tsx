import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FlipTrybe Privacy Policy",
  description: "Privacy Policy explaining how FlipTrybe handles information when users access and use its services.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,102,255,0.08),_transparent_30%),radial-gradient(circle_at_80%_10%,_rgba(139,92,246,0.08),_transparent_24%),linear-gradient(180deg,_#050507_0%,_#0B0F19_38%,_#050507_100%)]">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">Privacy Policy</h1>
          <p className="mt-2 text-base text-white/60">Effective Date: July 31, 2026</p>
          <p className="text-sm text-white/50">Last Updated: July 31, 2026</p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-white/80">
          {/* Introduction */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">1. Introduction</h2>
            <p className="leading-relaxed">
              FlipTrybe ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use FlipTrybe Ads Campaigner ("Service").
            </p>
            <p className="mt-3 leading-relaxed">
              Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Service.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">2. Information We Collect</h2>

            <h3 className="mb-3 text-lg font-semibold text-white/90">2.1 Account Information</h3>
            <p className="leading-relaxed">
              When you create an account, we collect:
            </p>
            <ul className="mt-2 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Username and password (password stored as encrypted hash)</li>
              <li className="text-white/80">Full name and display name</li>
              <li className="text-white/80">Email address</li>
              <li className="text-white/80">Organization and workspace information</li>
              <li className="text-white/80">Account creation and last updated timestamps</li>
            </ul>

            <h3 className="mb-3 mt-6 text-lg font-semibold text-white/90">2.2 Authentication Information</h3>
            <p className="leading-relaxed">
              For security purposes, we collect:
            </p>
            <ul className="mt-2 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Authentication tokens and session data</li>
              <li className="text-white/80">Two-factor authentication secrets (TOTP)</li>
              <li className="text-white/80">Two-factor backup codes</li>
              <li className="text-white/80">Email verification status</li>
              <li className="text-white/80">Login timestamps and session information</li>
            </ul>

            <h3 className="mb-3 mt-6 text-lg font-semibold text-white/90">2.3 Campaign and Content Data</h3>
            <p className="leading-relaxed">
              When you create and manage campaigns, we collect:
            </p>
            <ul className="mt-2 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Campaign details, objectives, and configuration</li>
              <li className="text-white/80">Campaign status and timeline</li>
              <li className="text-white/80">Creative assets (images, videos, text)</li>
              <li className="text-white/80">Campaign notes and assignments</li>
              <li className="text-white/80">Campaign performance data and analytics</li>
            </ul>

            <h3 className="mb-3 mt-6 text-lg font-semibold text-white/90">2.4 Media and Assets</h3>
            <p className="leading-relaxed">
              We store and process media you upload including:
            </p>
            <ul className="mt-2 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Images, videos, and screenshots</li>
              <li className="text-white/80">Campaign creative materials</li>
              <li className="text-white/80">Report attachments</li>
              <li className="text-white/80">Metadata associated with uploaded files</li>
            </ul>

            <h3 className="mb-3 mt-6 text-lg font-semibold text-white/90">2.5 Financial Information</h3>
            <p className="leading-relaxed">
              For campaign funding and payments, we collect:
            </p>
            <ul className="mt-2 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Wallet and account balance information</li>
              <li className="text-white/80">Campaign budget allocation data</li>
              <li className="text-white/80">Payment transaction records</li>
              <li className="text-white/80">Ledger entries and financial history</li>
            </ul>

            <h3 className="mb-3 mt-6 text-lg font-semibold text-white/90">2.6 Platform Integration Data</h3>
            <p className="leading-relaxed">
              When you connect platform accounts, we collect:
            </p>
            <ul className="mt-2 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">TikTok, Instagram, Facebook, and other platform credentials (via OAuth)</li>
              <li className="text-white/80">Ad account IDs and platform-specific identifiers</li>
              <li className="text-white/80">Campaign performance data from connected platforms</li>
            </ul>

            <h3 className="mb-3 mt-6 text-lg font-semibold text-white/90">2.7 System and Usage Information</h3>
            <p className="leading-relaxed">
              We collect information about your use of the Service including:
            </p>
            <ul className="mt-2 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Access logs and timestamps</li>
              <li className="text-white/80">User actions and interactions</li>
              <li className="text-white/80">API key usage and integrations</li>
              <li className="text-white/80">Error logs and system events</li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">3. How We Use Information</h2>
            <p className="leading-relaxed">
              We use collected information for:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Providing and maintaining the Service</li>
              <li className="text-white/80">Processing campaign creation and management</li>
              <li className="text-white/80">Processing payments and managing wallets</li>
              <li className="text-white/80">Authenticating users and securing accounts</li>
              <li className="text-white/80">Providing customer support</li>
              <li className="text-white/80">Monitoring Service usage and performance</li>
              <li className="text-white/80">Preventing fraud and unauthorized access</li>
              <li className="text-white/80">Complying with legal obligations</li>
              <li className="text-white/80">Improving and optimizing the Service</li>
            </ul>
          </section>

          {/* How Information Is Shared */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">4. How Information Is Shared</h2>
            <p className="leading-relaxed">
              We do not sell personal information. We share information in the following circumstances:
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">4.1 Third-Party Service Providers</h3>
            <p className="leading-relaxed">
              We share information with service providers who assist in operating the Service, including:
            </p>
            <ul className="mt-2 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Payment processors (Korapay)</li>
              <li className="text-white/80">Cloud storage and hosting providers</li>
              <li className="text-white/80">Database and infrastructure providers</li>
              <li className="text-white/80">Customer support platforms</li>
            </ul>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">4.2 Advertising Platforms</h3>
            <p className="leading-relaxed">
              When you connect accounts to advertising platforms (TikTok, Instagram, Facebook, etc.), we share campaign data as necessary to facilitate campaign management and optimization on those platforms.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">4.3 Legal Compliance</h3>
            <p className="leading-relaxed">
              We may disclose information when required by law or to protect our legal rights, your safety, or the safety of others.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">4.4 Business Transfers</h3>
            <p className="leading-relaxed">
              If FlipTrybe is involved in a merger, acquisition, or bankruptcy, your information may be transferred as part of that transaction.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">4.5 With Your Consent</h3>
            <p className="leading-relaxed">
              We share information with third parties when you consent to such sharing.
            </p>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">5. Third-Party Services</h2>
            <p className="leading-relaxed">
              Our Service integrates with third-party platforms including TikTok, Instagram, Facebook, and others. These platforms have their own privacy policies, and your information is subject to their policies when shared with them. We are not responsible for third-party privacy practices.
            </p>
            <p className="mt-3 leading-relaxed">
              Third-party platforms may also collect information directly from your interactions with their services. Please review their privacy policies for details.
            </p>
          </section>

          {/* Cookies and Local Storage */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">6. Cookies and Similar Technologies</h2>
            <p className="leading-relaxed">
              We use the following technologies to collect information:
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">6.1 Browser Storage</h3>
            <p className="leading-relaxed">
              We use browser local storage to maintain authentication tokens and session information. This allows you to remain logged in across sessions.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">6.2 Cookies</h3>
            <p className="leading-relaxed">
              The Service may use cookies for authentication, user preferences, and service functionality. You can control cookies through your browser settings.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">6.3 Analytics</h3>
            <p className="leading-relaxed">
              We collect usage data to understand how the Service is used and to improve functionality.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">7. Data Retention</h2>
            <p className="leading-relaxed">
              We retain personal information as long as necessary to provide the Service and fulfill the purposes described in this Privacy Policy, unless a longer retention period is required by law.
            </p>
            <p className="mt-3 leading-relaxed">
              When you delete your account, we delete associated personal information, subject to legal retention requirements and backup retention periods. Campaign and financial data may be retained for compliance and dispute resolution purposes.
            </p>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">8. Data Security</h2>
            <p className="leading-relaxed">
              We implement security measures to protect your information, including:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Encrypted password storage</li>
              <li className="text-white/80">HTTPS/TLS encryption for data in transit</li>
              <li className="text-white/80">Secure authentication and session management</li>
              <li className="text-white/80">Access controls and authorization checks</li>
              <li className="text-white/80">Regular security monitoring</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              No security system is impenetrable. While we strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          {/* User Rights */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">9. Your Rights and Choices</h2>
            <p className="leading-relaxed">
              You have the following rights regarding your information:
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">9.1 Access and Portability</h3>
            <p className="leading-relaxed">
              You can access and download your account information through your account settings.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">9.2 Account Control</h3>
            <p className="leading-relaxed">
              You can update, correct, or delete account information through your profile settings.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">9.3 Account Deletion</h3>
            <p className="leading-relaxed">
              You may request deletion of your account and associated data. Some data may be retained for legal or compliance purposes.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">9.4 Communication Preferences</h3>
            <p className="leading-relaxed">
              You can manage notification preferences through your account settings.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">9.5 Cookies and Tracking</h3>
            <p className="leading-relaxed">
              You can control cookies and local storage through your browser settings.
            </p>

            <h3 className="mb-3 mt-4 text-lg font-semibold text-white/90">9.6 Contact Us</h3>
            <p className="leading-relaxed">
              To exercise your rights, contact us at hello@fliptrybe.xyz
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">10. Children's Privacy</h2>
            <p className="leading-relaxed">
              FlipTrybe Ads Campaigner is not intended for children under 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected information from a child under 18, we will delete it immediately.
            </p>
          </section>

          {/* International Data Transfers */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">11. International Data Transfers</h2>
            <p className="leading-relaxed">
              Your information may be transferred to, stored in, and processed in countries other than your country of residence. By using the Service, you consent to the transfer of your information to countries outside your country of origin.
            </p>
          </section>

          {/* Changes to This Policy */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">12. Changes to This Privacy Policy</h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. Changes are effective when posted. We will notify you of material changes via email or prominent notice on the Service. Your continued use of the Service constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* CCPA and California Residents */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">13. Additional Rights for Certain Jurisdictions</h2>
            <p className="leading-relaxed">
              Residents of certain jurisdictions may have additional privacy rights. If applicable laws grant you specific rights regarding your personal information, please contact us to learn more about exercising those rights.
            </p>
          </section>

          {/* Contact Us */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">14. Contact Us</h2>
            <p className="leading-relaxed">
              If you have questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p className="mt-3 leading-relaxed">
              <strong>FlipTrybe</strong><br />
              Email: hello@fliptrybe.xyz
            </p>
            <p className="mt-4 leading-relaxed">
              We will respond to privacy inquiries within a reasonable timeframe.
            </p>
          </section>

          {/* Data Processing Addendum */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">15. Data Processor Information</h2>
            <p className="leading-relaxed">
              FlipTrybe processes personal information on behalf of users and their organization. For details about how we process personal data as a service provider or data processor, please contact hello@fliptrybe.xyz.
            </p>
          </section>
        </div>

        {/* Footer spacing */}
        <div className="mt-16 pt-8 border-t border-white/10">
          <p className="text-center text-sm text-white/50">
            © 2026 FlipTrybe. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
