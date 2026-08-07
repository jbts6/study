import { basicSetup } from "codemirror";
import { go } from "@codemirror/lang-go";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

export interface CodeEditor {
  getCode(): string;
  setCode(code: string): void;
  focus(): void;
  destroy(): void;
}

export function createCodeEditor(parent: HTMLElement, initialCode: string, onChange: (code: string) => void): CodeEditor {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) onChange(update.state.doc.toString());
  });
  const state = EditorState.create({
    doc: initialCode,
    extensions: [basicSetup, go(), oneDark, updateListener],
  });
  const view = new EditorView({ state, parent });

  return {
    getCode: () => view.state.doc.toString(),
    setCode: (code) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } }),
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
