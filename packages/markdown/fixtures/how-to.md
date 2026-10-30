# How-to guides

Each entry here reaches one goal, in steps, for a reader who already knows the tool. To learn BelType from the start, read the [guide](#the-beltype-guide). To look up a construct or a key, read the [syntax](#syntax) chapter or the [reference](#the-beltype-reference).

## Extending the language

### How to define your own directive

Use this when a block or a run of text needs its own element and class, and the built-in callouts do not fit.

1. In the document's frontmatter, map the name to a tag and a class:

   ```yaml
   directives:
     theorem: { tag: div, className: theorem }
     kbd:     { tag: kbd, className: key }
   ```

2. Write the directive in the document: `:::theorem` … `:::` for a block, `:kbd[Ctrl+C]` for a run of text.
3. Style `.theorem` and `.key` in your stylesheet.
4. If every document in the venue should have the directive, write the mapping in `beltype.config.yaml` under `keys.directives.provide` instead:

   ```yaml
   $adopts: beltype:document

   keys:
     directives:
       provide:
         theorem: { tag: div, className: theorem }
   ```

A bare `directives:` at the top level of `beltype.config.yaml` is refused, because the venue file is a schema.

It worked if the rendered document holds `<div class="theorem">` where you wrote `:::theorem`.

See [naming your own](#naming-your-own) in the syntax chapter and the [`directives` key](#directives).

### How to add a custom syntax with a render module

Use this when a tag and a class cannot express the shape, and a few lines of JavaScript can.

1. In the frontmatter, give the directive a `render` instead of a tag:

   ```yaml
   directives:
     finance-card:
       render: finance-card    # → extensions/finance-card.js
   ```

2. Create `extensions/finance-card.js` in the project. Its default export receives the block's content as plain text, one line per paragraph, and returns HTML:

   ```js
   export default function financeCard(text) {
     const rows = text.split('\n').filter(Boolean).map((line) => {
       const [label, ...rest] = line.split(':');
       return `<tr><th>${label.trim()}</th><td>${rest.join(':').trim()}</td></tr>`;
     }).join('');
     return `<table class="finance-card">${rows}</table>`;
   }
   ```

3. Write the block in the document:

   ```markdown
   :::finance-card
   Revenue: 1.2M
   Growth: +14%
   :::
   ```

4. If the directive is inline (`:name[content]`), return an inline element: the content arrives as one continuous span, and a block element there nests wrongly.

It worked if the block renders as a two-row `table.finance-card`.

See [naming your own](#naming-your-own) and the [`directives` key](#directives).

### How to add remark and rehype plugins

1. If the plugin is a package, install it in the project with npm. If it is your own, save it as `extensions/<name>.js`.
2. If every plugin works on the Markdown, list them under `plugins`:

   ```yaml
   plugins: [remark-breaks]
   ```

3. If any plugin works on the HTML, name both stages:

   ```yaml
   plugins:
     remark: [remark-breaks]
     rehype: [[rehype-external-links, { target: _blank }]]
   ```

   An entry is a name, or a `[name, options]` pair.

It worked if the plugin's effect shows in the preview; a name the loader cannot find fails the build.

See the [`plugins` key](#plugins).

### How to turn a built-in feature off and reclaim its idea

Use this when one document needs `==…==`, or another built-in syntax, to mean something of your own.

1. In the frontmatter, switch the feature off by its registry name:

   ```yaml
   markdown:
     mark: false
   ```

   The characters now stay literal: `==plain literal text==` renders as written.

2. Bind a directive with a `render` for the meaning you want:

   ```yaml
   directives:
     hl: { render: hl }    # → extensions/hl.js
   ```

3. Create `extensions/hl.js`:

   ```js
   export default (text) => `<span class="reviewed">${text}</span>`;
   ```

4. Write `:hl[custom reviewed passage]` where the flagged span goes.

It worked if the span renders as `span.reviewed` and `==…==` stays literal. Giving the `==` characters themselves a new meaning needs your own remark syntax extension, a larger job than a `render` function.

See the [markdown plugin registry](#markdown-plugin-registry) for every name and its default.

## Text and structure

### How to number headings without breaking the document

A number typed into a heading (`## 1. Scope`) gives the heading an id that starts with a digit, and pagination dies at zero pages. Let CSS count instead.

1. Write the headings without numbers: `## Scope`.
2. Add the counters to your stylesheet:

   ```css
   body { counter-reset: h2 }
   h2 { counter-increment: h2; counter-reset: h3 }
   h3 { counter-increment: h3 }
   h2::before { content: counter(h2) ". " }
   h3::before { content: counter(h2) "." counter(h3) " " }
   ```

3. If the number must appear in the source anyway, give the heading a digit-free id of your own:

   ```markdown
   ## 1. Scope {#scope}
   ```

It worked if the headings show their numbers and the document paginates. Moving a section renumbers everything after it.

See [headings](#headings) and [nomination](#nomination).

### How to nest one container inside another

A `:::` closes at the first `:::` it meets, so a three-colon container cannot hold another.

1. Give the outer container four colons, on both its opening and its closing line:

   ```markdown
   ::::warning{title="Check the units"}
   The samples disagree.

   :::tip
   Convert both to SI before comparing.
   :::
   ::::
   ```

2. If you nest a third level, give the outermost five colons.

It worked if the tip renders inside the warning box.

See [the built-in directives](#the-built-in-directives).

### How to pass attributes to an at-rule

`@include` and `@toc` read only quoted attribute values.

1. Quote every value:

   ```markdown
   @include{src="./chapters/history.md" shift="+1"}
   @toc{depth="2" title="Contents"}
   ```

2. Put the at-rule alone on its line, with at most three spaces of indentation.

An unquoted value is not read: `@include{src=./x.md}` fails to include, and `@toc{depth=2}` sets nothing and warns.

It worked if the chapter appears in place and the contents page lists two levels.

See [assembly](#assembly) and [the contents page](#the-contents-page).

### How to put a class where nomination does not reach

A trailing `{.class}` attaches to headings, paragraphs, images and code fences. Blockquotes, list items, tables and horizontal rules take none: `> quoted {.q}` puts the class on the paragraph inside the quote.

1. Write the element as HTML, with the class on it:

   ```markdown
   <blockquote class="pull">
   The tern sees two summers a year.
   </blockquote>
   ```

2. If the block holds Markdown you want parsed, wrap it in a directive instead: `:::pull` … `:::`, bound as in [how to define your own directive](#how-to-define-your-own-directive).

It worked if the rendered element carries the class.

See [nomination](#nomination).

### How to refer to a section by its number

A bare `:ref` means a figure. To reference a heading, class the reference and answer it in CSS.

1. Number the headings with a counter that increments on the heading itself, as in [how to number headings](#how-to-number-headings-without-breaking-the-document). An increment on an ancestor such as `section:has(> h2)` reads as zero.
2. Write the reference with a class: `:ref[deployment]{.sec}`.
3. Add the rule for that class:

   ```css
   .xref.sec::before { content: "Section "; }
   .xref.sec::after  { content: target-counter(attr(href url), h2); }
   ```

Each kind of reference needs its own rule, because the counter name in `target-counter()` cannot be a variable.

It worked if the reference reads "Section 3" in print and on the site. The site reads it with Cicero's modules, so a published install without Cicero shows "Section Deployment", the target's name.

See [cross-references](#cross-references).

### How to make a cross-reference carry the target's words

1. If the words are a heading's text or a figure's caption, print the `data-ref-text` attribute the belt stamps on every resolvable `:ref`:

   ```css
   .xref.sec::after { content: " (" attr(data-ref-text) ")"; }
   ```

2. If you need the page number beside the words, use `target-text()` and `target-counter()`, scoped away from the contents page:

   ```css
   section a[href="#configuration"]::after {
     content: " (" target-text(attr(href url)) ", p. " target-counter(attr(href url), page) ")";
   }
   ```

   Write `attr()` typed, as `attr(href url)`.

It worked if the reference reads its target's name aloud, and the page number in print.

See [cross-references](#cross-references).

## Styling the document

### How to make a stylesheet apply

1. List the sheet under `styles` in the frontmatter:

   ```yaml
   styles: [./styles/base.css, ./styles/report.css]
   ```

2. If the sheet belongs to the whole venue, write it in `beltype.config.yaml` under `keys.styles.provide`. A top-level `styles:` in the venue file is ignored without a warning.
3. Write only the rules you change. BelType's default look sits in a lower CSS layer, so any rule of yours beats it, whatever its specificity.
4. If a default still shows through, unsay it: `h1 { border-bottom: none }` drops the default underline.
5. If a rule still seems not to apply, open the document with `beltype edit`, switch on `inspect`, and select the element. It names the declaration that wins and the file and line it is written on.

It worked if the preview shows your rule. Open `/_beltype/beltype-ua.css` in the preview to read every default you can override.

See the [`styles` key](#styles) and [three layers of style, and no switch](#three-layers-of-style-and-no-switch).

### How to use your own fonts

1. Put the font files in the project, under your assets.
2. Declare each face in your stylesheet, with its file referenced relative to the sheet:

   ```css
   @font-face { font-family: Alegreya; src: url(./fonts/Alegreya-Regular.woff2); }
   body { font-family: Alegreya, Georgia, serif; }
   ```

3. If you want no files at all, name one of the four faces BelType ships: Source Serif 4, Source Sans 3, Source Code Pro or Noto Emoji.
4. If you print through Caster, end every stack with a face the PDF can carry. A glyph that falls through to a generic family such as `serif` is an error naming the family.
5. If the font is hosted, download the stylesheet and its files into the project, fix the copy's `url()` references, and list the copy under `styles`. BelType never downloads one for you.

It worked if the preview shows the face and the build names no missing font. A hosted reference warns on every build, and Chromium fetches it at `--pdf` time.

See the [`styles` key](#styles).

### How to pass values into a stylesheet

Use this when one sheet serves several documents that differ in a colour or a measure.

1. In the stylesheet, read the value as a custom property:

   ```css
   h1, h2 { color: var(--brand); }
   ```

2. In each document's frontmatter, supply the value under `customProps`:

   ```yaml
   customProps: { brand: "#8a1f2b", measure: 42rem }
   ```

Quote a colour: YAML reads an unquoted `#` as a comment.

It worked if the headings take the document's colour. BelType writes the values into `:root` as `--brand` and `--measure`.

See the [`customProps` key](#customprops).

### How to style whole sections

Every heading in the document's own flow opens a `<section>` holding everything beneath it.

1. Put a class on the heading: `## Appendix {.appendix}`.
2. Address the section through the heading with `:has()`:

   ```css
   section:has(> h2.appendix) { font-size: 0.9em; }
   section:has(> h2.keep-together) { break-inside: avoid; }
   ```

3. If the section comes from an included file and needs its own id, wrap the `@include` in a container directive bound to a `section` tag:

   ```markdown
   :::chapter{#history}
   @include{src="./chapters/history.md"}
   :::
   ```

A heading inside a container directive, raw HTML or a Pug fence opens no section.

It worked if the whole section takes the style, and `h2.appendix` still styles the heading alone.

See [headings](#headings).

### How to share a look across documents

1. Put the shared sheet in a folder, for example `~/company/report/report.css`.
2. If the folder sits outside the venue, name it with a `rewrites` alias.
3. Provide the sheet, and any values it reads, in the venue's `beltype.config.yaml`:

   ```yaml
   $adopts: beltype:document
   keys:
     rewrites:
       provide: { "@house": ~/company/report }
     styles:
       provide: ["@house/report.css"]
     customProps:
       provide: { brand: '#c00' }
   ```

4. In a document that needs more, list its own sheet: `styles: [./tweak.css]`.

`styles` accumulates down the cascade, so the document's sheet links after the house sheet and wins.

It worked if every document in the venue shows the house look, and the tweaked one shows its tweak on top.

See the [`styles` key](#styles), the [`rewrites` key](#rewrites) and [a venue, written out](#a-venue-written-out).

### How to make a document type with a schema

Use this when more than a look travels: values, directives, and keys every document of the type must supply.

1. Write the type as a schema file:

   ```yaml
   # ~/company/user-manual.yaml
   $adopts: beltype:document
   keys:
     rewrites:
       provide: { "@company": ~/company/assets }
     styles:
       provide: ["@company/manual.css"]
     params:
       provide: { publisher: Acme }
     product:
       demand: { required: true }
   ```

2. If the schema sits inside the venue's folder, adopt it from `beltype.config.yaml` with `$adopts:`. A venue adopting a file outside its folder is refused.
3. Otherwise, name it from each document's frontmatter:

   ```yaml
   ---
   $schema: ~/company/user-manual.yaml
   product: Widget
   ---
   ```

4. If the schema invents a list key whose items should accumulate, write `cascade: append` under it. An invented list replaces by default.

It worked if a document missing `product` fails the build naming the file and the line. The dev server watches the schema with the rest of the cascade, so an edit to it rebuilds the document.

See [the root schema](#the-root-schema) and [a venue is a schema](#a-venue-is-a-schema).

### How to style print and screen in one sheet

1. Write the rules every medium shares at the top level of the sheet.
2. Scope what differs:

   ```css
   @media print  { .no-print { display: none } }
   @media screen { body { background: #fafafa } }
   ```

3. Leave `@page` rules unscoped. The paged engines apply them, in their preview too, and the site engine ignores them.

It worked if the preview under `--engine site` shows the screen rules and the PDF shows the print rules.

See [the CSS vocabulary](#the-css-vocabulary).

### How to caption figures in another language

The built-in rules write "Figure" before a caption and a cross-reference, in English.

1. Override the caption's prefix in your stylesheet:

   ```css
   figcaption::before { content: "Figura " counter(figure) ". "; }
   ```

2. Override the reference's prefix the same way:

   ```css
   .xref::before { content: "Figura "; }
   ```

It worked if every caption and every `:ref` to a figure reads in your language, numbered as before.

See [where the numbers come from](#where-the-numbers-come-from) and [figures](#figures).

## Page and print

### How to set the page size and margins

1. Add an `@page` rule to your stylesheet:

   ```css
   @page {
     size: A4;          /* or A5, letter, 170mm 240mm */
     margin: 22mm;      /* or per side: 22mm 18mm */
   }
   ```

2. If a table needs a landscape sheet, give it a named page:

   ```css
   @page wide { size: A4 landscape; }
   .wide-table { page: wide; }
   ```

Without a rule of yours, BelType's default `@page { size: A4; margin: 20mm }` applies.

It worked if the preview shows the new sheet size.

See the [frontmatter example](#frontmatter-example).

### How to put a running header on every page

1. Capture the text you want in the margin as a named string:

   ```css
   h1 { string-set: doctitle content(text); }
   ```

2. Read the string, and the folio, in the page's margin boxes:

   ```css
   @page {
     @top-center { content: string(doctitle); font-size: 9pt; color: #666; }
     @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; }
   }
   ```

3. If the header should follow the reader, capture from `h2` instead and read it in `@top-right`.
4. If a cover page should carry no furniture, give it a named page and empty its boxes:

   ```css
   @page cover { @top-center { content: none; } @bottom-right { content: none; } }
   ```

The six margin boxes are `@top-left`, `@top-center`, `@top-right` and their three `@bottom-` siblings.

It worked if every page in the preview carries the title and its folio.

See the [frontmatter example](#frontmatter-example).

### How to mirror the margins for a bound book

1. Spell the margins per page side, wider on the binding side, with the folio on the outer edge:

   ```css
   @page :left  { margin-right: 28mm; margin-left: 18mm; @bottom-left  { content: counter(page); } }
   @page :right { margin-left: 28mm; margin-right: 18mm; @bottom-right { content: counter(page); } }
   ```

2. If the first page is a bare opening, style it apart:

   ```css
   @page :first { margin-top: 60mm; @top-center { content: none; } }
   ```

CSS has no inner or outer margin shorthand, so each side is written per parity.

It worked if facing pages mirror each other. Paged.js shows facing spreads when `beltype edit` moves the preview into its own window.

See [how pages get made](#how-pages-get-made) for the engines that read these rules.

### How to open every chapter on a right-hand page

1. Name the page style on the section that spans the chapter, and break to a right-hand page before it:

   ```css
   section:has(> h1) { page: chapter; break-before: recto; }
   ```

2. Give the chapter pages their own furniture:

   ```css
   @page chapter { @top-center { content: string(chaptertitle); } }
   h1 { string-set: chaptertitle content(); }
   ```

3. Mark the blank left-hand pages the break inserts, so they read as deliberate:

   ```css
   @page :blank { @top-center { content: none; } @bottom-center { content: "· intentionally blank ·"; } }
   ```

`:blank` matches only the pages a forced break inserts, never a page that ran out of content. A page holding only a running element counts as occupied.

It worked if every chapter opens on an odd page, and each inserted blank carries the line.

See [headings](#headings) for the sections a heading opens.

### How to put markup in a running header

Use this when the header needs an italic title or a logo, which `string-set` cannot carry.

1. Write the furniture as one line of inline HTML where it should begin:

   ```markdown
   <p class="running-mark">BelType <em>Manual</em></p>
   ```

2. Take the element out of the flow as a running element:

   ```css
   .running-mark { position: running(mark); font-size: 8pt; }
   ```

3. Place it in a margin box:

   ```css
   @page chapter { @top-left { content: element(mark); } }
   ```

It worked if the line vanishes from the text and repeats in the margin from its page onward.

See [how pages get made](#how-pages-get-made).

### How to put the notes at the foot of the page

1. If you write footnotes with `[^n]`, switch on their relocation in the frontmatter:

   ```yaml
   markdown: { inlineFootnotes: true }
   ```

2. If you write notes inline instead, mark each one with the `footnote` class: `<span class="footnote">the note</span>`, a text directive bound to `span.footnote`, or `[[the note]]{.footnote}`.
3. Add the rule that makes it a footnote:

   ```css
   .footnote { float: footnote; }
   ```

Write steps 1 and 3 together: relocation without the rule strands each note in the middle of its paragraph.

It worked if each note sits at the foot of its page with a generated number. A note referenced more than once stays in the trailing section, with a build warning. Keep any single note within one page: a larger note is printed twice, under two numbers.

See [footnotes](#footnotes) and the [markdown plugin registry](#markdown-plugin-registry).

### How to add crop marks and bleed

Use this for a press run, and keep the rules in a sheet of their own: they change the sheet size, and in a reading stylesheet they put crop marks on every preview.

1. Declare the trim size, the bleed and the marks:

   ```css
   @page { size: 148mm 210mm; bleed: 3mm; marks: crop cross; margin: 20mm; }
   ```

2. If an element must run to the paper's edge, extend it past the page margin and the bleed:

   ```css
   .bleed-band { margin-left: -23mm; margin-right: -23mm; padding-left: 23mm; padding-right: 23mm; }
   ```

3. Build the PDF with `beltype build <target> --pdf`.

It worked if the PDF's page box measures the trim plus twice the bleed (measured 2026-08-24: 154.18 × 215.90 mm against an expected 154 × 216) and every sheet carries the marks. The engine seats the marks inside the bleed area, so content that truly bleeds prints over them.

See [command-line options](#command-line-options).

### How to print the document as a PDF

1. Run the build with the default engine:

   ```bash
   beltype build ./report.md --pdf
   ```

2. If the run says Chromium is missing, run the one command the message names, then repeat step 1. The browser is about 170 MB and BelType installs skip it.
3. If you need a tagged PDF 2.0 file, add `--printer caster`. It runs only under the default engine, and only where the private caster package is present, which today means a checkout of the repository.

It worked if `report.pdf` lands beside `report.md` with the pages the preview showed. `--engine site --pdf` and `--engine cicero --pdf` refuse, naming the default engine.

See [command-line options](#command-line-options).

## The website

### How to serve a document as a website

1. Write a `@toc` line where the contents belong, if the document has none. The first one becomes the site's sidebar.
2. Start the server with the site engine:

   ```bash
   beltype --engine site
   ```

3. If the project is mainly a site, put that command in the script that starts it. The engine is a flag only, and an `engine:` key is refused.

It worked if the document reads as one column with a sidebar that highlights the section you are reading. Cross-references fill in when the page loads, and the contents carry no page numbers.

See [the same document as a website](#the-same-document-as-a-website) and the [`site` key](#site).

### How to turn subsections into tabs on the site

1. Put a class of your own on the heading whose subsections become tabs:

   ```markdown
   ## Installation {.platforms}

   A line of intro prose, which stays above the widget.

   ### On macOS
   …

   ### On Linux
   …
   ```

2. Bind the class to the preinstalled tabs element, in the frontmatter or the venue:

   ```yaml
   site:
     transform:
       ".platforms": beltype-tabs
   ```

3. If every match should carry the same attributes, use the object form:

   ```yaml
   site:
     transform:
       ".platforms":
         element: beltype-tabs
         attrs: { variant: pills }
   ```

It worked if, under `--engine site`, the subsections become tabs labelled by their headings. In print the section reads as written. Fewer than two subsections, or a name without a hyphen, leave the content as written, with a warning.

See the [`site` key](#site).

### How to write your own component

1. Write the module as a standard custom element:

   ```js
   class MyChrono extends HTMLElement {
     connectedCallback() { /* enhance this.children */ }
   }
   customElements.define('my-chrono', MyChrono);
   ```

2. List the module and bind a selector to the element:

   ```yaml
   site:
     transform:
       ".timeline": my-chrono
   components:
     - ./components/chrono.js
   ```

3. In `connectedCallback`, read the structure from the children: for a heading, they are the heading, any intro prose, and one `<section>` per subsection.
4. Keep the element in the light DOM, so your stylesheets still reach the content.
5. If the element hides content, listen for the bubbling `beltype:reveal` event on the hidden target and reveal it, so deep links land.

It worked if the marked section is enhanced on the site. If the module fails to load, the content renders as written.

See the [`components` key](#components) and [components: re-presenting content on screen](#components-re-presenting-content-on-screen).

### How to give a component a library

1. Install the library in the project: `npm install lit-html`.
2. Map its bare name to the file:

   ```yaml
   importMap:
     imports:
       lit-html: ./node_modules/lit-html/lit-html.js
   ```

3. Import it bare in the component: `import { html, render } from 'lit-html';`.

A relative import such as `./lib/format.js` needs no map. An unmapped bare name warns on every build.

It worked if the terminal shows no warning about the specifier and the component renders.

See the [`importMap` key](#importmap).

### How to deploy the site

There is no static site export: `--engine site` serves live and produces no folder.

1. Start the site server:

   ```bash
   beltype --engine site --port 3000
   ```

2. For the book, build the PDF from the same folder: `beltype build <target> --pdf`.

It worked if the site answers on the port and the PDF lands beside the document, from one Markdown source and one set of stylesheets.

See [command-line options](#command-line-options).

## Upgrading

### How to find which upgrade a project needs

1. Open the project's configuration and match it in this table:

   | You see | Era | What is ahead |
   | :--- | :--- | :--- |
   | `beltype.config.yaml` with `$adopts:` and `keys:` | 0.22 and later | nothing |
   | `beltype.config.yaml` with top-level keys | 0.16 to 0.21 | the schema venue, then the sectioned-body review |
   | `beltype.config.js`, `@toc` lines in documents | 0.13 to 0.15 | the YAML conversion, then the schema venue |
   | `beltype.config.js`, `toc: true`, no `@toc` | before 0.13 | all of the above, plus the `@toc` line and the binding names |

2. Rebuild, and fix the first error by its message.
3. Repeat step 2 until the build is green. Each rebuild shows the next error.

See [the refusal list](#the-refusal-list).

### How to move a project to the schema venue

Since 0.22 the venue file is a schema. A venue still in the old shape fails quietly: its keys, and BelType's own defaults, are read as nothing.

1. Add `$adopts: beltype:document` as the first line of `beltype.config.yaml`.
2. Move every top-level key under `keys`, as `keys.<name>.provide`:

   ```yaml
   # before
   styles: [./tweak.css]
   ```

   ```yaml
   # after
   $adopts: beltype:document
   keys:
     styles:
       provide: [./tweak.css]
   ```

3. Leave the frontmatter as it is. It still holds plain values.

It worked if the venue's styles and aliases apply again.

See [a venue, written out](#a-venue-written-out).

### How to replace a key the configuration refuses

The message names the key and the move. Apply the move:

- **`spec:`**: adopt the house type with `$adopts: ./types/user-manual.yaml` if it sits in the venue, or name it with `$schema:` in each document's frontmatter.
- **`schema:`** or **`requires:`**: write `keys.<name>.demand: { required: true }` in the schema that governs the document.
- **`cover:`**: write the title page as a container directive, `:::cover` … `:::`, and lay it out in CSS.
- **`mountPaths:`**: write the alias under `rewrites`, as `rewrites: { "@img": ../shared }`, and refer to `@img/x.png`.
- **`port:`, `target:`, `watch:`, `open:`, `engine:`**: delete the key and pass `--port`, the positional target, `--no-watch`, `--open` or `--engine`.
- **`rehypePlugins:`**: merge both lists under one key, `plugins: { remark: [...], rehype: [...] }`.

It worked if the rebuild gets past that key.

See [the refusal list](#the-refusal-list).

### How to convert a beltype.config.js to YAML

1. Create `beltype.config.yaml` beside the old file.
2. Write the same keys as YAML data, in the schema shape, under `$adopts: beltype:document` and `keys`. Quote values YAML would misread, such as `'#c00'`.
3. If the old file has a `render` function, move its body into `extensions/<name>.js` as the default export:

   ```js
   // extensions/badge.js
   export default function badge(text) {
     return `<span class="badge">${text}</span>`;
   }
   ```

4. In the YAML, name the module in place of the function:

   ```yaml
   keys:
     directives:
       provide:
         badge: { render: badge }    # → extensions/badge.js
   ```
5. Delete `beltype.config.js`.

It worked if the build runs. A `beltype.config.js` left in place is refused with this migration in the message.

See [configuration keys](#configuration-keys).

### How to fix a command that stopped working

- If the message is "Unknown option: `--edit`", run the editor as a subcommand: `beltype edit ./x.md`.
- If `beltype build` refuses without `--pdf`, add `--pdf`. There is no `dist/` export, and `--out`, `beltype init` and `beltype vendor` are gone.
- If a script fails with "Unknown option", fix the invocation the message suggests: one target per run, and `-o` is `--open`.

It worked if the command runs.

See [what the parser refuses](#what-the-parser-refuses) and [the `edit` subcommand](#the-edit-subcommand).

### How to fix a site binding after an upgrade

1. If a binding sits under a top-level `transform:`, move it under the engine's name: `transform: { site: { '.x': el } }` becomes `site: { transform: { '.x': el } }`. The old key is not refused, only unread.
2. If a binding names a short element such as `tabs`, write the custom element's full name: `beltype-tabs`.
3. If the build warns that "`toc:` has no `@toc`", write a `@toc` line where the contents belong, and keep `toc:` only for `depth` and `title`.

It worked if the tabs and the contents page come back under `--engine site`.

See the [`site` key](#site) and [the contents page](#the-contents-page).

### How to review a stylesheet after the sections change

Since 0.17 every heading opens a `<section>`, so selectors written for a flat body may stop matching.

1. Search the sheets for `body > h2`, sibling walks after a heading (`h2 + p`, `h2 ~ ul`) and `:first-child` on content elements, and rewrite each against the sections.
2. Replace any rule on `#content` with the same rule on `body`.
3. If contents entries indent twice, drop the indentation on `toc-level-N`: the lists nest now.
4. If an `@import`ed sheet is also listed under `styles`, remove the duplicate entry.

It worked if the preview looks as it did before the upgrade.

See [headings](#headings) and [the CSS vocabulary](#the-css-vocabulary).

## When something looks wrong

### How to recover from zero pages

1. Look for a heading that starts with a number, such as `## 1. Scope`. Its id starts with a digit, the contents lookup throws, and pagination dies, whatever the message blames.
2. If you find one, number it with CSS or give it a digit-free id, as in [how to number headings](#how-to-number-headings-without-breaking-the-document).
3. If you find none, open the browser console and read the actual error before trusting the timeout's diagnosis.

It worked if the preview paginates.

### How to tell a slow page from a broken one

The preview is blank while the engine paginates, and two waits have limits.

1. If a diagram shows as its source text, the Mermaid runtime missed its eight seconds and the document paginated without it.
2. If pagination gives up after forty-five seconds, read its message: it names the two usual causes, a throttled tab (hidden, or on a busy machine) and a stuck font.
3. Before believing that diagnosis, read the actual error in the browser console.

It worked if the pages settle and the console shows no error.

See [diagrams](#diagrams).

### How to fill in a missing cross-reference number

1. If you are under the default engine, wait for the layout to settle, or check the PDF: the numbers fill in during pagination.
2. If a bare `:ref` shows no number, give the target figure's caption the matching id: `![Map](route.svg "The route {#fig:route}")`.
3. If the reference targets a heading, class it and add a counter rule, as in [how to refer to a section by its number](#how-to-refer-to-a-section-by-its-number).
4. If the site shows a red `?`, the target id does not exist. Correct the id in the `:ref`.

Contents entries on the site carry no page numbers by design.

It worked if every reference shows its number or name.

See [figures](#figures) and [cross-references](#cross-references).

### How to find a missing image

1. Reference the image relative to the file that mentions it, not the entry document.
2. If the image sits in a folder outside the project, name the folder in `rewrites` and write the alias:

   ```yaml
   rewrites:
     "@img": ../shared
   ```

   Then refer to `@img/route.png`. An out-of-tree reference with no alias fails the build, naming `rewrites`.

3. If the image is remote, check the network connection.

It worked if the image shows in the preview.

See the [`rewrites` key](#rewrites) and [paths in a config: the two spaces](#paths-in-a-config-the-two-spaces).

### How to read a configuration refusal

1. Read the location first. It names your file, your line and column: frontmatter is read in place, so a complaint about `styles:` points at the line you wrote it on.
2. Read the rule it names, and fix that line.
3. If the message names a key BelType does not have, apply the move it carries, as in [how to replace a key the configuration refuses](#how-to-replace-a-key-the-configuration-refuses).
4. If the dev server is running, save the file. A refusal there is an ordinary build error, and the overlay clears on save.

`build --pdf` refuses outright instead, because a PDF cannot be re-checked once sent.

It worked if the build runs without the overlay.

See [configuration keys](#configuration-keys) and [what BelType refuses](#what-beltype-refuses).
