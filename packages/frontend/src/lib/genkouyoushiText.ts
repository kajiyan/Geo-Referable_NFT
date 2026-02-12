import { GENKOUYOUSHI_GRID } from '@/components/features/Genkouyoushi/constants';

export interface WrapResult {
  renderedText: string;
  manualToRendered: number[];
  renderedToManual: number[];
}

export interface ApplyManualEditOptions {
  manualText: string;
  renderedToManual: number[];
  manualToRendered: number[];
  selectionStart: number;
  selectionEnd: number;
  inputType: string;
  data: string | null;
  cols?: number;
  rows?: number;
  maxCells?: number;
}

export const wrapAndMap = (
  manualText: string,
  cols: number = GENKOUYOUSHI_GRID.cols,
  rows: number = GENKOUYOUSHI_GRID.rows,
): WrapResult => {
  const rendered: string[] = [];
  const manualToRendered: number[] = [];
  const renderedToManual: number[] = [];

  let manualIndex = 0;
  let renderedLineCount = 1;
  let col = 0;

  const graphemes = Array.from(manualText);

  for (let i = 0; i < graphemes.length; i++) {
    const ch = graphemes[i];

    if (ch === '\n') {
      // manual newline
      rendered.push('\n');
      renderedToManual.push(manualIndex);
      manualToRendered[manualIndex] = rendered.length - 1;
      manualIndex++;
      col = 0;
      renderedLineCount++;
      if (renderedLineCount > rows) break;
      continue;
    }

    // normal grapheme
    rendered.push(ch);
    renderedToManual.push(manualIndex);
    manualToRendered[manualIndex] = rendered.length - 1;
    manualIndex++;
    col++;

    // auto wrap at column boundary
    if (col === cols) {
      // insert auto newline that does not consume manual index
      // ただし、最後の文字の場合は改行を追加しない（削除リフロー対応）
      if (renderedLineCount < rows && i < graphemes.length - 1) {
        rendered.push('\n');
        renderedToManual.push(manualIndex); // map to current manual index
        renderedLineCount++;
      }
      col = 0;
      if (renderedLineCount > rows) break;
    }
  }

  // Truncate to rows limit (safety) - 移植元と完全に同じ処理
  let out = rendered.join('');
  const lines = out.split('\n');
  if (lines.length > rows) {
    out = lines.slice(0, rows).join('\n');
    // renderedToManual also needs truncation
    const cut = out.length;
    renderedToManual.length = cut;
  }

  return { renderedText: out, manualToRendered, renderedToManual };
};

export const stripAutoBreaksFromRendered = (
  renderedText: string,
  cols: number = GENKOUYOUSHI_GRID.cols,
): string => {
  let col = 0;
  let result = '';

  for (const ch of renderedText) {
    if (ch === '\n') {
      if (col === cols) {
        // auto wrap -> drop (移植元と同じ処理)
        col = 0;
      } else {
        // manual newline -> keep (移植元と同じ処理)
        result += '\n';
        col = 0;
      }
    } else {
      result += ch;
      col++;
      if (col === cols) {
        // expecting an auto break in rendered, next loop will see it and drop
        // (移植元の重要なコメントと処理)
      }
    }
  }

  return result;
};

export const calculateCaretCellIndex = (
  renderedText: string,
  selectionStart: number,
  cols: number = GENKOUYOUSHI_GRID.cols,
  rows: number = GENKOUYOUSHI_GRID.rows,
): number => {
  const textBeforeCursor = renderedText.substring(0, selectionStart);
  const lines = textBeforeCursor.split('\n');
  let cellIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const graphemes = Array.from(line);
    cellIndex += graphemes.length;

    if (lineIndex < lines.length - 1) {
      const remainder = graphemes.length % cols;

      if (remainder === 0) {
        if (graphemes.length === 0) {
          cellIndex += cols;
        }
        // 完全に埋まった行は次の行の開始位置に既にいるため何もしない
      } else {
        cellIndex += cols - remainder;
      }
    }
  }

  return Math.min(cellIndex, cols * rows - 1);
};

export const countNewlines = (text: string): number => (text.match(/\n/g) || []).length;

export interface ManualEditPayload {
  manualText: string;
  manualCaret: number;
  renderedCaret: number;
  wrapped: WrapResult;
}

