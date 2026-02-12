'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './Genkouyoushi.css';
import { cn } from '@/lib/cn';
import { wrapAndMap, getManualFromRendered } from '@/lib/genkouyoushiText';
import { GENKOUYOUSHI_GRID } from './constants';
import { getGenkouyoushiVars } from '@/lib/genkouyoushiTokens';
import type { GenkouyoushiProps } from './types';
import { createInitialManual, renderMetricIcon, isValidMetrics, getDisplayMetrics } from './utils';
import { setupDebugUtilities } from './debugUtils';
import { useInputHandling } from './hooks/useInputHandling';
import { useCompositionHandling } from './hooks/useCompositionHandling';
import { useCaretHandling } from './hooks/useCaretHandling';
import { useKeyboardHandling } from './hooks/useKeyboardHandling';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const Genkouyoushi: React.FC<GenkouyoushiProps> = ({
  size = 'large',
  value,
  defaultValue,
  onChange,
  className,
  style,
  textareaProps,
  metrics = [],
  displayOnly = false,
}) => {
  const {
    onBeforeInput: userOnBeforeInput,
    onInput: userOnInput,
    onCompositionStart: userOnCompositionStart,
    onCompositionUpdate: userOnCompositionUpdate,
    onCompositionEnd: userOnCompositionEnd,
    onFocus: userOnFocus,
    onBlur: userOnBlur,
    onKeyDown: userOnKeyDown,
    onKeyUp: userOnKeyUp,
    onClick: userOnClick,
    onSelect: userOnSelect,
    ...forwardTextareaProps
  } = textareaProps ?? {};

  const isControlled = value !== undefined;
  const [internalManual, setInternalManual] = useState(() => createInitialManual(value, defaultValue));
  const manualText = isControlled ? value ?? '' : internalManual;

  const setManualText = useCallback(
    (next: string) => {
      if (!isControlled) {
        setInternalManual(next);
      }
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const cssVars = useMemo(() => getGenkouyoushiVars(size), [size]);
  const wrap = useMemo(() => wrapAndMap(manualText, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows), [manualText]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // pendingSelectionRef は現在のロジックでは使用されていないため削除
  const ignoreThrottledUpdateRef = useRef(false);
  const [displayedText, setDisplayedText] = useState(wrap.renderedText);

  // Initialize caret handling first
  const { caretIndex, isFocused, updateCaret, handleFocus, handleBlur } = useCaretHandling({
    displayedText,
    textareaRef,
  });

  // Initialize input handling
  const {
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
  } = useInputHandling({
    manualText,
    setManualText,
    setDisplayedText,
    updateCaret,
    textareaRef,
    wrap,
    userOnBeforeInput,
    userOnInput,
  });

  // Initialize composition handling
  const {
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
  } = useCompositionHandling({
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
  });

  // Initialize keyboard handling
  const { handleKeyDown, handleKeyUp, handleClick, handleSelect } = useKeyboardHandling({
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
  });

  // Handle focus events
  const wrappedHandleFocus = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      handleFocus(event, userOnFocus);
    },
    [handleFocus, userOnFocus]
  );

  const wrappedHandleBlur = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      handleBlur(event, userOnBlur);
    },
    [handleBlur, userOnBlur]
  );

  // Textarea value sync effect
  useIsomorphicLayoutEffect(() => {
    if (!textareaRef.current) return;

    if (isComposingRef.current) return;

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    if (awaitingNativeInputRef.current || handledByBeforeInputRef.current) {
      return;
    }

    const domManual = getManualFromRendered(textareaRef.current.value, GENKOUYOUSHI_GRID.cols);
    if (domManual !== manualText) {
      return;
    }

    const newValue = wrap.renderedText;
    if (textareaRef.current.value !== newValue) {
      textareaRef.current.value = newValue;
    }
    setDisplayedText(newValue);
  }, [wrap.renderedText, manualText, isComposingRef, skipNextSyncRef, awaitingNativeInputRef, handledByBeforeInputRef]);

  // Pending selection effect was removed as no code path sets a pending selection anymore

  // Additional sync check effect
  useIsomorphicLayoutEffect(() => {
    if (!textareaRef.current || isComposingRef.current) return;

    if (skipNextSyncRef.current) {
      return;
    }

    if (awaitingNativeInputRef.current || handledByBeforeInputRef.current) {
      return;
    }

    const currentDOMValue = textareaRef.current.value;
    const expectedValue = wrap.renderedText;

    const domManual = getManualFromRendered(currentDOMValue, GENKOUYOUSHI_GRID.cols);
    if (domManual !== manualText) {
      return;
    }

    if (currentDOMValue !== expectedValue) {
      textareaRef.current.value = expectedValue;
    }
  });

  // Setup debug utilities
  useEffect(() => {
    setupDebugUtilities(textareaRef);
  }, []);

  // Generate cells for rendering
  const cells = useMemo(() => {
    const output: string[] = [];
    const lines = displayedText.split('\n');

    for (let row = 0; row < GENKOUYOUSHI_GRID.rows; row++) {
      const line = lines[row] ?? '';
      const graphemes = Array.from(line);
      for (let col = 0; col < GENKOUYOUSHI_GRID.cols; col++) {
        output.push(graphemes[col] ?? '');
      }
    }

    return output.slice(0, GENKOUYOUSHI_GRID.totalCells);
  }, [displayedText]);

  return (
    <div
      className={cn('genkouyoushi', `genkouyoushi--${size}` as const, className)}
      style={{ ...cssVars, ...style }}
      aria-label="Manuscript paper editor"
    >
      <div className="genkouyoushi__body">
        <div className="genkouyoushi__grid-container" aria-hidden="true">
          <div className="genkouyoushi__table">
            {Array.from({ length: GENKOUYOUSHI_GRID.rows }).map((_, rowIndex) => (
              <div key={rowIndex} className="genkouyoushi__row">
                {Array.from({ length: GENKOUYOUSHI_GRID.cols }).map((_, colIndex) => {
                  const cellIndex = rowIndex * GENKOUYOUSHI_GRID.cols + colIndex;
                  const isCaret = !displayOnly && caretIndex === cellIndex && isFocused;
                  return (
                    <span
                      key={colIndex}
                      className={cn('genkouyoushi__cell', isCaret && 'is-caret')}
                    >
                      <span className="genkouyoushi__cell-text">{cells[cellIndex] ?? ''}</span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {!displayOnly && (
          <textarea
            ref={textareaRef}
            className="genkouyoushi__textarea"
            maxLength={GENKOUYOUSHI_GRID.totalCells}
            onBeforeInput={handleBeforeInput}
            onInput={handleInput}
            onCompositionStart={handleCompositionStart}
            onCompositionUpdate={handleCompositionUpdate}
            onCompositionEnd={handleCompositionEnd}
            onFocus={wrappedHandleFocus}
            onBlur={wrappedHandleBlur}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onClick={handleClick}
            onSelect={handleSelect}
            {...forwardTextareaProps}
          />
        )}

        {isValidMetrics(metrics) && (
          <div className="genkouyoushi__footer">
            {getDisplayMetrics(metrics).map((metric, index) => (
              <span key={index} className="genkouyoushi__footer-group">
                {renderMetricIcon(metric.icon)}
                {metric.label && <span>{metric.label}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

Genkouyoushi.displayName = 'Genkouyoushi';