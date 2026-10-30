# The house style

This page is the decision cache for BelType's prose: the manual, the package READMEs, CLAUDE.md and the comments. It adapts the Write the Docs skeleton, and the reasons are in [the manual is written in four kinds](../.claude/decisions/project/the-manual-is-written-in-four-kinds.md).

## Voice per kind

- **Tutorial**, the guide. Teacher and learner together, concrete, even playful: "we will…", "now you have…".
- **How-to**, the how-to chapter. Conditional imperatives, steps only: "to do X, do Y".
- **Reference**, the syntax and reference chapters. Neutral present tense, austere: "`--port` takes an integer". Never "you should".
- **Explanation**, the architecture, configuration and repos chapters. It argues: context, alternatives, why.
- **README chapter**. What the package is, then its members. Each section leads with its point.
- **Comment**. The contract first, then the reason that still binds. History lives elsewhere.

## Sentences

- Keep a chapter's average sentence under 25 words. A sentence of 40 words is the alarm.
- Write one idea per sentence.
- Put the point first.
- Put the condition before the instruction: "if the page is blank, check the engine".
- Use the active voice, and the second person for the reader.
- Use an em-dash only where neither a colon nor a full stop serves.

## Words

- Never write `just`, `simply`, `easy`, `easily`, `obviously`, `powerful`, `seamless` or `please note`. State the fact.
- Use one term per concept, the one the code uses. The resolved document is never "the output".
- Gloss a coined word at first use: the spine, the chain from a source line to a node.
- HTML, CSS, PDF, CLI, API, JSON and npm need no gloss. Spell out any other at first use.

## Headings and links

- Headings are in sentence case, with no end punctuation.
- A heading text is unique across the whole manual.
- Link text describes its target, as in [the decisions index](../.claude/decisions/project/README.md). It is never "here".

## Names and numbers

- A measured value is a value, written as measured.
- A decision is cited by its name and linked to its file: [the seat is not the engine](../.claude/decisions/project/the-seat-is-not-the-engine.md).
- A ledger proposition or a probe is cited name first, number beside: *the conservation of words* (S61). A bare `S61` or `P15` is a finding.

## Capitals

A run of capitals is a proper name from this roster, and nothing else. It appears at its definition site and its first mention in a file. Capitals never carry emphasis: `MUST`, `NEVER` and `IS VERSION-KEYED` become sentences that lead with the point. The test for a name is that a second file refers to it by those words; a run only its own file uses is a heading, and becomes a sentence. A new name joins the roster in the commit that defines it, with the second file that earns it.

- **common**: THE ENGINE SEAM.
- **core**: THE HOST, THE CASCADE, THE VENUE, THE CLOSURE, THE LINKER, THE URL ROOT, THE LINE-MAP, THE NODE-MAP, THE SPINE, THE RESOLVED DOCUMENT, THE COMPOSITION CONFIG, THE STAMP GATE, THE OPERATOR'S LAYERS, THE HTML LANE.
- **cli**: THE CHANGE FEED, THE CASTER ROUTE, THE PRINT DEFAULT FACES.
- **editing-tools**: THE DESK, THE UI PRESET, THE TRUST BOUNDARY, THE TWO-CLOCK DISCRIMINATOR, THE OVERRIDES DOCUMENT.
- **caster**: THE CONSERVATION OF WORDS, THE TILING INVARIANT, THE SECOND MOMENT OF REIFICATION, and the section label WHAT THE PORT CHANGED.
- **engine-cicero**: THE ADDRESS, THE RESUME TREE, THE WORDS SHEET, THE READS, THE RIM, THE INTAKE, THE PAGE AREA, THE MAKE-UP ORDER, THE `data-beltype` REGISTRY.

Measured 2026-10-17 with `git grep -l -F`: eleven runs the first census listed as names are used by one file only. They are THE VIRTUAL FRONTMATTER LOCATION, THE VENUE PROBE, THE REFUSAL LIST, THE PUBLISHED SLICE, THE NODE HOST, THE WRITE DOOR, THE LIVE PASSES, THE ENCODING CONTRACT, THE CAST-OFF, THE ROLLING READ-AHEAD, THE TSDOC HOUSE CONVENTION. Each is a heading, and the comment steps turn it into a sentence.

## Comments

- A comment opens with one summary sentence.
- `@remarks` holds the rationale that still binds and the measured facts, dated: `Measured 2026-09-14: …`.
- JSDoc tags carry the types and no prose: `{T}`, `@typedef`, `@property`, `@type`, `@template`, `@satisfies`, `@import`.
- Never restate a type in prose. A tag with nothing to say is left out.
- A header, tagged `@packageDocumentation`, says what the module is, which members are its API, and the rationale that still binds. It carries at most one `@example`, for the simplest case.
- History leaves the header for the CHANGELOG, under its date, or for the decision record that owns it. A dated citation stays behind: `see CHANGELOG 2026-07-18`.
- Nothing leaves a header before it has landed somewhere `grep` reaches.

The tags in use, from the census of 2026-10-17, and what each holds. Prose tags: `@remarks` (rationale that binds, measured facts), `@param name - sentence`, `@returns`, `@throws` naming the `BelTypeError` subclass, `@defaultValue`, `@see` (a greppable citation), `{@link}`, `@internal`, `@example` (once per header at most), `@packageDocumentation`. Type tags, no prose: `{T}`, `@type`, `@typedef`, `@property` (the one line where type, name and the member's own sentence meet), `@template`, `@satisfies`, `@import` (never an inline `import('…')`), `@callback`, `@this`, `@implements`, `@extends`. Checker directives: `@ts-expect-error <reason>` only; `@ts-ignore` never (the thirteen that exist are in one essay probe, outside this round). A tag not in this list is a question before it is written.

## Enforcement

[`manual.test.js`](test/manual.test.js) runs in the docs package's `npm test` and checks these today:

- the manual builds;
- every link inside the manual lands;
- no heading text repeats;
- no heading id starts with a digit;
- every demonstrated construct renders, and no `:val` or at-rule is left unresolved;
- every file, member and signature the reference's module section names agrees with the code ([`reference-drift.test.js`](test/reference-drift.test.js)).

`npm run prose` runs Vale (`brew install vale`) over the chapters, the READMEs, the root README and this page, with the one house style in `.vale/styles/BelType`, five rules and no package synced at run time:

- the banned words, an error (`Banned`);
- link text that says "here", an error (`LinkHere`);
- end punctuation in a heading, an error (`HeadingPunctuation`, from the Microsoft package);
- a sentence over forty words, a warning, the alarm (`SentenceLength`, from the Microsoft package with the limit raised to forty);
- a heading not in sentence case, a warning until the manual's chapter titles are ruled on (`Headings`, from the Microsoft package with the house's names as exceptions).

A chapter's average sentence length is not a Vale question; [`measure.mjs`](../.claude/plans/docs-overhaul/measure.mjs) answers it. The comment steps count capitals and bare citations with `grep`. Reading checks the rest.
