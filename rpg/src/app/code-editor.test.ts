import { EditorView } from "codemirror";
import { syntaxTree } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { mountCodeEditor } from "./code-editor";

function syntaxTreeText(parent: HTMLElement): string {
  const content = parent.querySelector(".cm-content");
  if (!(content instanceof HTMLElement)) throw new Error("CodeMirror content was not mounted");
  const view = EditorView.findFromDOM(content);
  if (view === null) throw new Error("CodeMirror view was not mounted");
  return syntaxTree(view.state).toString();
}

describe("mountCodeEditor", () => {
  it("loads Go syntax for a Go editor", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const editor = mountCodeEditor(parent, "package main\n\nfunc main() {}\n", "go", () => undefined);

    expect(syntaxTreeText(parent)).toContain("PackageClause");

    editor.destroy();
    parent.remove();
  });

  it("keeps Python syntax and change handling for the default editor", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const changes: string[] = [];
    const editor = mountCodeEditor(parent, "def choose_turn(world):\n    return {}\n", "python", (value) => changes.push(value));

    expect(syntaxTreeText(parent)).toContain("FunctionDefinition");
    editor.setValue("def choose_turn(world):\n    return {'wait': True}\n");

    expect(editor.getValue()).toContain("wait");
    expect(changes.at(-1)).toContain("wait");

    editor.destroy();
    parent.remove();
  });
});
