// Keep this email frame in sync with gtm-suite/lib/partner-portals/email-brand.ts.
// Shared Big Link email frame. Body HTML is assembled by trusted renderers, never user input.
export const BIG_LINK_EMAIL_BRAND_VERSION = 'big-link-website-v1'
export const BIG_LINK_EMAIL_LOGO = 'https://atlasengine.co.za/big-link-email-logo.png'
export const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function bigLinkEmailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td bgcolor="#181a42" style="background:#181a42;border:1px solid #181a42"><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:17px 28px;font-family:Manrope,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.3px;line-height:20px;color:#ffffff;text-decoration:none;mso-padding-alt:0"><!--[if mso]><i style="mso-font-width:140%;mso-text-raise:22pt" hidden>&nbsp;</i><![endif]-->${escapeEmailHtml(label)}<!--[if mso]><i style="mso-font-width:140%" hidden>&nbsp;</i><![endif]--></a></td></tr></table>`
}

export function renderBigLinkEmail(input: { subject: string; label: string; heading: string; intro?: string; body: string }): string {
  const e = escapeEmailHtml
  return `<!doctype html>
<html lang="en-ZA" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${e(input.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700;800&display=swap');body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}table{border-collapse:collapse}img{border:0;outline:none;text-decoration:none}p{margin:0 0 18px}a{color:#181a42}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}@media only screen and (max-width:620px){.bl-outer{padding:16px 10px!important}.bl-pad{padding-left:24px!important;padding-right:24px!important}.bl-heading{font-size:32px!important;line-height:38px!important}}</style></head>
<body style="margin:0;padding:0;width:100%;background:#f3f4f6;color:#252832;font-family:Inter,Arial,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;color:#f3f4f6;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${e(input.intro || input.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f4f6"><tr><td class="bl-outer" align="center" style="padding:40px 16px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dfe2e7" data-big-link-email="${BIG_LINK_EMAIL_BRAND_VERSION}">
<tr><td class="bl-pad" bgcolor="#ffffff" style="padding:28px 40px"><img src="${BIG_LINK_EMAIL_LOGO}" width="148" height="52" alt="Big Link Consulting" style="display:block;width:148px;height:52px;max-width:100%;color:#12132f;font-family:Arial,sans-serif;font-size:16px;font-weight:bold"></td></tr>
<tr><td class="bl-pad" bgcolor="#12132f" style="padding:34px 40px 36px;background:#12132f;color:#ffffff">
<p style="margin:0 0 18px;font-family:Manrope,Arial,sans-serif;font-size:10px;font-weight:700;line-height:16px;letter-spacing:2.2px;text-transform:uppercase;color:#c4c6dc">${e(input.label)}</p>
<h1 class="bl-heading" style="margin:0;font-family:Manrope,Arial,sans-serif;font-size:38px;font-weight:800;line-height:44px;letter-spacing:-1.2px;color:#ffffff">${e(input.heading)}</h1>
${input.intro ? `<p style="margin:18px 0 0;max-width:450px;font-size:15px;line-height:25px;color:#e9eaf4">${e(input.intro)}</p>` : ''}</td></tr>
<tr><td class="bl-pad" bgcolor="#ffffff" style="padding:32px 40px 24px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:25px;color:#252832;overflow-wrap:anywhere">${input.body}</td></tr>
<tr><td class="bl-pad" bgcolor="#ffffff" style="padding:0 40px"><table role="presentation" width="100%"><tr><td style="border-top:1px solid #dfe2e7;font-size:1px;line-height:1px">&nbsp;</td></tr></table></td></tr>
<tr><td class="bl-pad" bgcolor="#ffffff" style="padding:23px 40px 28px;font-family:Inter,Arial,sans-serif;font-size:11px;line-height:19px;color:#6d7280"><strong style="color:#181a42;font-size:12px">Big Link Consulting</strong><br><a href="https://biglinkconsulting.co.za" style="color:#6d7280;text-decoration:underline">biglinkconsulting.co.za</a></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
}
