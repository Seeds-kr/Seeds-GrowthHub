/**
 * Cursor-preserving markdown insertion (ADR-005).
 *
 * We keep markdown as the source of truth and put a thin toolbar on top of a
 * plain <textarea>, rather than adopting a block editor. That keeps version
 * diffing, template duplication and export working unchanged — but it means we
 * own the selection maths. All of it lives here so the toolbar stays dumb.
 */

export type EditAction =
  /** Wrap the selection, or insert the marker pair and place the caret between. */
  | { kind: "wrap"; before: string; after: string; placeholder: string }
  /** Prefix every selected line. Toggles off when every line already has it. */
  | { kind: "linePrefix"; prefix: string; placeholder: string }
  /** Prefix selected lines with an incrementing number. */
  | { kind: "orderedList"; placeholder: string }
  /** Drop a block at the caret, padded with blank lines. */
  | { kind: "block"; text: string };

export type EditResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

/** Expand [start,end) to cover the whole lines it touches. */
function lineBounds(value: string, start: number, end: number) {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  let to = value.indexOf("\n", end);
  if (to === -1) to = value.length;
  return { from, to };
}

function applyWrap(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): EditResult {
  const selected = value.slice(start, end);

  // Second press on an already-wrapped selection removes the markers.
  const outerStart = start - before.length;
  const alreadyWrapped =
    outerStart >= 0 &&
    value.slice(outerStart, start) === before &&
    value.slice(end, end + after.length) === after;
  if (alreadyWrapped) {
    return {
      value:
        value.slice(0, outerStart) + selected + value.slice(end + after.length),
      selectionStart: outerStart,
      selectionEnd: outerStart + selected.length,
    };
  }

  const body = selected || placeholder;
  return {
    value: value.slice(0, start) + before + body + after + value.slice(end),
    selectionStart: start + before.length,
    selectionEnd: start + before.length + body.length,
  };
}

function applyLinePrefix(
  value: string,
  start: number,
  end: number,
  prefix: string,
  placeholder: string,
): EditResult {
  const { from, to } = lineBounds(value, start, end);
  const slice = value.slice(from, to);
  const lines = slice.split("\n");

  // Empty document / empty line → seed a placeholder so the user sees the shape.
  if (lines.length === 1 && lines[0] === "") {
    const text = prefix + placeholder;
    return {
      value: value.slice(0, from) + text + value.slice(to),
      selectionStart: from + prefix.length,
      selectionEnd: from + prefix.length + placeholder.length,
    };
  }

  const allPrefixed = lines.every((l) => l.startsWith(prefix));
  const next = lines
    .map((l) => (allPrefixed ? l.slice(prefix.length) : prefix + l))
    .join("\n");

  return {
    value: value.slice(0, from) + next + value.slice(to),
    selectionStart: from,
    selectionEnd: from + next.length,
  };
}

function applyOrderedList(
  value: string,
  start: number,
  end: number,
  placeholder: string,
): EditResult {
  const { from, to } = lineBounds(value, start, end);
  const slice = value.slice(from, to);
  const lines = slice.split("\n");

  if (lines.length === 1 && lines[0] === "") {
    const text = `1. ${placeholder}`;
    return {
      value: value.slice(0, from) + text + value.slice(to),
      selectionStart: from + 3,
      selectionEnd: from + 3 + placeholder.length,
    };
  }

  const numbered = /^\d+\.\s/;
  const allNumbered = lines.every((l) => numbered.test(l));
  const next = lines
    .map((l, i) => (allNumbered ? l.replace(numbered, "") : `${i + 1}. ${l}`))
    .join("\n");

  return {
    value: value.slice(0, from) + next + value.slice(to),
    selectionStart: from,
    selectionEnd: from + next.length,
  };
}

function applyBlock(
  value: string,
  start: number,
  end: number,
  text: string,
): EditResult {
  // Keep block elements on their own lines without piling up blank lines.
  const needsLeading = start > 0 && !value.slice(0, start).endsWith("\n\n");
  const lead = start === 0 ? "" : needsLeading ? "\n\n" : "";
  const needsTrailing = end < value.length && !value.slice(end).startsWith("\n");
  const tail = needsTrailing ? "\n" : "";
  const inserted = lead + text + tail;
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    selectionStart: start + lead.length,
    selectionEnd: start + lead.length + text.length,
  };
}

export function applyEdit(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: EditAction,
): EditResult {
  switch (action.kind) {
    case "wrap":
      return applyWrap(
        value,
        selectionStart,
        selectionEnd,
        action.before,
        action.after,
        action.placeholder,
      );
    case "linePrefix":
      return applyLinePrefix(
        value,
        selectionStart,
        selectionEnd,
        action.prefix,
        action.placeholder,
      );
    case "orderedList":
      return applyOrderedList(
        value,
        selectionStart,
        selectionEnd,
        action.placeholder,
      );
    case "block":
      return applyBlock(value, selectionStart, selectionEnd, action.text);
  }
}

export const TABLE_SKELETON = [
  "| 항목 | 내용 |",
  "| --- | --- |",
  "|  |  |",
].join("\n");
