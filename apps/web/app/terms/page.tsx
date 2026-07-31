import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FlipTrybe Terms of Service",
  description: "Terms of Service governing the use of FlipTrybe Ads Campaigner and related services.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,102,255,0.08),_transparent_30%),radial-gradient(circle_at_80%_10%,_rgba(139,92,246,0.08),_transparent_24%),linear-gradient(180deg,_#050507_0%,_#0B0F19_38%,_#050507_100%)]">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">Terms of Service</h1>
          <p className="mt-2 text-base text-white/60">Effective Date: July 31, 2026</p>
          <p className="text-sm text-white/50">Last Updated: July 31, 2026</p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-white/80">
          {/* Introduction */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">1. Introduction and Acceptance</h2>
            <p className="leading-relaxed">
              FlipTrybe Ads Campaigner ("Service") is provided by FlipTrybe ("Company," "we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of the Service, including all content, features, and functionality.
            </p>
            <p className="mt-3 leading-relaxed">
              By accessing or using FlipTrybe Ads Campaigner, you agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use the Service.
            </p>
          </section>

          {/* Eligibility */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">2. Eligibility</h2>
            <p className="leading-relaxed">
              You represent and warrant that:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">You are at least 18 years old or the legal age of majority in your jurisdiction</li>
              <li className="text-white/80">You have the legal authority to enter into a binding agreement</li>
              <li className="text-white/80">You are not prohibited by law from using the Service</li>
              <li className="text-white/80">You will comply with all applicable laws and regulations</li>
            </ul>
          </section>

          {/* Account Responsibilities */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">3. Account Responsibilities</h2>
            <p className="leading-relaxed">
              When you create an account, you are responsible for:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Providing accurate, complete, and current information</li>
              <li className="text-white/80">Maintaining the confidentiality of your account credentials</li>
              <li className="text-white/80">All activities that occur under your account</li>
              <li className="text-white/80">Notifying us immediately of any unauthorized access</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              We reserve the right to suspend or terminate accounts that provide false or misleading information.
            </p>
          </section>

          {/* User Responsibilities */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">4. User Responsibilities</h2>
            <p className="leading-relaxed">
              You agree not to use the Service to:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Violate any applicable laws or regulations</li>
              <li className="text-white/80">Infringe on intellectual property rights</li>
              <li className="text-white/80">Create campaigns with misleading, deceptive, or false content</li>
              <li className="text-white/80">Engage in harassment, abuse, or discrimination</li>
              <li className="text-white/80">Attempt to gain unauthorized access to the Service or systems</li>
              <li className="text-white/80">Interfere with the Service's operation or security</li>
              <li className="text-white/80">Distribute malware or harmful code</li>
            </ul>
          </section>

          {/* Campaign and Advertising */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">5. Campaign Creation and Advertising</h2>
            <p className="leading-relaxed">
              FlipTrybe Ads Campaigner is a platform for creating and managing advertising campaigns. You are solely responsible for:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">All content, creative assets, and materials used in campaigns</li>
              <li className="text-white/80">Ensuring campaigns comply with applicable laws and platform policies</li>
              <li className="text-white/80">Obtaining necessary rights and permissions for content</li>
              <li className="text-white/80">Campaign performance and results</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              We reserve the right to review, reject, or suspend campaigns that violate these Terms or applicable laws.
            </p>
          </section>

          {/* Content and IP */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">6. Intellectual Property</h2>
            <p className="leading-relaxed">
              The Service, including all content, features, and functionality, is owned by FlipTrybe or its licensors and is protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p className="mt-3 leading-relaxed">
              You retain all rights to content you create and upload. By uploading content to the Service, you grant FlipTrybe a non-exclusive license to use the content solely to provide the Service.
            </p>
          </section>

          {/* User-Submitted Content */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">7. User-Submitted Content</h2>
            <p className="leading-relaxed">
              You are solely responsible for any content you submit, upload, or create through the Service. You represent and warrant that you own or have the right to use all content and that it does not infringe on third-party rights.
            </p>
            <p className="mt-3 leading-relaxed">
              By submitting content, you grant FlipTrybe permission to use, store, process, and display the content as necessary to provide the Service.
            </p>
          </section>

          {/* Third-Party Platforms */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">8. Third-Party Platforms and Integrations</h2>
            <p className="leading-relaxed">
              The Service may integrate with third-party platforms including TikTok, Instagram, Facebook, and others. Your use of these integrations is subject to:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">The terms and policies of the third-party platforms</li>
              <li className="text-white/80">Your compliance with platform-specific advertising requirements</li>
              <li className="text-white/80">Platform authorization and OAuth flows</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              We are not responsible for third-party platform functionality, policies, or changes. Your account connections to third-party platforms are your responsibility.
            </p>
          </section>

          {/* TikTok Integration */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">9. TikTok Integration</h2>
            <p className="leading-relaxed">
              FlipTrybe integrates with TikTok to enable campaign management and optimization. Your use of TikTok integration requires:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Compliance with TikTok's advertising terms and policies</li>
              <li className="text-white/80">Authorization through TikTok's OAuth flow</li>
              <li className="text-white/80">Adherence to TikTok's advertising guidelines</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              We disclaim any liability for TikTok's actions, policies, or service changes.
            </p>
          </section>

          {/* Payments */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">10. Payments and Financial Terms</h2>
            <p className="leading-relaxed">
              The Service supports campaign funding and wallet management. Payment processing is handled by third-party payment providers including Korapay.
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">All monetary amounts are in minor units (kobo/cents)</li>
              <li className="text-white/80">You are responsible for ensuring sufficient funds</li>
              <li className="text-white/80">Payment processing fees may apply</li>
              <li className="text-white/80">Failed transactions may be retried</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              Refunds are subject to our refund policy and applicable laws. Disputes should be directed to the payment provider.
            </p>
          </section>

          {/* Prohibited Activities */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">11. Prohibited Activities</h2>
            <p className="leading-relaxed">
              You agree not to:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Create campaigns promoting illegal products or services</li>
              <li className="text-white/80">Engage in fraud, scams, or deceptive practices</li>
              <li className="text-white/80">Violate any platform's advertising policies</li>
              <li className="text-white/80">Harass or discriminate against others</li>
              <li className="text-white/80">Use automated bots or scraping tools</li>
              <li className="text-white/80">Attempt to reverse engineer or hack the Service</li>
            </ul>
          </section>

          {/* Suspension and Termination */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">12. Suspension and Termination</h2>
            <p className="leading-relaxed">
              We may suspend or terminate your account immediately if you:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Violate these Terms</li>
              <li className="text-white/80">Violate applicable laws</li>
              <li className="text-white/80">Create campaigns that violate platform policies</li>
              <li className="text-white/80">Engage in fraudulent or harmful activities</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              Upon termination, your access to the Service is immediately revoked. Outstanding balances and obligations remain due.
            </p>
          </section>

          {/* Service Availability */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">13. Service Availability and Modifications</h2>
            <p className="leading-relaxed">
              FlipTrybe Ads Campaigner is provided on an "as-is" basis. We:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">May modify or discontinue the Service at any time</li>
              <li className="text-white/80">May perform maintenance that temporarily disrupts service</li>
              <li className="text-white/80">Do not guarantee uninterrupted availability</li>
              <li className="text-white/80">Do not guarantee specific campaign performance results</li>
            </ul>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">14. Disclaimers</h2>
            <p className="leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE SPECIFICALLY DISCLAIM:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Warranties of merchantability or fitness for purpose</li>
              <li className="text-white/80">Warranties regarding campaign performance</li>
              <li className="text-white/80">Warranties regarding third-party platform functionality</li>
              <li className="text-white/80">Liability for data loss or unauthorized access</li>
            </ul>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">15. Limitation of Liability</h2>
            <p className="leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">FlipTrybe is not liable for indirect, incidental, or consequential damages</li>
              <li className="text-white/80">Our total liability does not exceed the amount you paid in the past 12 months</li>
              <li className="text-white/80">We are not liable for third-party platform actions or policies</li>
            </ul>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">16. Indemnification</h2>
            <p className="leading-relaxed">
              You agree to indemnify and hold harmless FlipTrybe from any claims, damages, or expenses arising from:
            </p>
            <ul className="mt-3 list-inside space-y-2 leading-relaxed">
              <li className="text-white/80">Your use of the Service</li>
              <li className="text-white/80">Your violation of these Terms</li>
              <li className="text-white/80">Campaign content or claims</li>
              <li className="text-white/80">Infringement of third-party rights</li>
            </ul>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">17. Changes to These Terms</h2>
            <p className="leading-relaxed">
              We reserve the right to modify these Terms at any time. Changes are effective when posted. Continued use of the Service constitutes acceptance of the modified Terms.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">18. Governing Law</h2>
            <p className="leading-relaxed">
              These Terms are governed by the laws of Nigeria. Any disputes shall be resolved in accordance with applicable Nigerian law.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">19. Contact Us</h2>
            <p className="leading-relaxed">
              For questions about these Terms, please contact us at:
            </p>
            <p className="mt-3 leading-relaxed">
              <strong>FlipTrybe</strong><br />
              Email: support@fliptrybe.com
            </p>
          </section>

          {/* Severability */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">20. Severability</h2>
            <p className="leading-relaxed">
              If any provision of these Terms is found to be unenforceable, that provision shall be removed and the remaining provisions shall remain in effect.
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
