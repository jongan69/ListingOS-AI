# ListingOS UI Improvement Execution Plan

Status: Ready for implementation  
Owner: Primary implementation agent  
Target platforms: iOS, Android, and proof web  
Created: 2026-07-21

## Objective

Refine ListingOS into a focused, accessible camera-to-review-to-eBay-publish workflow while preserving its existing visual identity, proof-mode safety, and seller recovery states.

The primary success condition is that a seller can understand, review, and publish a draft without navigating an excessively long page, encountering obscured controls, or having to distinguish between several equally prominent destinations.

## Product principles

- Keep the primary journey camera or photos -> queue -> review -> eBay publish.
- Keep seller input minimal and make required recovery work explicit.
- Preserve phone camera, photo library, and supported external-camera capture sources.
- Keep Proof Mode visibly non-mutating and isolated from live seller state.
- Treat fixed-price eBay publishing as the verified default.
- Preserve the current cyan and teal brand direction.
- Prefer progressive disclosure over removing useful evidence.

## Non-goals

- Do not redesign the ListingOS brand.
- Do not change Worker contracts unless a UI requirement genuinely needs new data.
- Do not implement auction publishing.
- Do not perform a production eBay publish as a routine UI test.
- Do not weaken Proof Mode's non-mutating boundary.
- Do not expand ListingOS Market functionality during this work.
- Do not restructure unrelated application architecture.

## Required preparation

Before editing:

1. Read `README.md`, `docs/ARCHITECTURE.md`, and the relevant Expo SDK 57 documentation.
2. Inspect the complete worktree and preserve unrelated modifications.
3. Confirm the current mobile/Worker contract in `src/shared/contracts.ts` before changing any cross-runtime data shape.
4. Capture baseline screenshots at:
   - Web widths of 320, 390, 430, and a representative tablet width.
   - A small Android emulator or physical device.
   - A standard iPhone simulator or physical device.
   - Dark and light themes where supported.
5. Record the baseline review-page height, footer height, horizontal overflow, and touch-target violations.
6. Run the baseline validation commands and record any pre-existing failures.

## Slice 1: Repair the review action footer

Priority: P0  
Owner: Primary implementation agent  
Primary files:

- `src/components/app-screen.tsx`
- `src/screens/draft-detail-screen.tsx`

### Objective

Ensure review content is never obscured and present one unmistakable primary action.

### Work

- Replace the multi-button live footer with:
  - One contextual primary action: Publish to eBay, View live listing, or the relevant disabled state.
  - One compact secondary menu for Copy, Share, and ListingOS Market beta actions.
  - Clear validation and publishing progress.
- Replace the fixed footer-clearance assumption with clearance based on the actual rendered footer height.
- Preserve bottom safe-area and keyboard behavior.
- Keep the Proof Mode non-mutation state visible without allowing it to dominate the screen.
- Ensure the final content card can always scroll fully above the footer.

### Interfaces and dependencies

- No API contract change is expected.
- Preserve all existing export, share, Market beta, and eBay handlers.
- Preserve `AppScreen` keyboard-aware behavior for every existing consumer.

### Acceptance criteria

- The footer shows no more than one primary full-width action.
- The footer remains under approximately 96 points plus the bottom safe area.
- The final content card scrolls completely above the footer.
- Opening the keyboard does not cover the focused field or primary action.
- Copy, Share, Market beta, and eBay publishing remain reachable.
- Proof Mode cannot trigger a live mutation.

### Validation

Test draft loading, blocked, publish-ready, publishing, published, canceled, and failed states. Repeat with the keyboard open and with VoiceOver or TalkBack enabled.

## Slice 2: Restructure review information architecture

Priority: P0  
Owner: Primary implementation agent  
Dependency: Slice 1

### Objective

Reduce the default review path while retaining evidence and advanced seller controls.

### Target hierarchy

1. Listing summary: photos, title, price, confidence, and publish state.
2. Required fixes, when present.
3. Publish-readiness summary.
4. Pricing choice and seller override.
5. Listing details.
6. Collapsed evidence and advanced tools.

### Work

- Keep blockers above all optional analysis.
- Combine overlapping pricing-readiness and pricing-trust messaging.
- Move the following into a collapsed evidence section:
  - Accepted and rejected comparable details.
  - Opportunity audit breakdown.
  - Why this draft.
  - Marketplace remix.
  - Detailed scoring limitations.
