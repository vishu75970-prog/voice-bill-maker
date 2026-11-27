# Project memory

## Product intent & audience

- Voice billing web app for small shopkeepers who prefer speaking over typing.
- Speak item name + price (Hindi or English) to auto-build a clean, itemized bill with live total.
- Bilingual UI (Hindi/English) with full language toggle that also switches voice recognition locale (`hi-IN`/`en-IN`).
- Manual item entry as fallback when speech recognition is unavailable.

## Brand personality & voice

- Practical, fast, hands-busy shopkeeper tool — clarity and speed over flourish.
- Interface labels bilingual; keep Hindi phrasing natural for retail use.

## Visual design & UX direction

- Mobile-first; large tappable mic button as primary action.
- Sticky bottom bar showing live total + Save action for thumb reach.
- Item list supports per-item delete and clear-all; saved bills shown in a Bill History screen with print and delete.
- Language toggle (हिं/EN) placed top-right, prominent.
- Print support for bills (browser print).

## Decisions, constraints & rationale

- Stack: Vite + React, Tailwind CSS, Lucide React icons; `@/` alias maps to `src/`.
- Persistence via Supabase; single `bills` table; single-tenant (no sign-in).
- Voice parsing handles Devanagari digits, spoken number words (English + Hindi), currency words, quantity, and filler words.
- Browser SpeechRecognition used directly (no extra packages); works best in Chrome on Android/desktop; Safari/Firefox may lack support → manual fallback shown.
- Mic permission requested on first tap.

## Open questions & assumptions

- Assumed no multi-tenant/auth; revisit if shopkeeper accounts needed.
- Bill customization (tax, discounts, shop name/header, GST) not yet specified.
- Offline/local persistence not addressed; assumes online Supabase.
- Print format / receipt paper width not specified.