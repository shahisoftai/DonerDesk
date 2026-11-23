# Phase 64 — the field app, designed for the person in the field (2026-11-23, branch `0025-place-tree`)

**Owner's brief:** design the field app nicely and very user-friendly, because field workers get confused fast. Greet them, show their projects, their work for the day and the week, the form, and everything needed. A field worker who signs in on a phone should land in it.

## Who it is for and what that means
A field officer on a phone, often with a poor signal, in sun, with one hand, maybe on a shared phone, maybe reading Urdu, Pashto, Arabic or French rather than English. They must never wonder "what do I do now?" or "did my work get saved?".

## Design rules (each is checked by a test or a screen check)
1. **One next thing.** The first card on the screen is the single most important task (a started visit, then an overdue one, then the next due). One big button.
2. **Plain words, short sentences.** "Get my work", "Start visit", "Saved on this phone", never "pack", "sync", "assessment record", "outbox".
3. **Always say where the work is.** A status line on every screen: online, or "No signal: your work is kept on this phone", and "All sent" or "2 waiting to send".
4. **Big, calm, high contrast.** Targets at least 48 px, body text 17 px or more, one column, icons always with words, colour never the only signal.
5. **Never lose work, and say so.** Saving says where it went; leaving a half-filled form is safe (a draft); signing out warns what it removes.
6. **Their language, one tap.** The language switch is in the header on every screen.
7. **No dead ends.** Every empty state says what to do next with one button.
8. **Works offline from the phone's own storage**: everything on screen comes from the downloaded work; the page itself holds no data (kept by the service worker).

## Screens (one page `/field`, tabs at the bottom)
```
Today (default)                       My week                 Waiting                  Me
┌──────────────────────────┐          Mon 24  2 visits        Saved on this phone     Pasha Piracha
│ Good morning, Pasha      │          Tue 25  1 activity      ● Phone test form       Projects ready on
│ Monday 24 November       │          ...                       Waiting to send         this phone
│ ● Online · All sent      │                                  [Send now]              [Refresh]
├──────────────────────────┤          Overdue                 Sent today ✓             Language
│ NEXT                     │          ...                                              Home (online)
│ Visit Chakdara hospital  │                                                           Sign out
│ Due today · Dir Lower    │
│ [   Start visit   ]      │
├──────────────────────────┤
│ Given to you (3)         │
│  Madyan  due in 2 days > │
│  Lakki Marwat  4 days  > │
├──────────────────────────┤
│ Today's work             │
│ [Something we did]       │
│ [A photo or file]        │
├──────────────────────────┤
│ Your projects            │
│ KP assessment  Ready ✓   │
└──────────────────────────┘
 Today · My week · Waiting (2) · Me
```
- **First time (no work on the phone yet):** a single card, "Get your work ready", with one button **Get my work**. It downloads every project the person is on; no project picker.
- **A started visit** (a draft exists) says **Continue** instead of **Start**.
- **Filling a form** keeps the existing section-by-section filler; the header has **← Today** and the facility's name; the tab bar hides while filling.
- **Refresh**: when online and the work on the phone is older than a day it is refreshed quietly; **Refresh** on Me does it on demand.

## Batches
| Batch | What |
|---|---|
| 64.0 | This plan |
| 64.1 | Pure logic (`field-today.ts`): greeting by hour, first name, "due" wording codes, today's tasks from the downloaded work (visits given, planned work), the single next task, the week by day; table-tested |
| 64.2 | Screens: shell with bottom tabs, Today, My week, Waiting, Me; "Get my work" one-tap; the visit starts from a card (`initialPlaceId`); quiet refresh; copy in en, fr, es, ar (typed catalogue) |
| 64.3 | Arrival: a field officer on a phone lands on `/field` after sign-in (a `Home (online)` link is always on Me); an install icon "DonorDesk Field" opens `/field` (own manifest) |
| 64.4 | Photo questions shrink the picture before it is saved or sent (the form limit is 5 MB; phone photos are often larger) |
| 64.5 | Tests, a phone-sized visual check with screenshots as a throwaway field officer, deploy |

## Not in this phase
Notifications, the full work plan and the map stay on the online Home. A real-phone, real-signal-loss test is the owner's (see `pending.md`).
