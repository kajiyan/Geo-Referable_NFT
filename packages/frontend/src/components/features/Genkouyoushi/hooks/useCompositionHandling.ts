import { useCallback, useRef, useEffect } from 'react';
import { stripAutoBreaksFromRendered, wrapAndMap } from '@/lib/genkouyoushiText';
import { GENKOUYOUSHI_GRID, GENKOUYOUSHI_PERFORMANCE } from '../constants';
import { debugLog } from '../debugUtils';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';

interface UseCompositionHandlingProps {
  manualText: string;
  setManualText: (text: string) => void;
  setDisplayedText: (text: string) => void;
  updateCaret: () => void;
  isComposingRef: React.MutableRefObject<boolean>;
  skipNextSyncRef: React.MutableRefObject<boolean>;
  ignoreThrottledUpdateRef: React.MutableRefObject<boolean>;
  userOnCompositionStart?: (event: React.CompositionEvent<HTMLTextAreaElement>) => void;
  userOnCompositionUpdate?: (event: React.CompositionEvent<HTMLTextAreaElement>) => void;
  userOnCompositionEnd?: (event: React.CompositionEvent<HTMLTextAreaElement>) => void;
}

export const useCompositionHandling = ({
  manualText,
  setManualText,
  setDisplayedText,
  updateCaret,
  isComposingRef,
  skipNextSyncRef,
  ignoreThrottledUpdateRef,
  userOnCompositionStart,
  userOnCompositionUpdate,
  userOnCompositionEnd,
}: UseCompositionHandlingProps) => {
  const compositionFrameRef = useRef<number | null>(null);
  const compositionValueRef = useRef('');
  // Note: タイムアウトベースの強制終了は削除
  // Slate/ProseMirror/Lexical と同様、ブラウザを信頼し、
  // input イベントで reconciliation を行う方式に変更

  const debouncedCaretUpdate = useDebouncedCallback(updateCaret, GENKOUYOUSHI_PERFORMANCE.debounceDelay);
  const throttledGridUpdate = useThrottledCallback((text: string) => {
    if (ignoreThrottledUpdateRef.current) {
      debugLog('🚫 Ignored throttled update after IME composition:', text.slice(0, 30));
      return;
    }
    setDisplayedText(text);
  }, GENKOUYOUSHI_PERFORMANCE.throttleDelay);

  const stopCompositionPolling = useCallback(() => {
    if (compositionFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(compositionFrameRef.current);
      compositionFrameRef.current = null;
    }
  }, []);

  // Note: forceEndComposition と resetCompositionTimeout は削除
  // Slate/ProseMirror/Lexical と同様、ブラウザの composition イベントを信頼し、
  // handleInput で reconciliation を行う方式に変更したため不要

  const pushCompositionDisplay = useCallback(
    (rawValue: string) => {
      const manualOnly = stripAutoBreaksFromRendered(rawValue, GENKOUYOUSHI_GRID.cols);
      const wrapped = wrapAndMap(manualOnly, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
      throttledGridUpdate(wrapped.renderedText);
      return wrapped;
    },
    [throttledGridUpdate]
  );

  const pollComposition = useCallback(() => {
    if (!document.activeElement || document.activeElement.tagName !== 'TEXTAREA') {
      return;
    }
    const textarea = document.activeElement as HTMLTextAreaElement;
    const currentValue = textarea.value;
    if (currentValue !== compositionValueRef.current) {
      compositionValueRef.current = currentValue;
      pushCompositionDisplay(currentValue);
      debouncedCaretUpdate();
    }
    if (isComposingRef.current && typeof window !== 'undefined') {
      compositionFrameRef.current = window.requestAnimationFrame(pollComposition);
    } else {
      compositionFrameRef.current = null;
    }
  }, [debouncedCaretUpdate, pushCompositionDisplay, isComposingRef]);

  const startCompositionPolling = useCallback(() => {
    if (compositionFrameRef.current !== null || typeof window === 'undefined') {
      return;
    }
    compositionFrameRef.current = window.requestAnimationFrame(pollComposition);
  }, [pollComposition]);

  useEffect(() => () => {
    stopCompositionPolling();
  }, [stopCompositionPolling]);

  const handleCompositionStart = useCallback<React.CompositionEventHandler<HTMLTextAreaElement>>(
    (event) => {
      isComposingRef.current = true;
      const currentValue = event.currentTarget.value;
      compositionValueRef.current = currentValue;

      // 新しい composition が始まったら、前回の compositionEnd で設定した
      // ignore フラグをクリア（連続変換時に更新がブロックされるのを防止）
      if (ignoreThrottledUpdateRef.current) {
        ignoreThrottledUpdateRef.current = false;
        debugLog('✅ Cleared ignore flag on new composition start');
      }

      debugLog('🎌 handleCompositionStart:', {
        currentValue: currentValue.slice(0, 30),
        manualText: manualText.slice(0, 30),
      });

      pushCompositionDisplay(currentValue);
      startCompositionPolling();
      userOnCompositionStart?.(event);
    },
    [pushCompositionDisplay, startCompositionPolling, userOnCompositionStart, isComposingRef, manualText]
  );

  const handleCompositionUpdate = useCallback<React.CompositionEventHandler<HTMLTextAreaElement>>(
    (event) => {
      const currentValue = event.currentTarget.value;
      compositionValueRef.current = currentValue;

      pushCompositionDisplay(currentValue);
      debouncedCaretUpdate();
      userOnCompositionUpdate?.(event);
    },
    [debouncedCaretUpdate, pushCompositionDisplay, userOnCompositionUpdate]
  );

  const handleCompositionEnd = useCallback<React.CompositionEventHandler<HTMLTextAreaElement>>(
    (event) => {
      // Reset composition state immediately
      isComposingRef.current = false;
      stopCompositionPolling();

      const currentValue = event.currentTarget.value;

      debugLog('🎌 handleCompositionEnd processing:', {
        currentValue: currentValue.slice(0, 30),
        previousManualText: manualText.slice(0, 30),
        wasEmpty: currentValue === '',
        manualWasEmpty: manualText === '',
      });

      const manualOnly = stripAutoBreaksFromRendered(currentValue, GENKOUYOUSHI_GRID.cols);
      const wrapped = wrapAndMap(manualOnly, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);

      // Always update DOM and displayed text on composition end to handle IME + Backspace scenario
      if (event.currentTarget && event.currentTarget.value !== wrapped.renderedText) {
        event.currentTarget.value = wrapped.renderedText;
        debugLog('🔄 DOM value updated during composition end');
      }

      // Always update displayed text during composition end to ensure visual consistency
      setDisplayedText(wrapped.renderedText);
      debugLog('🖼️ Display text forced update:', {
        from: 'composition display',
        to: wrapped.renderedText.slice(0, 30),
      });

      // Update manual text if it has actually changed
      if (manualOnly !== manualText) {
        setManualText(manualOnly);

        skipNextSyncRef.current = true;

        ignoreThrottledUpdateRef.current = true;
        setTimeout(() => {
          ignoreThrottledUpdateRef.current = false;
          debugLog('✅ Throttled update ignore flag cleared');
        }, GENKOUYOUSHI_PERFORMANCE.throttleDelay + 50);

        debugLog('🚫 Skip flag set after IME composition end');
      } else {
        debugLog('🚫 No manual text change during composition end');
      }

      debouncedCaretUpdate();

      debugLog('🎌 handleCompositionEnd result:', {
        newManualText: manualOnly.slice(0, 30),
        newRenderedText: wrapped.renderedText.slice(0, 30),
        domValue: event.currentTarget?.value.slice(0, 30),
        compositionReset: !isComposingRef.current,
      });

      userOnCompositionEnd?.(event);
    },
    [stopCompositionPolling, debouncedCaretUpdate, userOnCompositionEnd, setManualText, manualText, setDisplayedText, skipNextSyncRef, ignoreThrottledUpdateRef, isComposingRef]
  );

  return {
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
    throttledGridUpdate,
  };
};