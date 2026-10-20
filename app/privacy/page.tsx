import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How GFive Kolkata uses your details on design links, WhatsApp, Instagram and Facebook.',
  robots: { index: true, follow: true },
};

/** Public privacy policy (needed for the Meta / WhatsApp app). */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-[16px] leading-relaxed text-ink">
      <p className="eyebrow">GFive Kolkata</p>
      <h1 className="mt-1 font-display text-4xl font-semibold">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 20 October 2026</p>

      <Section n={1} title="Who we are">
        GFive Designers Couture Pvt. Ltd. (“GFive”), 113, Park Street, Poddar Point, 3rd Floor, Kolkata 700016, India. Email: info@gfive.co.in · WhatsApp: +91 70444 40614.
      </Section>
      <Section n={2} title="What we collect">
        When you order from a design link, ask for a call back, or message us on WhatsApp, Instagram or Facebook, we receive: your name / firm name, mobile number, city, GST number and agent name (if you give them), the designs, colours and pieces you choose, and the messages, photos or videos you send us. Our Sales Persons may add notes about your enquiry.
      </Section>
      <Section n={3} title="Why we use it">
        Only to answer you, take and deliver your orders, send invoices and order updates, and help you with complaints. We do not sell your details and we do not use them for anyone else’s advertising.
      </Section>
      <Section n={4} title="Who can see it">
        Your details are seen by GFive’s owners and the Sales Person who looks after you. They are stored with our service providers: Google Firebase (database and login), Vercel (website), Cloudinary (design photos) and Meta (WhatsApp, Instagram, Facebook messages). AI model photos and videos are made only from our own design photos (Google AI) — never from your messages or photos.
      </Section>
      <Section n={5} title="WhatsApp bot">
        Our WhatsApp assistant replies with designs, order links, your order status and customer care. Your messages and replies are saved with your enquiry so your Sales Person can help you. Write <b>STOP</b> to stop messages from us and <b>START</b> to start again.
      </Section>
      <Section n={6} title="How long we keep it">
        Order and invoice records are kept as required by Indian tax law. Enquiries that did not become orders are deleted on request.
      </Section>
      <Section n={7} title="Deleting your data">
        To see or delete your details, email info@gfive.co.in or WhatsApp +91 70444 40614 with your mobile number. We will reply within 30 days. Records we must keep by law (for example GST invoices) cannot be deleted before that period ends.
      </Section>
    </main>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-2xl font-semibold">
        {n}. {title}
      </h2>
      <p className="mt-1.5">{children}</p>
    </section>
  );
}
