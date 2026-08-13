export interface WorkspaceDocument {
  readonly path: string;
  getText(): string;
}

export interface WorkspaceFileSystem {
  exists(path: string): boolean | Promise<boolean>;
  readFile(path: string): string | Promise<string>;
  writeFile(path: string, content: string): void | Promise<void>;
}

export interface WorkspaceHost {
  readonly workspaceRoot: string;
  readonly fileSystem: WorkspaceFileSystem;
  getOpenDocument(path: string): WorkspaceDocument | undefined;
  openTextDocument(path: string): WorkspaceDocument | Promise<WorkspaceDocument>;
  showTextDocument(
    document: WorkspaceDocument,
    options: { readonly viewColumn: 1 },
  ): void | Promise<void>;
}

export interface WorkspaceState {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown | undefined): void | Promise<void>;
}
