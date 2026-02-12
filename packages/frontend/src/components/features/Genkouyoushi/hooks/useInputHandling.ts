import { useCallback, useRef } from 'react';
import { wrapAndMap, stripAutoBreaksFromRendered } from '@/lib/genkouyoushiText';
import { GENKOUYOUSHI_GRID, GENKOUYOUSHI_ANDROID } from '../constants';
import { debugLog, debugLogGroup, debugLogState } from '../debugUtils';
import { getPlatformInfo, isAndroidChrome } from '../utils/platformDetection';

interface UseInputHandlingProps {
  manualText: string;
  setManualText: (text: string) => void;
  setDisplayedText: (text: string) => void;
  updateCaret: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  wrap: ReturnType<typeof wrapAndMap>;
  userOnBeforeInput?: React.FormEventHandler<HTMLTextAreaElement>;
  userOnInput?: React.FormEventHandler<HTMLTextAreaElement>;
}

/**
 * Android で期待する状態を保持する型
 */
interface ExpectedState {
  manualText: string;
  renderedText: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * inputType が削除操作かどうかを判定
 * W3C Input Events Level 2 の全削除タイプをカバー
 */
const isDeletionInputType = (inputType: string): boolean => {
  return (
    inputType === 'deleteContentBackward' ||
    inputType === 'deleteContentForward' ||
    inputType === 'deleteByCut' ||
    inputType === 'deleteByDrag' ||
    inputType === 'deleteSoftLineBackward' ||
    inputType === 'deleteSoftLineForward' ||
    inputType === 'deleteHardLineBackward' ||
    inputType === 'deleteHardLineForward' ||
    inputType === 'deleteWordBackward' ||
    inputType === 'deleteWordForward' ||
    inputType === 'deleteEntireSoftLine'
  );
};

export const useInputHandling = ({
  manualText,
  setManualText,
  setDisplayedText,
  updateCaret,
  textareaRef,
  wrap,
  userOnBeforeInput,
  userOnInput,
}: UseInputHandlingProps) => {
  const isComposingRef = useRef(false);
  const handledByBeforeInputRef = useRef(false);
  const awaitingNativeInputRef = useRef(false);
  const skipNextSyncRef = useRef(false);
  const processedByKeydownRef = useRef(false);
  const lastDeleteKeyRef = useRef<'Backspace' | 'Delete' | null>(null);
  const keydownSelStartRef = useRef<number | null>(null);
  const keydownSelEndRef = useRef<number | null>(null);

  // Android 用の状態管理
  const pendingAndroidValidationRef = useRef(false);
  const expectedStateRef = useRef<ExpectedState | null>(null);

  const handleBeforeInput = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement, InputEvent>) => {
      const nativeEvent = event.nativeEvent as InputEvent & {
        isComposing?: boolean;
        inputType?: string;
        data?: string | null;
        dataTransfer?: DataTransfer | null;
      };

      if (processedByKeydownRef.current) {
        processedByKeydownRef.current = false;
        userOnBeforeInput?.(event);
        return;
      }

      // IME composition 中の処理
      // 重要: Android Chrome では beforeInput の preventDefault() が効かないため、
      // composition 中はブラウザに任せて、compositionEnd で状態を同期する
      // （Slate, ProseMirror, Lexical と同じアプローチ）
      if (isComposingRef.current) {
        const platformInfo = getPlatformInfo();
        const isAndroidPath = GENKOUYOUSHI_ANDROID.enabled && platformInfo.isAndroidChrome;

        if (isAndroidPath) {
          // Android composition 中は何もしない - ブラウザに任せる
          // compositionEnd で状態を同期する
          userOnBeforeInput?.(event);
          return;
        }

        // Non-Android: 従来の処理を継続
        userOnBeforeInput?.(event);
        return;
      }

      const maxNewlines = GENKOUYOUSHI_GRID.rows - 1;
      const rawInputType = nativeEvent.inputType;
      const pasteData = nativeEvent.dataTransfer?.getData?.('text') ?? null;
      const data = (nativeEvent.data ?? pasteData ?? '') as string;
      const hasData = typeof data === 'string' && data.length > 0;
      let inputType = rawInputType;

      if (!inputType) {
        if (hasData && data.includes('\n')) {
          inputType = 'insertLineBreak';
        } else if (hasData) {
          inputType = 'insertText';
        }
      }

      debugLog('🔄 handleBeforeInput processing:', {
        inputType,
        data: data?.slice(0, 10),
        currentManualText: manualText.slice(0, 30),
      });

      const { renderedToManual } = wrapAndMap(manualText, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
      const textarea = event.currentTarget;
      const selStart = textarea.selectionStart ?? 0;
      const selEnd = textarea.selectionEnd ?? 0;
      const manualStart = Math.min(renderedToManual[selStart] ?? manualText.length, manualText.length);
      const manualEnd = Math.min(renderedToManual[selEnd] ?? manualText.length, manualText.length);

      const replaceRange = (text: string, start: number, end: number, insert: string) =>
        text.slice(0, start) + insert + text.slice(end);

      const wouldInsert = (inputType === 'insertLineBreak') || (inputType === 'insertText' && data.includes('\n'));
      if (wouldInsert) {
        const newManual = replaceRange(manualText, manualStart, manualEnd, inputType === 'insertLineBreak' ? '\n' : data);
        const newlineCount = (newManual.match(/\n/g) || []).length;
        if (newlineCount > maxNewlines) {
          event.preventDefault();
          userOnBeforeInput?.(event);
          return;
        }
      }

      let updated = manualText;
      let newManualCaret = manualStart;

      if (inputType === 'insertText') {
        updated = replaceRange(manualText, manualStart, manualEnd, data);
        newManualCaret = manualStart + (data ? Array.from(data).length : 0);
      } else if (inputType === 'insertLineBreak') {
        updated = replaceRange(manualText, manualStart, manualEnd, '\n');
        newManualCaret = manualStart + 1;
      } else if (inputType === 'deleteContentBackward') {
        debugLog('🗑️ beforeInput deleteContentBackward:', {
          manualStart,
          manualEnd,
          manualText: manualText.slice(0, 30),
        });

        if (manualStart !== manualEnd) {
          updated = replaceRange(manualText, manualStart, manualEnd, '');
          newManualCaret = manualStart;
        } else if (manualStart > 0) {
          const g = Array.from(manualText);
          const cutIdx = manualStart - 1;
          const deletedChar = g[cutIdx];
          g.splice(cutIdx, 1);
          updated = g.join('');
          newManualCaret = manualStart - 1;

          debugLog('🗑️ Character deleted:', {
            deletedChar,
            newManualText: updated.slice(0, 30),
            newCaret: newManualCaret,
          });

          debugLogGroup('🔥 Delete Operation Debug', () => {
            console.log('Deleted character:', JSON.stringify(deletedChar));
            console.log('Manual before:', JSON.stringify(manualText));
            console.log('Manual after:', JSON.stringify(updated));
            console.log('Manual caret: %d → %d', manualStart, newManualCaret);
          });
        } else if (manualStart === 0 && manualEnd === 0 && manualText.length > 0) {
          const g = Array.from(manualText);
          const deletedChar = g.shift();
          updated = g.join('');
          newManualCaret = 0;

          debugLog('🗑️ Leading character deleted:', {
            deletedChar,
            newManualText: updated.slice(0, 30),
            newCaret: newManualCaret,
          });
        } else {
          userOnBeforeInput?.(event);
          return;
        }
      } else if (inputType === 'deleteContentForward') {
        if (manualStart !== manualEnd) {
          updated = replaceRange(manualText, manualStart, manualEnd, '');
          newManualCaret = manualStart;
        } else if (manualStart < Array.from(manualText).length) {
          const g = Array.from(manualText);
          g.splice(manualStart, 1);
          updated = g.join('');
          newManualCaret = manualStart;
        } else {
          userOnBeforeInput?.(event);
          return;
        }
      } else {
        userOnBeforeInput?.(event);
        return;
      }

      // preventDefault を試みる（Android では効かない可能性あり）
      event.preventDefault();
      handledByBeforeInputRef.current = true;
      awaitingNativeInputRef.current = true;
      skipNextSyncRef.current = true;

      let finalManual = updated;
      let finalManualCaret = newManualCaret;
      let finalWrapped = wrapAndMap(updated, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);

      const previousRenderedCaret =
        finalWrapped.manualToRendered[newManualCaret] ?? finalWrapped.renderedText.length;

      const sanitizedManual = stripAutoBreaksFromRendered(finalWrapped.renderedText, GENKOUYOUSHI_GRID.cols);
      if (sanitizedManual !== finalManual) {
        finalManual = sanitizedManual;
        finalWrapped = wrapAndMap(finalManual, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
        finalManualCaret =
          finalWrapped.renderedToManual[Math.min(previousRenderedCaret, finalWrapped.renderedText.length)] ??
          finalManual.length;
      }

      const renderedCaret =
        finalWrapped.manualToRendered[finalManualCaret] ?? finalWrapped.renderedText.length;

      debugLogState(
        `After ${inputType}`,
        finalManual,
        finalWrapped.renderedText,
        GENKOUYOUSHI_GRID.cols,
        GENKOUYOUSHI_GRID.rows,
      );

      debugLog('🎯 BeforeInput processed:', {
        inputType,
        manualBefore: manualText.slice(0, 30),
        manualAfter: finalManual.slice(0, 30),
        renderedBefore: wrap.renderedText.slice(0, 30),
        renderedAfter: finalWrapped.renderedText.slice(0, 30),
      });

      // Android Chrome の場合: 状態更新は行うが、input イベントで DOM を再検証
      const platformInfo = getPlatformInfo();
      const isAndroidPath = GENKOUYOUSHI_ANDROID.enabled && platformInfo.isAndroidChrome;

      if (isAndroidPath) {
        // 期待する状態を保存（input イベントで検証用）
        expectedStateRef.current = {
          manualText: finalManual,
          renderedText: finalWrapped.renderedText,
          selectionStart: renderedCaret,
          selectionEnd: renderedCaret,
        };
        pendingAndroidValidationRef.current = true;
      }

      // 常に DOM と状態を更新（Android でも）
      // Android の場合、ブラウザが preventDefault() を無視して DOM を上書きする可能性があるため、
      // input イベントで再検証・修正を行う
      if (textareaRef.current) {
        const oldValue = textareaRef.current.value;
        textareaRef.current.value = finalWrapped.renderedText;
        textareaRef.current.setSelectionRange(renderedCaret, renderedCaret);

        debugLog('✅ DOM updated:', {
          oldValue: oldValue.slice(0, 30),
          newValue: textareaRef.current.value.slice(0, 30),
          caret: renderedCaret,
          isAndroidPath,
        });
      }

      setManualText(finalManual);
      setDisplayedText(finalWrapped.renderedText);
      updateCaret();

      debugLog('✅ handleBeforeInput completed:', {
        inputType,
        finalManualText: finalManual.slice(0, 30),
        finalRenderedText: finalWrapped.renderedText.slice(0, 30),
      });

      userOnBeforeInput?.(event);
    },
    [manualText, updateCaret, userOnBeforeInput, setManualText, wrap.renderedText, setDisplayedText, textareaRef]
  );

  const handleInput = useCallback<React.FormEventHandler<HTMLTextAreaElement>>(
    (event) => {
      if (processedByKeydownRef.current) {
        processedByKeydownRef.current = false;
        debugLog('⏭️ handleInput skipped (processed by keydown fallback)');
        userOnInput?.(event);
        return;
      }

      const nativeEvent = event.nativeEvent as InputEvent & {
        isComposing?: boolean;
        inputType?: string;
      };

      // Android 検証処理：ブラウザが preventDefault() を無視して DOM を変更した場合に修正
      if (pendingAndroidValidationRef.current && expectedStateRef.current) {
        // IME composition 中は検証を延期（変換候補が消える問題を防止）
        if (isComposingRef.current) {
          pendingAndroidValidationRef.current = false;
          expectedStateRef.current = null;
          userOnInput?.(event);
          return;
        }

        pendingAndroidValidationRef.current = false;

        const currentDOMValue = event.currentTarget.value;
        const currentSelStart = event.currentTarget.selectionStart ?? 0;
        const currentSelEnd = event.currentTarget.selectionEnd ?? currentSelStart;
        const expected = expectedStateRef.current;

        // DOM と selection の両方を検証
        // Unicode 正規化（NFC）を適用して比較（IME が NFD で入力する可能性があるため）
        const normalizedDOM = currentDOMValue.normalize('NFC');
        const normalizedExpected = expected.renderedText.normalize('NFC');
        const isDOMMismatch = normalizedDOM !== normalizedExpected;
        const isSelectionMismatch =
          currentSelStart !== expected.selectionStart ||
          currentSelEnd !== expected.selectionEnd;

        if (isDOMMismatch || isSelectionMismatch) {
          // ブラウザが preventDefault() を無視して DOM を変更した（Android Chrome の動作）
          if (!GENKOUYOUSHI_ANDROID.validationOnly) {
            // DOM を期待値に修正（状態は beforeInput で既に更新済み）
            event.currentTarget.value = expected.renderedText;
            event.currentTarget.setSelectionRange(
              expected.selectionStart,
              expected.selectionEnd
            );

            // 次の useEffect での同期をスキップ
            skipNextSyncRef.current = true;

            updateCaret();
          }
        }

        expectedStateRef.current = null;
        handledByBeforeInputRef.current = false;
        awaitingNativeInputRef.current = false;
        userOnInput?.(event);
        return;
      }

      if (handledByBeforeInputRef.current) {
        handledByBeforeInputRef.current = false;
        awaitingNativeInputRef.current = false;
        debugLog('⏭️ handleInput skipped (handled by beforeInput)');
        userOnInput?.(event);
        return;
      }

      const isComposingInput =
        isComposingRef.current ||
        nativeEvent?.isComposing ||
        nativeEvent?.inputType?.startsWith?.('insertComposition');

      if (isComposingInput) {
        userOnInput?.(event);
        return;
      }

      // Android で composition が終わった直後の入力を処理
      // Slate のアプローチ: DOM から状態を同期（reconciliation）
      const platformInfo = getPlatformInfo();
      const isAndroidPath = GENKOUYOUSHI_ANDROID.enabled && platformInfo.isAndroidChrome;

      if (isAndroidPath && !handledByBeforeInputRef.current) {
        // Android で beforeInput が処理されなかった場合（preventDefault が効かなかった）
        // DOM の値を信頼して状態を同期
        const currentDOMValue = event.currentTarget.value;
        const currentCaret = event.currentTarget.selectionStart ?? 0;
        const manualOnly = stripAutoBreaksFromRendered(currentDOMValue, GENKOUYOUSHI_GRID.cols);
        const nextWrapped = wrapAndMap(manualOnly, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);

        // DOM と rendered が一致しない場合のみ更新
        if (currentDOMValue !== nextWrapped.renderedText) {
          event.currentTarget.value = nextWrapped.renderedText;
          // caret 位置を調整（auto-break の影響を考慮）
          const adjustedCaret = Math.min(currentCaret, nextWrapped.renderedText.length);
          event.currentTarget.setSelectionRange(adjustedCaret, adjustedCaret);
          updateCaret();
        }

        if (manualOnly !== manualText) {
          setManualText(manualOnly);
          setDisplayedText(nextWrapped.renderedText);
          skipNextSyncRef.current = true;
        }

        userOnInput?.(event);
        return;
      }

      const currentValue = event.currentTarget.value;
      const inputType = nativeEvent?.inputType ?? '';

      // inputType ベースの削除検出（拡張版）
      const isDeletionByInputType = isDeletionInputType(inputType);

      // 従来の keydown ベースの検出と組み合わせ
      const isDeletionOperation = isDeletionByInputType || lastDeleteKeyRef.current !== null;

      // Android で keydown が取得できなかった場合のフォールバック
      const isAndroidDeletionFallback =
        isDeletionByInputType && !lastDeleteKeyRef.current && isAndroidChrome();

      if (isAndroidDeletionFallback && GENKOUYOUSHI_ANDROID.enabled) {
        // DOM の値から manual テキストを抽出
        const manualOnly = stripAutoBreaksFromRendered(currentValue, GENKOUYOUSHI_GRID.cols);
        const nextWrapped = wrapAndMap(manualOnly, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);

        // caret 位置を現在の DOM から取得
        const currentCaret = event.currentTarget.selectionStart ?? 0;

        // DOM と状態を同期
        if (event.currentTarget.value !== nextWrapped.renderedText) {
          event.currentTarget.value = nextWrapped.renderedText;
        }

        // caret 位置を調整（auto-break の影響を考慮）
        const adjustedCaret = Math.min(currentCaret, nextWrapped.renderedText.length);
        event.currentTarget.setSelectionRange(adjustedCaret, adjustedCaret);

        setManualText(manualOnly);
        setDisplayedText(nextWrapped.renderedText);
        skipNextSyncRef.current = true;
        updateCaret();

        userOnInput?.(event);
        return;
      }

      if (isDeletionOperation && !handledByBeforeInputRef.current) {
        const snapshot = wrapAndMap(manualText, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
        const selStart = keydownSelStartRef.current ?? (textareaRef.current?.selectionStart ?? 0);
        const selEnd = keydownSelEndRef.current ?? (textareaRef.current?.selectionEnd ?? selStart);
        const manualStart = Math.min(snapshot.renderedToManual[selStart] ?? manualText.length, manualText.length);
        const manualEnd = Math.min(snapshot.renderedToManual[selEnd] ?? manualText.length, manualText.length);

        let updated = manualText;
        let newManualCaret = manualStart;

        if (manualStart !== manualEnd) {
          updated = manualText.slice(0, manualStart) + manualText.slice(manualEnd);
          newManualCaret = manualStart;
        } else if (lastDeleteKeyRef.current === 'Backspace') {
          if (manualStart > 0) {
            const g = Array.from(manualText);
            g.splice(manualStart - 1, 1);
            updated = g.join('');
            newManualCaret = manualStart - 1;
          } else {
            lastDeleteKeyRef.current = null;
            keydownSelStartRef.current = null;
            keydownSelEndRef.current = null;
            userOnInput?.(event);
            return;
          }
        } else if (lastDeleteKeyRef.current === 'Delete') {
          const g = Array.from(manualText);
          if (manualStart < g.length) {
            g.splice(manualStart, 1);
            updated = g.join('');
            newManualCaret = manualStart;
          } else {
            lastDeleteKeyRef.current = null;
            keydownSelStartRef.current = null;
            keydownSelEndRef.current = null;
            userOnInput?.(event);
            return;
          }
        }

        const wrappedNext = wrapAndMap(updated, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
        const renderedCaret = wrappedNext.manualToRendered[newManualCaret] ?? wrappedNext.renderedText.length;

        if (textareaRef.current) {
          textareaRef.current.value = wrappedNext.renderedText;
          textareaRef.current.setSelectionRange(renderedCaret, renderedCaret);
        }

        setManualText(updated);
        setDisplayedText(wrappedNext.renderedText);
        updateCaret();
        lastDeleteKeyRef.current = null;
        keydownSelStartRef.current = null;
        keydownSelEndRef.current = null;
        userOnInput?.(event);
        return;
      }

      debugLog('⚙️ handleInput processing:', {
        currentValue: currentValue.slice(0, 30),
        manualText: manualText.slice(0, 30),
        inputType,
      });

      const manualOnly = stripAutoBreaksFromRendered(currentValue, GENKOUYOUSHI_GRID.cols);
      let nextManual = manualOnly;
      let nextWrapped = wrapAndMap(nextManual, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);

      const sanitizedManual = stripAutoBreaksFromRendered(nextWrapped.renderedText, GENKOUYOUSHI_GRID.cols);
      if (sanitizedManual !== nextManual) {
        nextManual = sanitizedManual;
        nextWrapped = wrapAndMap(nextManual, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
      }

      if (nextManual !== manualText) {
        if (textareaRef.current && textareaRef.current.value !== nextWrapped.renderedText) {
          textareaRef.current.value = nextWrapped.renderedText;
        }

        setManualText(nextManual);
        setDisplayedText(nextWrapped.renderedText);
      }

      debugLog('✅ handleInput completed:', {
        finalManualText: nextManual.slice(0, 30),
        finalRenderedText: nextWrapped.renderedText.slice(0, 30),
        domValue: textareaRef.current?.value.slice(0, 30),
        wasDeletionOperation: isDeletionOperation,
      });

      userOnInput?.(event);
    },
    [userOnInput, manualText, setManualText, textareaRef, setDisplayedText, updateCaret]
  );

  return {
    handleBeforeInput,
    handleInput,
    isComposingRef,
    handledByBeforeInputRef,
    awaitingNativeInputRef,
    skipNextSyncRef,
    processedByKeydownRef,
    lastDeleteKeyRef,
    keydownSelStartRef,
    keydownSelEndRef,
  };
};