/**
 * Extracts the manual-only string (ユーザーが入力した改行のみを保持) from a textarea value
 * that may contain automatic line breaks inserted at the column boundary.
 *
 * This function removes "auto-breaks" (automatic line breaks inserted at column boundaries)
 * and preserves only "manual-breaks" (user-inserted line breaks).
 *
 * @param renderedText - Text with both manual and automatic line breaks
 * @param cols - Number of columns per row (default: 9)
 * @returns Text with only manual line breaks
 *
 * @example
 * // Input: "123456789\nあいうえお" (9 chars + auto-break + 5 chars)
 * // Output: "123456789あいうえお" (manual text without auto-breaks)
 */
export const getManualFromRendered = (
  renderedText: string,
  cols: number = GENKOUYOUSHI_GRID.cols,
): string => stripAutoBreaksFromRendered(renderedText, cols);

/**
 * Advanced utility to extract manual text with additional metadata
 *
 * @param renderedText - Text with both manual and automatic line breaks
 * @param cols - Number of columns per row
 * @param rows - Number of rows
 * @returns Object with manual text and analysis data
 */
export const extractManualTextWithMetadata = (
  renderedText: string,
  cols: number = GENKOUYOUSHI_GRID.cols,
  rows: number = GENKOUYOUSHI_GRID.rows,
) => {
  const manualText = stripAutoBreaksFromRendered(renderedText, cols);
  const wrapped = wrapAndMap(manualText, cols, rows);

  return {
    manualText,
    renderedText: wrapped.renderedText,
    autoBreaksCount: countNewlines(wrapped.renderedText) - countNewlines(manualText),
    manualBreaksCount: countNewlines(manualText),
    totalCells: Array.from(manualText.replace(/\n/g, '')).length,
    isValidForGrid: Array.from(manualText.replace(/\n/g, '')).length <= (cols * rows),
    hasAutoBreaks: wrapped.renderedText !== manualText,
  };
};

/**
 * Debug utilities for development and testing
 */
export const debugGenkouyoushi = {
  /**
   * Log the current state of manual/rendered text with detailed breakdown
   */
  logState: (
    label: string,
    manualText: string,
    renderedText: string,
    cols: number = GENKOUYOUSHI_GRID.cols,
    rows: number = GENKOUYOUSHI_GRID.rows,
  ) => {
    const metadata = extractManualTextWithMetadata(renderedText, cols, rows);
    console.group(`🟨 Genkouyoushi Debug: ${label}`);
    console.log('📝 Manual Text:', JSON.stringify(manualText));
    console.log('🖥️ Rendered Text:', JSON.stringify(renderedText));
    console.log('📊 Metadata:', metadata);
    console.log('🔀 Manual → Rendered Match:', metadata.manualText === manualText);
    console.log('⚡ Has Auto-breaks:', metadata.hasAutoBreaks);
    console.groupEnd();
  },

  /**
   * Test the deletion reflow scenario described by the user
   */
  testDeletionReflow: (cols: number = GENKOUYOUSHI_GRID.cols, rows: number = GENKOUYOUSHI_GRID.rows) => {
    console.group('🧪 Testing Deletion Reflow Scenario');

    // Initial state: "123456789あいうえお" (manual)
    const initialManual = '123456789あいうえお';
    const initialWrapped = wrapAndMap(initialManual, cols, rows);
    console.log('1️⃣ Initial State:');
    console.log('   Manual:', JSON.stringify(initialManual));
    console.log('   Rendered:', JSON.stringify(initialWrapped.renderedText));

    // Expected rendered: "123456789\nあいうえお"
    const expectedRendered = '123456789\nあいうえお';
    console.log('   Expected Rendered:', JSON.stringify(expectedRendered));
    console.log('   ✅ Matches Expected:', initialWrapped.renderedText === expectedRendered);

    // Simulate deletion of first character "1"
    const afterDeletionManual = initialManual.slice(1); // "23456789あいうえお"
    const afterDeletionWrapped = wrapAndMap(afterDeletionManual, cols, rows);
    console.log('2️⃣ After Deleting "1":');
    console.log('   Manual:', JSON.stringify(afterDeletionManual));
    console.log('   Rendered:', JSON.stringify(afterDeletionWrapped.renderedText));

    // Expected after deletion: "23456789あ\nいうえお"
    const expectedAfterDeletion = '23456789あ\nいうえお';
    console.log('   Expected Rendered:', JSON.stringify(expectedAfterDeletion));
    console.log('   ✅ Correct Reflow:', afterDeletionWrapped.renderedText === expectedAfterDeletion);

    console.groupEnd();
    return {
      initialCorrect: initialWrapped.renderedText === expectedRendered,
      reflowCorrect: afterDeletionWrapped.renderedText === expectedAfterDeletion,
    };
  },

  /**
   * Create a test scenario for manual testing in browser
   */
  createTestScenario: (cols: number = GENKOUYOUSHI_GRID.cols) => {
    const chars = '123456789'.slice(0, cols);
    const japaneseChars = 'あいうえお';
    return {
      testText: chars + japaneseChars,
      instructions: [
        `1. Paste this text: "${chars}${japaneseChars}"`,
        `2. You should see: "${chars}\\n${japaneseChars}"`,
        `3. Delete the first character "${chars[0]}"`,
        `4. You should see: "${chars.slice(1)}${japaneseChars[0]}\\n${japaneseChars.slice(1)}"`,
        '5. Check console for debug output',
      ],
    };
  },
};

