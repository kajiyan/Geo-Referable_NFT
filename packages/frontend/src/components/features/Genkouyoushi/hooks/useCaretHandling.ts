import { useCallback, useState } from 'react';
import { calculateCaretCellIndex } from '@/lib/genkouyoushiText';
import { GENKOUYOUSHI_GRID } from '../constants';

interface UseCaretHandlingProps {
  displayedText: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const useCaretHandling = ({ displayedText, textareaRef }: UseCaretHandlingProps) => {
  const [caretIndex, setCaretIndex] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const updateCaret = useCallback(() => {
    if (!textareaRef.current) {
      return;
    }
    if (!isFocused) {
      setCaretIndex(null);
      return;
    }
    const selectionStart = textareaRef.current.selectionStart ?? 0;
    const index = calculateCaretCellIndex(displayedText, selectionStart, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
    setCaretIndex(index);
  }, [displayedText, isFocused, textareaRef]);

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>, userOnFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void) => {
      setIsFocused(true);
      updateCaret();
      userOnFocus?.(event);
    },
    [updateCaret]
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>, userOnBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void) => {
      setIsFocused(false);
      setCaretIndex(null);
      userOnBlur?.(event);
    },
    []
  );

  return {
    caretIndex,
    isFocused,
    updateCaret,
    handleFocus,
    handleBlur,
  };
};