- Show concise summaries before disclosure, such as:
  - 4 accepted / 6 rejected.
  - 84% pricing confidence.
  - 89/100 listing strength.
- Keep editable title, price, condition, required specifics, and description easy to reach.
- Ensure expanding or collapsing advanced sections does not reset unsaved state.

### Interfaces and dependencies

- Reuse the existing draft and comparable data.
- Do not modify `src/shared/contracts.ts` unless a required display state is genuinely unavailable.
- Preserve autosave, blocker resolution, verification, and proof-scenario behavior.

### Acceptance criteria

- The default publish-ready review path is materially shorter than the current approximately 7,400-pixel proof page.
- Readiness, price, listing summary, and the publish action are understandable without opening detailed comparable rows.
- Blocked drafts lead directly from the blocker to the necessary field and resolution action.
- No existing evidence or capability is removed.
- Proof Mode still demonstrates trust gates and stored evidence clearly.

## Slice 3: Enforce accessible control sizing

Priority: P0  
Owner: Primary implementation agent

### Objective

Make every important action reliably usable by touch, switch control, VoiceOver, and TalkBack users.

### Work

- Make every interactive control at least 44 by 44 points or provide an equivalent, non-overlapping hit area.
- Prioritize:
  - Camera Review and Done buttons.
  - Grid, light, flash, flip, and zoom controls.
  - Photo reorder and remove controls.
  - Pricing strategy buttons and shortcut chips.
  - Queue actions.
  - Web refresh control.
- Avoid relying on tiny text as the only control affordance.
- Preserve camera viewport space by enlarging hit areas before enlarging visible chrome.
- Add or improve accessibility labels, hints, selected state, disabled state, and live-region announcements where needed.

### Acceptance criteria

- No active control has an effective target smaller than 44 by 44 points.
- Hit areas do not overlap neighboring actions.
- Camera actions remain usable one-handed.
- Controls survive maximum practical font scaling without clipping.
- Accessibility focus follows the visible interface.
- State is conveyed with text or semantics and not color alone.

## Slice 4: Correct theme and contrast inconsistencies

Priority: P0  
Owner: Primary implementation agent  
Primary files:

- `src/theme/palette.ts`
- Theme-aware screens and components

### Objective

Make both themes visually coherent and meet accessible contrast requirements.

### Work

- Replace hard-coded dark surfaces in theme-aware screens, especially the dashboard queue card.
- Add or formalize semantic tokens for:
  - Primary surface.
  - Elevated surface.
  - Interactive surface.
  - Selected surface.
  - Primary, secondary, and tertiary text.
  - Accent text.
  - Disabled text and surface.
  - Borders and separators.
- Increase light-theme `textSoft` and accent contrast where used for small text.
- Keep hard-coded camera colors only where the camera deliberately uses an always-dark interface.
- Test glass and translucent surfaces over every supported background.

### Acceptance criteria

- Normal text meets a 4.5:1 contrast ratio.
- Large text and meaningful graphical controls meet a 3:1 contrast ratio.
- Queue cards remain readable in both themes.
- Disabled controls remain recognizable without appearing active.
- No theme-aware component assumes that white transparency works on every background.

## Slice 5: Fix responsive overflow

Priority: P1  
Owner: Primary implementation agent  
Dependency: Slice 2

### Objective

Eliminate unintended horizontal overflow and fragile narrow-screen layouts.

### Work

- Fix the seller-price input using appropriate `minWidth`, flex-shrink, and width constraints.
- Audit all horizontal rows at 320 through 430 points:
  - Header actions.
  - Price controls.
  - Strategy choices.
  - Status pills.
  - Queue actions.
  - Marketplace listing actions.
  - Footer menus.
- Allow wrapping only where it preserves clear grouping.
- Reserve horizontal scrolling for media rails and similarly intentional content.
- Verify tablet centering and maximum content width.

### Acceptance criteria

- No unintended horizontal overflow exists at supported widths.
- The price input stays visible while entering long or localized values.
- Text enlargement does not push controls outside the viewport.
- Tablet layouts remain centered and readable.

## Slice 6: Restore focus to the seller workflow

Priority: P1  
Owner: Primary implementation agent

### Objective

Make the principal seller workflow unmistakable and move experimental functionality out of the critical path.

### Work