const graphemeCount = (text: string) => Array.from(text).length;

const manualCellCount = (text: string) => Array.from(text.replace(/\n/g, '')).length;

export const applyManualEdit = ({
  manualText,
  renderedToManual,
  manualToRendered,
  selectionStart,
  selectionEnd,
  inputType,
  data,
  cols = GENKOUYOUSHI_GRID.cols,
  rows = GENKOUYOUSHI_GRID.rows,
  maxCells = GENKOUYOUSHI_GRID.totalCells,
}: ApplyManualEditOptions): ManualEditPayload | null | undefined => {
  const replaceRange = (text: string, start: number, end: number, insert: string) =>
    text.slice(0, start) + insert + text.slice(end);

  const manualStart = Math.min(renderedToManual[selectionStart] ?? manualText.length, manualText.length);
  const manualEnd = Math.min(renderedToManual[selectionEnd] ?? manualText.length, manualText.length);

  const maxNewlines = rows - 1;

  const isInsertOperation = inputType.startsWith('insert');
  const insertValue =
    inputType === 'insertLineBreak'
      ? '\n'
      : data ?? '';

  const wouldInsertNewline =
    isInsertOperation &&
    ((inputType === 'insertLineBreak') || insertValue.includes('\n'));

  if (wouldInsertNewline) {
    const tentative = replaceRange(manualText, manualStart, manualEnd, insertValue);
    if (countNewlines(tentative) > maxNewlines) {
      return null;
    }
  }

  if (isInsertOperation) {
    const tentative = replaceRange(manualText, manualStart, manualEnd, insertValue);
    if (manualCellCount(tentative) > maxCells) {
      return null;
    }
  }

  let updated = manualText;
  let newManualCaret = manualStart;

  switch (inputType) {
    case 'insertText': {
      updated = replaceRange(manualText, manualStart, manualEnd, insertValue);
      newManualCaret = manualStart + graphemeCount(insertValue);
      break;
    }
    case 'insertLineBreak': {
      updated = replaceRange(manualText, manualStart, manualEnd, '\n');
      newManualCaret = manualStart + 1;
      break;
    }
    case 'deleteContentBackward': {
      if (manualStart !== manualEnd) {
        updated = replaceRange(manualText, manualStart, manualEnd, '');
        newManualCaret = manualStart;
      } else if (manualStart > 0) {
        const graphemes = Array.from(manualText);
        graphemes.splice(manualStart - 1, 1);
        updated = graphemes.join('');
        newManualCaret = manualStart - 1;
      } else {
        const wrappedSame = wrapAndMap(manualText, cols, rows);
        const renderedCaretSame =
          wrappedSame.manualToRendered[manualStart] ?? wrappedSame.renderedText.length;
        return {
          manualText,
          manualCaret: manualStart,
          renderedCaret: renderedCaretSame,
          wrapped: wrappedSame,
        };
      }
      break;
    }
    case 'deleteContentForward': {
      if (manualStart !== manualEnd) {
        updated = replaceRange(manualText, manualStart, manualEnd, '');
        newManualCaret = manualStart;
      } else {
        const graphemes = Array.from(manualText);
        if (manualStart < graphemes.length) {
          graphemes.splice(manualStart, 1);
          updated = graphemes.join('');
          newManualCaret = manualStart;
        } else {
          const wrappedSame = wrapAndMap(manualText, cols, rows);
          const renderedCaretSame =
            wrappedSame.manualToRendered[manualStart] ?? wrappedSame.renderedText.length;
          return {
            manualText,
            manualCaret: manualStart,
            renderedCaret: renderedCaretSame,
            wrapped: wrappedSame,
          };
        }
      }
      break;
    }
    default:
      return undefined;
  }

  const wrapped = wrapAndMap(updated, cols, rows);
  const caretMap = wrapped.manualToRendered[newManualCaret] ?? manualToRendered[newManualCaret] ?? wrapped.renderedText.length;

  return {
    manualText: updated,
    manualCaret: newManualCaret,
    renderedCaret: caretMap,
    wrapped,
  };
};
