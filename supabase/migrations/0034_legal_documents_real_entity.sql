-- yoRento: fills in the real legal entity behind the platform —
-- AsTeje Services SRL (RNC 132-29052-6), registered at Calle 10 #15,
-- Los Peralejos, Distrito Nacional, Dominican Republic 33195 —
-- replacing the [Legal Entity Name] / [Registered Address]
-- placeholders 0032 shipped with. Same on-conflict-update shape as
-- 0032, so this is safe to run whether or not 0032's placeholder text
-- ever went live.

update public.legal_documents set
  version = 2,
  updated_at = now(),
  sections = $json$[
    {"heading": "1. Agreement to Terms", "body": [
      "These Terms of Service (\"Terms\") govern your access to and use of yoRento, a vehicle rental marketplace operated by AsTeje Services SRL (\"yoRento\", \"we\", \"us\", or \"our\"), a company organized under the laws of the Dominican Republic, RNC 132-29052-6, registered at Calle 10 #15, Los Peralejos, Distrito Nacional, Dominican Republic 33195.",
      "By creating an account, listing a vehicle, or booking a vehicle through yoRento, you agree to be bound by these Terms and by our Privacy Policy. If you do not agree, do not use the platform."
    ]},
    {"heading": "2. What yoRento Is", "body": [
      "yoRento is a marketplace that connects vehicle owners and rental businesses (\"Hosts\") with people who want to rent a vehicle (\"Guests\"). yoRento is not a party to the rental agreement formed between a Host and a Guest for a specific booking, does not own or operate any listed vehicle, and is not a rental car company.",
      "Each approved booking is additionally governed by a Rental Agreement generated for that specific trip, covering the vehicle, dates, pricing, and condition terms agreed to by the Host and Guest."
    ]},
    {"heading": "3. Eligibility and Accounts", "body": [
      "You must be at least 18 years old and hold a valid, unexpired driver's license to book a vehicle as a Guest, and to list a vehicle as a Host you must have the legal right to rent out that vehicle.",
      "You are responsible for the accuracy of the information on your account and for all activity that occurs under it. yoRento may request identity verification (a government-issued ID and, where offered, an automated document/selfie check) before allowing certain actions, and may suspend or terminate accounts that fail verification, provide false information, or violate these Terms.",
      "One person may not maintain more than one active account without yoRento's permission."
    ]},
    {"heading": "4. Host Responsibilities", "body": [
      "Hosts are solely responsible for the accuracy of their vehicle listings (condition, features, availability, pricing) and for ensuring the vehicle is safe, roadworthy, properly registered, and legally permitted to be rented out under Dominican Republic law, including any required insurance, permits, or licenses.",
      "Hosts must honor accepted bookings, keep the vehicle in the condition represented in the listing and condition report, and respond to booking requests and messages in good faith and in a timely manner.",
      "A Host is responsible for their own tax obligations arising from income earned through the platform."
    ]},
    {"heading": "5. Guest Responsibilities", "body": [
      "Guests must hold a valid driver's license, use the vehicle only for lawful purposes, comply with the fuel and cleaning policy stated on the listing, and return the vehicle at the agreed time and location in the condition it was received, ordinary wear excepted.",
      "Guests are responsible for any traffic violations, tolls, fines, or damage that occur during their rental period, and for any loss caused by their negligence, misuse, or breach of the rental agreement for that booking."
    ]},
    {"heading": "6. Bookings, Pricing, and Payments", "body": [
      "Prices are set by the Host. When a Guest requests a booking and the Host accepts, a binding rental agreement forms between the Host and Guest for that trip, and payment is processed through yoRento's supported payment providers.",
      "yoRento charges a platform service fee, disclosed in the price breakdown before a Guest confirms a booking, which is deducted from the amount paid out to the Host.",
      "yoRento does not store full payment card numbers — payments are handled by our third-party payment processors, and use of those services is also subject to their own terms."
    ]},
    {"heading": "7. Cancellations and Refunds", "body": [
      "The cancellation policy shown on a booking at the time it is made governs any refund due if the Guest or Host cancels. yoRento may facilitate a refund consistent with that policy but is not itself the payer or payee of a refund."
    ]},
    {"heading": "8. Condition Reports and Disputes", "body": [
      "Guests and Hosts are encouraged to complete a condition report (including photos) at pick-up and at return. A condition report may be used as evidence if a dispute over damage, cleanliness, fuel level, or mileage arises.",
      "yoRento may, at its discretion, help mediate a dispute between a Host and Guest, but is not obligated to and does not guarantee any particular outcome. Serious disputes involving property damage, injury, or alleged criminal conduct should also be reported to the appropriate authorities."
    ]},
    {"heading": "9. Prohibited Conduct", "body": [
      "You may not use yoRento to: list a vehicle you do not have the right to rent out; provide false, misleading, or stolen identity information; discriminate against another user on a prohibited basis; harass, threaten, or defraud another user; circumvent the platform to avoid fees; or use a vehicle for an illegal purpose, racing, or to sublet it to someone else."
    ]},
    {"heading": "10. Intellectual Property", "body": [
      "The yoRento name, logo, and platform design are the property of AsTeje Services SRL. You retain ownership of content you upload (such as vehicle photos), but grant yoRento a license to display it on the platform for the purpose of operating the marketplace."
    ]},
    {"heading": "11. Disclaimers and Limitation of Liability", "body": [
      "yoRento provides the platform \"as is\" and does not guarantee the condition, safety, legality, or availability of any listed vehicle, or the conduct of any Host or Guest.",
      "To the fullest extent permitted by law, yoRento is not liable for indirect, incidental, or consequential damages arising from your use of the platform or from a rental transaction between a Host and Guest, and yoRento's total liability for any claim is limited to the platform fees you paid in the twelve months before the claim arose."
    ]},
    {"heading": "12. Indemnification", "body": [
      "You agree to indemnify and hold yoRento harmless from claims, damages, and expenses (including reasonable legal fees) arising from your breach of these Terms, your use of a vehicle, or your violation of applicable law."
    ]},
    {"heading": "13. Governing Law", "body": [
      "These Terms are governed by the laws of the Dominican Republic, without regard to conflict-of-law principles. Any dispute not resolved informally will be subject to the exclusive jurisdiction of the competent courts of the Dominican Republic."
    ]},
    {"heading": "14. Changes to These Terms", "body": [
      "yoRento may update these Terms from time to time. Material changes will be reflected by an updated effective date on this page; continued use of the platform after a change takes effect constitutes acceptance of the revised Terms."
    ]},
    {"heading": "15. Company Information", "body": [
      "yoRento is operated by AsTeje Services SRL, RNC 132-29052-6, registered at Calle 10 #15, Los Peralejos, Distrito Nacional, Dominican Republic 33195."
    ]},
    {"heading": "16. Contact", "body": [
      "Questions about these Terms can be sent to legal@yorento.com."
    ]}
  ]$json$::jsonb
