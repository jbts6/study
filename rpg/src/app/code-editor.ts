import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { python } from "@codemirror/lang-python";

export type CodeEditorHandle = Readonly<{
  getValue(): string;
  setValue(value: string): void;
  setReadOnly(readOnly: boolean): void;
  focus(): void;
  destroy(): void;
}>;

export function mountCodeEditor(
  parent: HTMLElement,
  initialValue: string,
  onChange: (value: string) => void,
): CodeEditorHandle {
  const editable = new Compartment();
  const state = EditorState.create({
    doc: initialValue,
    extensions: [
      basicSetup,
      python(),
      editable.of(EditorView.editable.of(true)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString());
      }),
      EditorView.theme({
        "&": { height: "100%", backgroundColor: "transparent", color: "var(--text)" },
        ".cm-content": { fontFamily: "var(--font-code)", fontSize: "14px" },
        ".cm-gutters": { backgroundColor: "var(--surface-deep)", color: "var(--text-muted)", border: "0" },
        ".cm-cursor": { borderLeftColor: "var(--arcane)" },
        ".cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--arcane) 28%, transparent) !important" },
      }),
    ],
  });
  const view = new EditorView({ state, parent });

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      if (value === view.state.doc.toString()) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    },
    setReadOnly: (readOnly) => {
      view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!readOnly)) });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
