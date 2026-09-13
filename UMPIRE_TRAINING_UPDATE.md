# Umpire reference update — September 13, 2026

The captain and assigned-player console opens a searchable Fall 2026 reference with 25 ruling cards, topic filters, worked examples, 10 three-panel diagram sets and direct source links. Captains can open it without an assignment. The saved-game Rules & Calls view remains separately accessible; no database versions, historical bindings, counts, or scores were migrated.

## Source review

Read the Fall 2026 Rules Presentation, SSB Kickball Rules file named Updated 8_23_26, and Overthrow Guide Final through the connected Drive account. The rulebook's internal footers still read July 14, 2026; the reference exposes that discrepancy without inventing a revision date.

- Rulebook: https://drive.google.com/file/d/1H7kk-rCtM3zOudMHPHVBh6_gpIInT8CW/view
- Training slides: https://docs.google.com/presentation/d/1P3oB_tEMecpWsMgnCP5163nIbIHfKymE/edit
- Field boundary diagrams: https://drive.google.com/file/d/1z-HMLh8lHgGX85vOBAPN7MoKxLdBlbwn/view
- Official signals: https://drive.google.com/file/d/1L9KTT58ZPBS0crAA8qpNakbf33KbwneX/view
- Training recording: https://drive.google.com/file/d/1r2O8EWHLNMwtCj0nzxbB7CVrTUMyggoO/view

The 3,494,855,080-byte recording exceeds the connector's 268,435,456-byte download limit. It is linked, not marked independently reviewed. Spoken-only guidance and timestamp indexing remain pending an accessible recording or transcript.

Written-rule precision overrides slide shorthand: one team-wide encroachment warning across types (5.2.4); fielder-kicked runner contact is automatically dead (7.8.1); general overthrows are subject to the fields 5/6 and 15-foot conditions (7.11.3). Fair/foul tag-up timing is illustrated separately. Original example diagrams are schematic and are not field-specific boundary maps; the official field guide is directly linked.

## Verification

- `node scripts/check-training-guide.cjs`: card coverage, source links, topic filters, natural-language search, rule-number queries, source distinctions and script load order.
- `node scripts/check-rules-visuals.cjs`: existing renderer/geometry checks.
- `node scripts/check-captain-disclosure.cjs`: closed-by-default and polling behavior.
- Local browser fixture mounts the real console with mock assignment data. It exercises mobile/tablet/desktop entry, search, every diagram, empty results, Back state, topic shortcuts, Escape and focus restoration. This does not verify authenticated production score writes.

The existing database runtime test requires an isolated DATABASE_URL/TEST_DATABASE_HOST; it was not run. This update does not change the backend.
