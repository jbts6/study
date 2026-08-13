import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const pythonLightHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.operatorKeyword, tags.moduleKeyword, tags.self, tags.bool, tags.atom, tags.null], color: "#0000ff" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.definition(tags.function(tags.variableName)), tags.definition(tags.function(tags.propertyName))], color: "#795e26" },
  { tag: [tags.string, tags.docString, tags.character, tags.attributeValue], color: "#a31515" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: "#008000" },
  { tag: [tags.number, tags.integer, tags.float], color: "#098658" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "#267f99" },
  { tag: [tags.propertyName, tags.attributeName], color: "#001080" },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket], color: "#1f2328" },
  { tag: tags.invalid, color: "#c9362b" },
], { themeType: "light" });

const lightEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#ffffff",
    color: "#1f2328",
    colorScheme: "light",
  },
  ".cm-scroller": { backgroundColor: "#ffffff" },
  ".cm-content": {
    minHeight: "100%",
    boxSizing: "border-box",
    padding: "10px 12px 24px",
    backgroundColor: "transparent",
    color: "#1f2328",
    fontFamily: "var(--font-code)",
    fontSize: "14px",
    lineHeight: "1.55",
  },
  ".cm-gutters": {
    backgroundColor: "#f6f8fa",
    color: "#6e7781",
    border: "0",
    borderRight: "1px solid #d0d7de",
  },
  ".cm-activeLine": { backgroundColor: "rgb(246 248 250 / 55%)" },
  ".cm-activeLineGutter": { backgroundColor: "#f6f8fa", color: "#1f2328" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#0078d4" },
  ".cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#add6ff !important" },
  ".cm-content::selection": { backgroundColor: "#add6ff" },
  ".cm-matchingBracket": { backgroundColor: "#e8f2ff", border: "1px solid #0078d4" },
  ".cm-nonmatchingBracket": { backgroundColor: "#fff1f0", border: "1px solid #c9362b" },
}, { dark: false });

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
      syntaxHighlighting(pythonLightHighlightStyle),
      editable.of(EditorView.editable.of(true)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString());
      }),
      lightEditorTheme,
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
