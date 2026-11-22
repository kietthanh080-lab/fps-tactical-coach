---
version: 1.5.0
name: Tactical Telemetry HUD
description: High-contrast tactical eSports replay and post-match coaching cockpit for VALORANT and PUBG.
colors:
  substrate: "#0A0D12"
  surface: "#10141C"
  surface-elevated: "#171D28"
  border-hairline: "#232B3B"
  border-strong: "#334155"
  text-primary: "#EEF2F6"
  text-secondary: "#94A3B8"
  text-muted: "#64748B"
  primary: "#FF4655"
  secondary: "#E59A23"
  positive: "#10B981"
  danger: "#F43F5E"
  info: "#38BDF8"
typography:
  display-hero:
    fontFamily: Chakra Petch
    fontSize: 44px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Chakra Petch
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Chakra Petch
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.01em
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0em
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  telemetry-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.06em
rounded:
  none: 0px
  xs: 2px
  sm: 4px
  md: 6px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-valorant:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-pubg:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.substrate}"
    rounded: "{rounded.sm}"
    padding: 12px
  panel-cockpit:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: 16px
---

# TacticalReplayAI - Tactical Telemetry HUD

## Overview
TacticalReplayAI is a post-match desktop replay and tactical coaching cockpit for competitive VALORANT and PUBG players running on Overwolf and Electron. The visual language rejects generic soft SaaS rounded boxes and AI-purple gradients in favor of a sharp, mechanical dark-substrate telemetry cockpit inspired by military rangefinders and tournament broadcast HUDs.

## Colors
- **Substrate (`#0A0D12`):** Off-black obsidian base replacing pure `#000000` to preserve depth and reduce eye fatigue.
- **Surface & Elevated (`#10141C` / `#171D28`):** Layered slate-charcoal panels separated by 1px structural borders (`#232B3B`).
- **Theater Accents:** Single active theater accent per mode - Signal Crimson (`#FF4655`) for VALORANT, Ballistic Amber (`#E59A23`) for PUBG.
- **Semantic Status:** Tactical Emerald (`#10B981`) strictly for wins, kills, and positive verification; Crimson Rose (`#F43F5E`) for deaths and errors; Telemetry Sky (`#38BDF8`) for informational notices.
- **Purple Ban:** Purple, violet, indigo, and magenta are strictly prohibited across all UI surfaces, badges, and gradients.

## Typography
- **Display (`Chakra Petch`):** Geometric, chamfered-feel display typography with Vietnamese support, fluid `clamp()` sizing on hero titles, and tight negative tracking.
- **Body (`Be Vietnam Pro`):** Clean, legible Vietnamese body copy constrained to readable measure (`max-w-[65ch]`).
- **Telemetry (`JetBrains Mono`):** Enforced `tabular-nums` for all scores, K/D/A readouts, timestamps, DPI/eDPI, and damage metrics.

## Layout
- **Landing / Auth View:** Single-line top bar (`<= 64px`), asymmetric `7/5` split composition inside `max-w-7xl` fitting cleanly within `min-h-[100dvh]`, pairing the player lookup terminal on the left with dual theater access modules on the right. Collapses cleanly to 1 column below `1024px`.
- **Authenticated Cockpit:** Single-line `60px` command header followed by a responsive 12-column tactical workspace (`3 / 6 / 3` on desktop `lg:` and up; stacked vertically on narrow screens).

## Elevation & Depth
- Flat-layered tonal contrast (`#0A0D12` -> `#10141C` -> `#171D28`) with crisp `1px` borders (`#232B3B`) and subtle corner reticle accents rather than heavy blur-only cards or drop shadows.
- Subtle fixed pointer-events-none tactical grid texture on the landing substrate.

## Shapes
- Precision mechanical geometry: sharp `2px-4px` corner radii (`rounded-sm` / `rounded`) consistently across buttons, inputs, panels, and badges. Zero soft `rounded-2xl` consumer blobs.

## Components
- **Icons:** Strictly `@phosphor-icons/react` (except official Steam and Riot Games brand marks on OAuth buttons).
- **Motion:** `motion/react` spring transitions for panels, modals, and list entry, strictly honoring `useReducedMotion()` and CSS `prefers-reduced-motion`.
- **States:** Explicit skeletal loading bars, composed empty views, inline validation/errors, and physical `:active` press feedback (`active:translate-y-[1px]`).

## Do's and Don'ts
- Do use `JetBrains Mono` with `tabular-nums` for every match metric, K/D/A, and timer.
- Do lock the active accent color to the selected game theater (VALORANT vs PUBG).
- Do keep all buttons single-line on desktop with WCAG AA contrast.
- Don't use em-dashes (`—`) or en-dashes (`–`) anywhere in visible copy; use standard hyphens (`-`) or colons (`:`).
- Don't use purple, violet, or indigo classes anywhere in the codebase.
- Don't hand-roll generic UI icons with raw `<svg>` paths.
