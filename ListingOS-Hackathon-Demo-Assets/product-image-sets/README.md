# Product Image Fixtures

These folders are repeatable source-photo sets for recording, QA, and edit continuity. Each set contains four JPEGs and should be treated as test media, not as production inventory.

| Set | Product | Folder |
| --- | --- | --- |
| 01 | Compact camera | [`01-compact-camera`](01-compact-camera) |
| 02 | White electronics | [`02-white-electronics`](02-white-electronics) |
| 03 | Limitless book | [`03-limitless-book`](03-limitless-book) |
| 04 | Why Machines Learn book | [`04-why-machines-learn`](04-why-machines-learn) |
| 05 | USB-C adapter | [`05-usb-c-adapter`](05-usb-c-adapter) |
| 06 | Graded blue card | [`06-graded-blue-card`](06-graded-blue-card) |
| 07 | Graded yellow card | [`07-graded-yellow-card`](07-graded-yellow-card) |
| 08 | Leather wallet | [`08-leather-wallet`](08-leather-wallet) |
| 09 | Sunglasses | [`09-sunglasses`](09-sunglasses) |
| 10 | Wireless earbuds | [`10-wireless-earbuds`](10-wireless-earbuds) |
| 11 | Car charger | [`11-car-charger`](11-car-charger) |
| 12 | Lighter | [`12-lighter`](12-lighter) |

## Relationship to the QA matrix

**These folder numbers are not matrix row numbers.** The QA matrix in
[`../DEMO_TESTING_NOTES.md`](../DEMO_TESTING_NOTES.md) indexes draft *records*, not fixtures,
and the two lists diverge:

- Sets `11-car-charger` and `12-lighter` were **never run** through the matrix.
- The matrix includes an `Only Mostly Devastated` paperback that has **no fixture folder**.
- Matrix rows 3 and 11 are a misrouted run and a duplicate record, not distinct products.

Cross-reference by product name, never by number.

## Usage

- Use one product set per capture session so the generated listing remains easy to verify.
- Keep the original four-image structure when comparing camera, upload, and AI behavior.
- Do not infer marketplace support from a fixture name; follow the app's documented truth boundary.
- `DEMO_VIDEO_SCRIPT_V2.md` uses all 12 sets as a montage at 0:22–0:40 and as a grid at 2:38.
  The montage is a Track B overlay built from these files — see `../PRODUCTION_PLAN.md` §3.
- These are resized test copies and will trigger small-image warnings. Production capture
  must preserve the original camera asset.
