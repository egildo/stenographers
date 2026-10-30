// The plain parse (the studio's notes/markdown-plan.md, "The root parser"): BelType's four syntax extensions (frontmatter, math, directive, GFM's parts) and no belt plugin, because it is the only parse whose positions are exact (notes/unified-write-back.md); BelType's notations and figures are found on its tree afterwards, by this package's own code, which keeps every position exact. GFM's parts are registered in the order BelType's own `plugins/gfm.js` registers them, autolink literals and tables off unless asked for, as there.
import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatter } from 'micromark-extension-frontmatter';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { math } from 'micromark-extension-math';
import { mathFromMarkdown } from 'mdast-util-math';
import { directive } from 'micromark-extension-directive';
import { directiveFromMarkdown } from 'mdast-util-directive';
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal';
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal';
import { gfmFootnote } from 'micromark-extension-gfm-footnote';
import { gfmFootnoteFromMarkdown } from 'mdast-util-gfm-footnote';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { dialect } from './dialect.js';
import { figures } from './figure.js';
import { directives } from './directive.js';

/**
 * @typedef {{ gfm?: { autolinks?: boolean, tables?: boolean }, mark?: boolean, supersub?: boolean, figure?: boolean, directives?: Record<string, { tag?: string, className?: string, defaultTitle?: string }> }} Markdown
 *   the venue's `markdown:` options, in core's shape and under core's names: GFM's autolink literals and tables, off unless asked for (BelType's manual has both on); `==mark==`, `~sub~` and `^sup^`, and a titled image alone in its paragraph as a figure, on unless switched off; the directives' bindings over core's built-ins (the config's `directives:`, a `render` hook not run)
 */

/**
 * The mdast of a Markdown text, every node positioned in it, with BelType's notations (./dialect.js), figures (./figure.js) and directives' elements (./directive.js) found on it.
 * @param {string} text
 * @param {Markdown} [markdown]
 */
export function parseMarkdown(text, markdown = {}) {
  const { autolinks = false, tables = false } = markdown.gfm ?? {};
  const extensions = [frontmatter(), math(), directive()];
  const mdastExtensions = [frontmatterFromMarkdown(), mathFromMarkdown(), directiveFromMarkdown()];
  if (autolinks) { extensions.push(gfmAutolinkLiteral()); mdastExtensions.push(gfmAutolinkLiteralFromMarkdown()); }
  extensions.push(gfmFootnote(), gfmStrikethrough({ singleTilde: false }));
  mdastExtensions.push(gfmFootnoteFromMarkdown(), gfmStrikethroughFromMarkdown());
  if (tables) { extensions.push(gfmTable()); mdastExtensions.push(gfmTableFromMarkdown()); }
  extensions.push(gfmTaskListItem());
  mdastExtensions.push(gfmTaskListItemFromMarkdown());
  const tree = fromMarkdown(text, { extensions, mdastExtensions });
  dialect(tree, text, markdown);
  if (markdown.figure !== false) figures(tree);
  directives(tree, markdown.directives);
  return tree;
}
