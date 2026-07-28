function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface TemplateInput {
  name: string | null
  businessName: string
  reviewLink: string
  unsubscribeUrl: string
}

/**
 * Bewust géén incentive-taal ("korting", "maak kans op", "als dank ontvangt u")
 * en geen verzoek om een medewerkersnaam te noemen. Beide zijn in strijd met
 * het beleid van Google voor bedrijfsprofielen. Door dat hier in de template
 * vast te leggen in plaats van als instructie aan de klant mee te geven, kan
 * een klant het niet per ongeluk zelf toevoegen.
 *
 * De tekst vraagt ook niet om een pósitieve review — alleen om een review.
 * Dat is het verschil tussen vragen en sturen.
 *
 * Om dezelfde reden staat er geen vraag als "Bent u tevreden?" boven het
 * verzoek. Iedereen krijgt dezelfde link, dus dat is geen review gating in
 * technische zin — maar het maakt het verzoek voorwaardelijk aan tevredenheid,
 * en dat is precies wat Google "selectief om positieve reviews vragen" noemt.
 */
export function renderReviewRequest(input: TemplateInput): { subject: string; html: string; text: string } {
  const name = input.name?.trim() || null
  // Zonder naam wordt "Beste," een halve zin; "Beste klant" leest als bedoeld.
  const greeting = name ? `Beste ${esc(name)},` : 'Beste klant,'
  const biz = esc(input.businessName)
  const link = esc(input.reviewLink)
  const unsub = esc(input.unsubscribeUrl)

  const subject = `Hoe was uw ervaring met ${input.businessName}?`

  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.6">
        <tr><td>
          <p style="margin:0 0 16px">${greeting}</p>
          <p style="margin:0 0 16px">Bedankt dat u voor <strong>${biz}</strong> heeft gekozen.</p>
          <p style="margin:0 0 16px">We zouden het enorm waarderen als u uw ervaring wilt delen met een Google-review. Het kost minder dan een minuut en helpt zowel ons als toekomstige klanten.</p>
          <p style="margin:0 0 28px">Uw eerlijke mening telt — of die nu positief is of niet.</p>
          <p style="margin:0 0 28px">
            <a href="${link}" style="display:inline-block;background:#1a44e8;color:#ffffff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:600">Review achterlaten</a>
          </p>
          <p style="margin:0 0 16px">Alvast hartelijk dank voor uw tijd!</p>
          <p style="margin:0 0 4px">Met vriendelijke groet,</p>
          <p style="margin:0"><strong>Team ${biz}</strong></p>
          <hr style="border:none;border-top:1px solid #eaeaea;margin:32px 0 16px">
          <p style="margin:0;font-size:12px;color:#8a8a8a">
            U ontvangt dit bericht omdat u recent klant bent geweest bij ${biz}.
            <a href="${unsub}" style="color:#8a8a8a">Geen berichten meer ontvangen</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = `${name ? `Beste ${name},` : 'Beste klant,'}

Bedankt dat u voor ${input.businessName} heeft gekozen.

We zouden het enorm waarderen als u uw ervaring wilt delen met een Google-review.
Het kost minder dan een minuut en helpt zowel ons als toekomstige klanten. Uw
eerlijke mening telt — of die nu positief is of niet.

👉 Review achterlaten: ${input.reviewLink}

Alvast hartelijk dank voor uw tijd!

Met vriendelijke groet,
Team ${input.businessName}

---
U ontvangt dit bericht omdat u recent klant bent geweest bij ${input.businessName}.
Geen berichten meer ontvangen: ${input.unsubscribeUrl}`

  return { subject, html, text }
}
