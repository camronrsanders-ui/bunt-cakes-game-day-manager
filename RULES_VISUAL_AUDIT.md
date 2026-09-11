# Rules and visuals audit — September 11, 2026

Status: captain disclosure and v1 accuracy notices are ready for release. Corrected v2 content is in review on an isolated Neon branch. It is NOT active in production. Published v1 content and historical game bindings were not modified.

## Three checks

1. Compared all 12 stored rule summaries and 13 ruling scenarios with the March 17, 2026 Boston rulebook. Downloaded and inspected both pages of the official umpire call-sign sheet; all seven stored signal instructions agree.
2. Checked all nine diagrams against rule conditions, event timing, base coordinates, and final runner placement. Rebuilt the 27 panels as explicit examples.
3. Ran diagram renderer/geometry checks and inspected rendered SVG panels. Corrected clipping of boundary labels, oversized arrowheads, duplicate marker IDs, regions obscuring the ball, and non-collinear foul lines. Native disclosure lifecycle checks passed. Actual mobile browser interaction remains unverified.

## Findings

| Scenario | Finding / correction |
| --- | --- |
| Adjacent infield | Award correct. Example now follows a runner from first toward second, then through third to home. Outfield entry is a different rule. |
| Fair/foul | Summary omitted 10.3(c)/(d) fielder-touch exceptions. Diagram now explicitly depicts an untouched grounded ball before first. |
| Encroachment | First warning is unconditional; a do-over requires defensive benefit. Restriction line now connects actual first and third bases. Pitcher/catcher have additional positioning requirements. |
| Force out | Force begins on an uncaught fair landing. Defender now visibly occupies second base with the ball before the runner. |
| Four balls | Four-ball first-base award correct; intentional-walk exception retained. |
| Four fouls | Independent four-foul out correct. |
| Intentional walk | Four initial consecutive balls plus clear avoidance, second-base award and forced advances agree. |
| Out-of-bounds overthrow | Award correct; diagram now shows the runner's actual destination. Timing is when play ends. |
| Playable overthrow toward first | Added fields 5/6 and more-than-15-feet condition; initial second-base cap is at risk and further advancement requires continued defensive play. |
| Unsafe-area overthrow | Target-only award correct; diagram shows runner reaching second. An accessible ball merely leaning against an obstruction is not automatically dead. |
| Strike zone | Must check 9.2 pitch requirements before an un-kicked overlap is a strike. Replaced flat field box with labeled front elevation; schematic, not a measured field layout. |
| Tag-up | Distinguished leaving early from failing to retouch on a caught fly; fair first-touch versus foul completed-catch timing retained. Example now begins on first and ends in an explicit failed-retouch out. |
| Three strikes | Three-strike out with independent fouls correct. |

The existing `official_text` fields are paraphrases. UI now labels them rule summaries, not verbatim official rules. Source-backed does not mean the league endorsed this application.

## Release controls

- v1 diagram output is withdrawn pending replacement verification; affected rulings carry source-review notices.
- v2 seed transaction passed on the isolated branch: 12 rules, 13 scenarios, 9 visuals, 7 signals.
- v2 does not alter count settings, team bindings, or the existing immutable game binding.
- Before activation: complete mobile Rules & Calls UX, runtime search/detail and game-binding checks, and required engineering reviews per `RULES_CALLS_IMPLEMENTATION_GUARDRAILS.md`.
- Existing game-bound v1 must not be silently rebound to v2; its notices remain applicable.

## Sources

- [Boston rulebook, updated March 17, 2026](https://docs.google.com/document/u/1/d/e/2PACX-1vQ9OBOHo_OxrX3U46sTHYxStc21qJearXIKuRpZ-FuEWlCXSyCg3nqs5co3zdjUKeVQ_7oELo7-nuKH/pub?pli=1)
- [Official umpire call signs](https://drive.google.com/file/d/1L9KTT58ZPBS0crAA8qpNakbf33KbwneX/view)

The separate training video was not independently re-reviewed in this audit. The written rulebook controls the findings above.
