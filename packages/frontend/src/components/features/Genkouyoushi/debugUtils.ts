import { debugGenkouyoushi, getManualFromRendered } from '@/lib/genkouyoushiText';
import { wrapAndMap } from '@/lib/genkouyoushiText';
import { GENKOUYOUSHI_GRID } from './constants';

export const isDebugEnabled = (): boolean => {
  return typeof window !== 'undefined' && window.localStorage.getItem('genkouyoushi-debug') === 'true';
};

export const debugLog = (message: string, data?: unknown): void => {
  if (isDebugEnabled()) {
    if (data !== undefined) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

export const debugLogGroup = (title: string, callback: () => void): void => {
  if (isDebugEnabled()) {
    console.group(title);
    callback();
    console.groupEnd();
  }
};

export const debugLogState = (
  label: string,
  manualText: string,
  renderedText: string,
  cols: number = GENKOUYOUSHI_GRID.cols,
  rows: number = GENKOUYOUSHI_GRID.rows
): void => {
  if (isDebugEnabled()) {
    debugGenkouyoushi.logState(label, manualText, renderedText, cols, rows);
  }
};

export const setupDebugUtilities = (textareaRef: React.RefObject<HTMLTextAreaElement | null>): void => {
  // Next.js / Vite 共通: process.env.NODE_ENV を利用
  const isDev = process.env.NODE_ENV === 'development';
  if (typeof window !== 'undefined' && isDev) {
    const debugOn = isDebugEnabled();
    const globalDebug = {
      ...debugGenkouyoushi,
      enableDebugLogging: () => {
        window.localStorage.setItem('genkouyoushi-debug', 'true');
        console.log('🟢 Genkouyoushi debug logging enabled');
      },
      disableDebugLogging: () => {
        window.localStorage.removeItem('genkouyoushi-debug');
        console.log('🔴 Genkouyoushi debug logging disabled');
      },
      getCurrentState: () => {
        const currentDOMValue = textareaRef.current?.value || '';
        const currentManualText = getManualFromRendered(currentDOMValue, GENKOUYOUSHI_GRID.cols);
        debugGenkouyoushi.logState(
          'Current State',
          currentManualText,
          currentDOMValue,
          GENKOUYOUSHI_GRID.cols,
          GENKOUYOUSHI_GRID.rows,
        );
      },
      checkDOMSync: () => {
        if (textareaRef.current) {
          const domValue = textareaRef.current.value;
          const currentManualText = getManualFromRendered(domValue, GENKOUYOUSHI_GRID.cols);
          const expectedValue = wrapAndMap(currentManualText, GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows).renderedText;
          console.log('🔍 DOM Sync Check:', {
            domValue: domValue.slice(0, 50),
            expectedValue: expectedValue.slice(0, 50),
            isSync: domValue === expectedValue,
          });
        }
      },
    };

    (window as typeof window & { genkouyoushiDebug?: typeof globalDebug }).genkouyoushiDebug = globalDebug;

    // デバッグが有効なときのみ、初回の自己診断テストと案内ログを表示
    if (debugOn) {
      const hasRunTest = sessionStorage.getItem('genkouyoushi-test-run');
      if (!hasRunTest) {
        console.log('🧪 Running auto deletion reflow test...');
        const testResult = debugGenkouyoushi.testDeletionReflow(GENKOUYOUSHI_GRID.cols, GENKOUYOUSHI_GRID.rows);
        if (testResult.initialCorrect && testResult.reflowCorrect) {
          console.log('✅ All deletion reflow tests passed!');
        } else {
          console.error('❌ Deletion reflow tests failed:', testResult);
        }
        sessionStorage.setItem('genkouyoushi-test-run', 'true');
      }

      console.log('💡 Use window.genkouyoushiDebug.enableDebugLogging() to enable real-time debugging');
    }
  }
};