import { useCallback } from 'react';
import { wrapAndMap } from '@/lib/genkouyoushiText';
import { GENKOUYOUSHI_GRID, GENKOUYOUSHI_PERFORMANCE } from '../constants';
import { debugLog } from '../debugUtils';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

interface UseKeyboardHandlingProps {
  manualText: string;
  setManualText: (text: string) => void;
  setDisplayedText: (text: string) => void;
  updateCaret: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isComposingRef: React.MutableRefObject<boolean>;
  processedByKeydownRef: React.MutableRefObject<boolean>;
  handledByBeforeInputRef: React.MutableRefObject<boolean>;
  awaitingNativeInputRef: React.MutableRefObject<boolean>;
  skipNextSyncRef: React.MutableRefObject<boolean>;
  lastDeleteKeyRef: React.MutableRefObject<'Backspace' | 'Delete' | null>;
  keydownSelStartRef: React.MutableRefObject<number | null>;
  keydownSelEndRef: React.MutableRefObject<number | null>;
  userOnKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  userOnKeyUp?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  userOnClick?: (event: React.MouseEvent<HTMLTextAreaElement>) => void;
  userOnSelect?: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
}

export const useKeyboardHandling = ({
  manualText,
  setManualText,
  setDisplayedText,
  updateCaret,
  textareaRef,
  isComposingRef,
  processedByKeydownRef,
  handledByBeforeInputRef,
  awaitingNativeInputRef,
  skipNextSyncRef,
  lastDeleteKeyRef,
  keydownSelStartRef,
  keydownSelEndRef,
  userOnKeyDown,
  userOnKeyUp,
  userOnClick,
  userOnSelect,
}: UseKeyboardHandlingProps) => {
  const debouncedCaretUpdate = useDebouncedCallback(updateCaret, GENKOUYOUSHI_PERFORMANCE.debounceDelay);

  const handleSelectionChange = useCallback(() => {
    debouncedCaretUpdate();
  }, [debouncedCaretUpdate]);

  const handleKeyDown = useCallback<React.KeyboardEventHandler<HTMLTextAreaElement>>(
    (event) => {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        lastDeleteKeyRef.current = event.key;
        if (textareaRef.current) {
          keydownSelStartRef.current = textareaRef.current.selectionStart ?? null;
          keydownSelEndRef.current = textareaRef.current.selectionEnd ?? keydownSelStartRef.current;
        }

        if (isComposingRef.current) {
          userOnKeyDown?.(event);
          return;
        }

        try {
          const textarea = textareaRef.current;
          if (!textarea) {
            userOnKeyDown?.(event);
            return;
          }

          const snapshot = wrapAndMap(manualText, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
          const selStart = textarea.selectionStart ?? 0;
          const selEnd = textarea.selectionEnd ?? selStart;
          const manualStart = Math.min(snapshot.renderedToManual[selStart] ?? manualText.length, manualText.length);
          const manualEnd = Math.min(snapshot.renderedToManual[selEnd] ?? manualText.length, manualText.length);

          let updated = manualText;
          let newManualCaret = manualStart;

          if (manualStart !== manualEnd) {
            updated = manualText.slice(0, manualStart) + manualText.slice(manualEnd);
            newManualCaret = manualStart;
          } else if (event.key === 'Backspace') {
            if (manualStart > 0) {
              const g = Array.from(manualText);
              g.splice(manualStart - 1, 1);
              updated = g.join('');
              newManualCaret = manualStart - 1;
            } else {
              userOnKeyDown?.(event);
              return;
            }
          } else if (event.key === 'Delete') {
            const g = Array.from(manualText);
            if (manualStart < g.length) {
              g.splice(manualStart, 1);
              updated = g.join('');
              newManualCaret = manualStart;
            } else {
              userOnKeyDown?.(event);
              return;
            }
          }

          const wrappedNext = wrapAndMap(updated, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
          const renderedCaret = wrappedNext.manualToRendered[newManualCaret] ?? wrappedNext.renderedText.length;
          textarea.value = wrappedNext.renderedText;
          textarea.setSelectionRange(renderedCaret, renderedCaret);

          setManualText(updated);
          setDisplayedText(wrappedNext.renderedText);
          debouncedCaretUpdate();

          processedByKeydownRef.current = true;
          handledByBeforeInputRef.current = false;
          awaitingNativeInputRef.current = false;
          skipNextSyncRef.current = true;

          debugLog('🧰 Keydown deletion fallback applied', {
            key: event.key,
            manualBefore: manualText.slice(0, 30),
            manualAfter: updated.slice(0, 30),
            renderedAfter: wrappedNext.renderedText.slice(0, 30),
            caret: renderedCaret,
          });

          event.preventDefault();
          userOnKeyDown?.(event);
          return;
        } catch {
          // Fallback failed, continue with normal processing
        }
      } else {
        lastDeleteKeyRef.current = null;
        keydownSelStartRef.current = null;
        keydownSelEndRef.current = null;
      }
      userOnKeyDown?.(event);
    },
    [
      userOnKeyDown,
      manualText,
      debouncedCaretUpdate,
      setManualText,
      setDisplayedText,
      textareaRef,
      isComposingRef,
      processedByKeydownRef,
      handledByBeforeInputRef,
      awaitingNativeInputRef,
      skipNextSyncRef,
      lastDeleteKeyRef,
      keydownSelStartRef,
      keydownSelEndRef,
    ]
  );

  const handleKeyUp = useCallback<React.KeyboardEventHandler<HTMLTextAreaElement>>(
    (event) => {
      handleSelectionChange();
      userOnKeyUp?.(event);
    },
    [handleSelectionChange, userOnKeyUp]
  );

  const handleClick = useCallback<React.MouseEventHandler<HTMLTextAreaElement>>(
    (event) => {
      handleSelectionChange();
      userOnClick?.(event);
    },
    [handleSelectionChange, userOnClick]
  );

  const handleSelect = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      handleSelectionChange();
      userOnSelect?.(event);
    },
    [handleSelectionChange, userOnSelect]
  );

  return {
    handleKeyDown,
    handleKeyUp,
    handleClick,
    handleSelect,
  };
};