where slug = 'terms-of-service';

update public.legal_documents set
  version = 2,
  updated_at = now(),
  sections = $json$[
    {"heading": "1. Introduction", "body": [
      "This Privacy Policy explains what personal information yoRento (\"we\", \"us\", \"our\") — operated by AsTeje Services SRL, RNC 132-29052-6, registered at Calle 10 #15, Los Peralejos, Distrito Nacional, Dominican Republic 33195 — collects through the yoRento platform, why we collect it, how it's used and shared, and the choices you have. It applies to anyone who creates an account, lists a vehicle, or books a vehicle through yoRento."
    ]},
    {"heading": "2. Information We Collect", "body": [
      "Account information: your name, email address, phone number, date of birth, preferred language and currency, and a profile photo if you add one.",
      "Identity verification information: a photo of a government-issued ID and, if you use the automated verification option, a selfie processed by our identity verification provider to confirm it matches your ID. If you use manual verification instead, your ID photo is reviewed by a member of our team and stored securely.",
      "Listing and booking information: vehicle details and photos you upload as a Host, and trip details (dates, pick-up/return locations and times, price) for bookings you make or receive.",
      "Condition report information: photos, fuel level, mileage, and notes submitted at pick-up and return.",
      "Payment information: our payment processors (currently Stripe and/or PayPal, depending on what's enabled) handle your card or account details directly — yoRento does not receive or store full card numbers.",
      "Communications: messages sent between Hosts and Guests through the platform, and any correspondence you have with yoRento support.",
      "Usage information: pages visited, device and browser type, and approximate location inferred from your IP address, collected automatically to help us understand how the platform is used and to keep it secure.",
      "Location information: if you grant permission, your device's precise location, used only to help you find nearby vehicles."
    ]},
    {"heading": "3. How We Use Information", "body": [
      "To operate the marketplace: creating and managing your account, processing bookings and payments, and connecting Hosts and Guests for a trip.",
      "To verify identity and maintain trust and safety on the platform, including detecting duplicate or fraudulent accounts.",
      "To generate the rental agreement for an approved booking and deliver it to you by email and through the platform.",
      "To communicate with you about your bookings, account, and platform updates.",
      "To improve the platform, including through aggregated, de-identified analytics.",
      "To comply with legal obligations and to investigate or prevent fraud, abuse, or violations of our Terms of Service."
    ]},
    {"heading": "4. How We Share Information", "body": [
      "With the other party to a booking: a Host and Guest see limited information about each other needed to complete a trip (such as name, profile photo, and rating) — not each other's full ID documents or payment details.",
      "With service providers: our payment processors, identity verification provider, email delivery provider, and hosting/database provider (Supabase), each of whom processes data only as needed to provide their service to yoRento.",
      "For legal reasons: if required to comply with a law, regulation, legal process, or a reasonable request from a public authority.",
      "In a business transfer: if AsTeje Services SRL is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.",
      "We do not sell your personal information."
    ]},
    {"heading": "5. Data Retention", "body": [
      "We keep your information for as long as your account is active and for a reasonable period afterward to comply with legal, tax, and dispute-resolution obligations — condition reports and rental agreements tied to a completed booking, in particular, are kept as a record of that trip."
    ]},
    {"heading": "6. Your Rights and Choices", "body": [
      "You can review and update most of your account information directly in your profile. You may request a copy of your personal information, ask us to correct it, or ask us to delete your account by contacting us at privacy@yorento.com; we will respond to verified requests within a reasonable time, subject to what we're legally required to retain (for example, records of a completed booking).",
      "You can control location permission through your device or browser settings at any time."
    ]},
    {"heading": "7. Cookies and Analytics", "body": [
      "yoRento uses essential cookies to keep you signed in and to remember preferences like language and theme, and limited first-party analytics to understand traffic patterns on the site. We do not use third-party advertising trackers."
    ]},
    {"heading": "8. Data Security", "body": [
      "We use industry-standard safeguards — encrypted connections, access controls, and a database provider (Supabase) with row-level security — to protect your information. No method of transmission or storage is perfectly secure, and we cannot guarantee absolute security."
    ]},
    {"heading": "9. Children's Privacy", "body": [
      "yoRento is not directed to, and does not knowingly collect personal information from, anyone under 18."
    ]},
    {"heading": "10. International Data Transfers", "body": [
      "Some of our service providers (including our hosting and payment providers) may process data outside the Dominican Republic. Where that happens, we rely on those providers' own safeguards for cross-border data transfer."
    ]},
    {"heading": "11. Changes to This Policy", "body": [
      "We may update this Privacy Policy from time to time. A material change will be reflected by an updated effective date on this page."
    ]},
    {"heading": "12. Company Information", "body": [
      "yoRento is operated by AsTeje Services SRL, RNC 132-29052-6, registered at Calle 10 #15, Los Peralejos, Distrito Nacional, Dominican Republic 33195."
    ]},
    {"heading": "13. Contact Us", "body": [
      "Questions about this Privacy Policy or your information can be sent to privacy@yorento.com."
    ]}
  ]$json$::jsonb
where slug = 'privacy-policy';