- Remove Preview ListingOS Market beta from the primary capture CTA stack.
- Remove Market beta publishing from the main sticky-action hierarchy.
- Place Market beta behind a clearly labeled experimental destination such as More, account tools, or an overflow menu.
- Preserve the feature and routes without expanding them.
- Reinforce the primary hierarchy:

  **Capture -> Queue -> Review -> Publish to eBay**

### Acceptance criteria

- Home has one dominant connect or capture action.
- Review has one dominant eBay publish action.
- Market beta remains accessible but visually secondary.
- No copy implies Market beta is required to complete an eBay listing.

## Slice 7: Navigation and platform polish

Priority: P2  
Owner: Primary implementation agent  
Dependency: Core P0 and P1 slices complete

### Objective

Align deep-screen navigation with platform conventions without sacrificing necessary ListingOS branding.

### Work

- Evaluate replacing custom deep-screen headers with native Expo Router stack headers.
- Preserve custom branding only where it adds clear product value.
- Verify iOS back gestures, Android system back, deep-link entry, and route titles.
- Use native sheets or menus for secondary actions where appropriate.
- If native headers create unacceptable regressions, document the decision and retain the current header.

### Acceptance criteria

- Back behavior is consistent from every route.
- Deep-linked draft and batch screens have valid navigation exits.
- Headers do not duplicate page titles.
- Safe areas remain correct on Dynamic Island and Android cutout devices.

## Validation matrix

Run after every merge-safe slice:

```bash
npm run check
```

Run after routing, dependency, layout-shell, or native-facing changes:

```bash
npm run export:android
```

Final validation must cover:

- Proof web in dark and light themes.
- Web widths of 320, 390, 430, and a representative tablet width.
- A small Android layout and a standard iPhone layout.
- Maximum practical dynamic text.
- VoiceOver and TalkBack focus order.
- Keyboard interaction with every editable field.
- Loading, blocked, ready, publishing, published, canceled, and failed draft states.
- Camera permission denied, camera starting, capture, review, reorder, remove, error recovery, and completion.
- Proof Mode mutation safeguards.
- Screenshot comparison against the baseline.

Do not use a production eBay publish. Use Proof Mode, local fixtures, and non-mutating validation paths for routine testing.

## Suggested commit and merge order

1. `fix(ui): make review footer content-safe`
2. `refactor(ui): simplify draft review hierarchy`
3. `fix(a11y): enlarge interactive touch targets`
4. `fix(theme): normalize light and dark surfaces`
5. `fix(web): remove narrow viewport overflow`
6. `refactor(ui): de-emphasize market beta`
7. `refactor(nav): align deep screens with native navigation`
8. `docs(ui): record validation results and remaining device gates`

Each commit must pass its required validation independently. Do not combine unrelated slices into one large patch.

## Risks and rollback

### Review restructuring

Risk: Important evidence becomes hard to find.  
Mitigation: Preserve all evidence behind clear disclosures and show compact summaries by default.  
Rollback: Revert the information-architecture commit without reverting footer safety work.

### Footer measurement

Risk: Keyboard or safe-area regressions.  
Mitigation: Test every footer state with the keyboard open and closed on both native platforms.  
Rollback: Keep the old clearance behavior isolated in the footer commit for one-step reversion.

### Larger touch targets

Risk: Reduced camera preview height.  
Mitigation: Expand invisible hit areas before increasing visible chrome.  
Rollback: Revert individual control groups without reverting accessibility semantics.

### Theme tokens

Risk: Broad visual changes across unrelated screens.  
Mitigation: Introduce semantic tokens first and migrate one surface at a time.  
Rollback: Revert each token migration independently.

### Native-header migration

Risk: Late navigation and visual regressions.  
Mitigation: Keep this as the final optional slice.  
Rollback: Retain the existing custom toolbar until native behavior is fully verified.

## Deliverables

- Merge-safe implementation commits in the stated order.
- Before-and-after screenshots for every target viewport and theme.
- A short accessibility validation report.
- A completed state matrix for review, queue, camera, and Proof Mode.
- Documentation of any deferred physical-device or external-account gates.
- A final release-readiness status with supporting evidence.

## Completion definition

Readiness is green only when:

- Every P0 acceptance criterion passes.
- No content is obscured by the footer.
- Review-page length and cognitive load are materially reduced.
- Touch-target and contrast checks pass.
- Web and Android exports succeed.
- At least one iOS and one Android native flow are visually verified.
- Proof Mode remains visibly non-mutating.
- No production eBay listing was created during testing.

Until those conditions are met, UI readiness remains yellow.
