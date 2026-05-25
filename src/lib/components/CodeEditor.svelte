<script lang="ts">
  import { onMount } from "svelte";
  import type * as Monaco from "monaco-editor";

  type EditorDiagnostic = {
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    severity?: "error" | "warning";
    message: string;
  };

  let {
    value = $bindable(""),
    name = "code",
    language = "typescript",
    extraLibs = [],
    diagnostics = []
  }: {
    value?: string;
    name?: string | null;
    language?: string;
    extraLibs?: Array<{ path: string; content: string }>;
    diagnostics?: EditorDiagnostic[];
  } = $props();

  let container: HTMLDivElement;
  let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
  let model: Monaco.editor.ITextModel | undefined;
  let monacoRef: typeof Monaco | undefined;
  let suppressEditorChange = false;
  let extraLibDisposables: Array<{ dispose: () => void }> = [];

  function currentTheme() {
    return document.documentElement.classList.contains("dark") ? "devo-dark" : "devo-light";
  }

  function defineDevoThemes(monacoApi: typeof Monaco) {
    monacoApi.editor.defineTheme("devo-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "a0a1a7", fontStyle: "italic" },
        { token: "keyword", foreground: "a626a4" },
        { token: "string", foreground: "50a14f" },
        { token: "number", foreground: "986801" },
        { token: "type", foreground: "c18401" },
        { token: "identifier", foreground: "383a42" },
        { token: "delimiter", foreground: "383a42" }
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#383a42",
        "editorLineNumber.foreground": "#9d9d9f",
        "editorLineNumber.activeForeground": "#4078f2",
        "editorGutter.background": "#fbfbfb",
        "editorCursor.foreground": "#4078f2",
        "editor.lineHighlightBackground": "#f5f7fb",
        "editor.selectionBackground": "#d7e4ff",
        "editor.inactiveSelectionBackground": "#e9eef9",
        "editorIndentGuide.background1": "#eceff4",
        "editorIndentGuide.activeBackground1": "#c9d1dc",
        "editorBracketMatch.background": "#edf3ff",
        "editorBracketMatch.border": "#4078f2",
        "editorWidget.background": "#ffffff",
        "editorWidget.border": "#d7dae0",
        "editorSuggestWidget.background": "#ffffff",
        "editorSuggestWidget.border": "#d7dae0",
        "editorSuggestWidget.selectedBackground": "#eef4ff",
        "minimap.background": "#ffffff",
        "scrollbarSlider.background": "#d7dae080",
        "scrollbarSlider.hoverBackground": "#c2c7d199",
        "scrollbarSlider.activeBackground": "#abb2bf"
      }
    });

    monacoApi.editor.defineTheme("devo-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5c6370", fontStyle: "italic" },
        { token: "keyword", foreground: "c678dd" },
        { token: "string", foreground: "98c379" },
        { token: "number", foreground: "d19a66" },
        { token: "type", foreground: "e5c07b" },
        { token: "identifier", foreground: "abb2bf" },
        { token: "delimiter", foreground: "abb2bf" }
      ],
      colors: {
        "editor.background": "#1f2329",
        "editor.foreground": "#abb2bf",
        "editorLineNumber.foreground": "#5c6370",
        "editorLineNumber.activeForeground": "#61afef",
        "editorGutter.background": "#1b1f24",
        "editorCursor.foreground": "#528bff",
        "editor.lineHighlightBackground": "#252a32",
        "editor.selectionBackground": "#3a4250",
        "editor.inactiveSelectionBackground": "#2d333d",
        "editorIndentGuide.background1": "#333942",
        "editorIndentGuide.activeBackground1": "#5c6370",
        "editorBracketMatch.background": "#313842",
        "editorBracketMatch.border": "#61afef",
        "editorWidget.background": "#252a32",
        "editorWidget.border": "#343b46",
        "editorSuggestWidget.background": "#252a32",
        "editorSuggestWidget.border": "#343b46",
        "editorSuggestWidget.selectedBackground": "#303744",
        "minimap.background": "#1f2329",
        "scrollbarSlider.background": "#42495680",
        "scrollbarSlider.hoverBackground": "#50586699",
        "scrollbarSlider.activeBackground": "#5c6370"
      }
    });
  }

  function modelUri(monacoApi: typeof Monaco) {
    if (language === "dotenv") return monacoApi.Uri.parse("file:///.env");
    if (language === "json") return monacoApi.Uri.parse("file:///package.json");
    return monacoApi.Uri.parse("file:///main.ts");
  }

  function setupDotenvLanguage(monacoApi: typeof Monaco) {
    const languageExists = monacoApi.languages.getLanguages().some((item) => item.id === "dotenv");
    if (!languageExists) {
      monacoApi.languages.register({
        id: "dotenv",
        extensions: [".env"],
        aliases: ["dotenv", ".env"]
      });
      monacoApi.languages.setMonarchTokensProvider("dotenv", {
        tokenizer: {
          root: [
            [/^\s*#.*$/, "comment"],
            [/^\s*(export)(\s+)/, ["keyword", "white"]],
            [/^[A-Za-z_][A-Za-z0-9_]*(?=\s*=)/, "type"],
            [/=/, "delimiter"],
            [/"([^"\\]|\\.)*$/, "string.invalid"],
            [/"([^"\\]|\\.)*"/, "string"],
            [/'[^']*'/, "string"],
            [/[^#\s]+/, "string"]
          ]
        }
      });
    }
  }

  function validateDotenv(monacoApi: typeof Monaco, targetModel: Monaco.editor.ITextModel) {
    if (targetModel.getLanguageId() !== "dotenv") return;

    const markers: Monaco.editor.IMarkerData[] = [];
    const seen = new Map<string, number>();

    targetModel.getLinesContent().forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed;
      const separatorIndex = withoutExport.indexOf("=");
      if (separatorIndex <= 0) {
        markers.push({
          severity: monacoApi.MarkerSeverity.Error,
          message: "Expected KEY=value.",
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: line.length + 1
        });
        return;
      }

      const key = withoutExport.slice(0, separatorIndex).trim();
      const startColumn = line.indexOf(key) + 1;
      const endColumn = startColumn + key.length;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        markers.push({
          severity: monacoApi.MarkerSeverity.Error,
          message: "Environment variable names must match [A-Za-z_][A-Za-z0-9_]*.",
          startLineNumber: lineNumber,
          startColumn,
          endLineNumber: lineNumber,
          endColumn
        });
        return;
      }

      const firstLine = seen.get(key);
      if (firstLine) {
        markers.push({
          severity: monacoApi.MarkerSeverity.Warning,
          message: `Duplicate variable. The first ${key} is on line ${firstLine}.`,
          startLineNumber: lineNumber,
          startColumn,
          endLineNumber: lineNumber,
          endColumn
        });
      } else {
        seen.set(key, lineNumber);
      }
    });

    monacoApi.editor.setModelMarkers(targetModel, "devo-dotenv", markers);
  }

  function applyExtraLibs() {
    if (!monacoRef) return;

    for (const disposable of extraLibDisposables) disposable.dispose();
    extraLibDisposables = [];

    const tsDefaults = monacoRef.typescript.typescriptDefaults;
    const jsDefaults = monacoRef.typescript.javascriptDefaults;
    for (const lib of extraLibs) {
      extraLibDisposables.push(tsDefaults.addExtraLib(lib.content, lib.path));
      extraLibDisposables.push(jsDefaults.addExtraLib(lib.content, lib.path));
    }
  }

  function applyDiagnostics() {
    if (!monacoRef || !model) return;

    const markers = diagnostics.map((diagnostic) => {
      const line = Math.min(Math.max(diagnostic.line || 1, 1), model!.getLineCount());
      const column = Math.min(Math.max(diagnostic.column || 1, 1), model!.getLineMaxColumn(line));
      const endLine = Math.min(Math.max(diagnostic.endLine || line, 1), model!.getLineCount());
      const endColumn = Math.min(Math.max(diagnostic.endColumn || column + 1, 1), model!.getLineMaxColumn(endLine));

      return {
        severity:
          diagnostic.severity === "warning" ? monacoRef!.MarkerSeverity.Warning : monacoRef!.MarkerSeverity.Error,
        message: diagnostic.message,
        startLineNumber: line,
        startColumn: column,
        endLineNumber: endLine,
        endColumn
      };
    });

    monacoRef.editor.setModelMarkers(model, "devo-external", markers);
  }

  $effect(() => {
    if (!model || value === model.getValue()) return;
    suppressEditorChange = true;
    model.setValue(value);
    suppressEditorChange = false;
  });

  $effect(() => {
    extraLibs;
    applyExtraLibs();
  });

  $effect(() => {
    diagnostics;
    applyDiagnostics();
  });

  onMount(() => {
    let changeSubscription: { dispose: () => void } | undefined;
    let themeObserver: MutationObserver | undefined;
    let disposed = false;

    void (async () => {
      const [monaco, editorWorker, tsWorker, jsonWorker] = await Promise.all([
        import("monaco-editor"),
        import("monaco-editor/esm/vs/language/typescript/monaco.contribution.js"),
        import("monaco-editor/esm/vs/language/json/monaco.contribution.js"),
        import("monaco-editor/esm/vs/editor/editor.worker?worker"),
        import("monaco-editor/esm/vs/language/typescript/ts.worker?worker"),
        import("monaco-editor/esm/vs/language/json/json.worker?worker")
      ]).then(
        ([monaco, _tsContribution, _jsonContribution, editorWorker, tsWorker, jsonWorker]) =>
          [monaco, editorWorker, tsWorker, jsonWorker] as const
      );

      if (disposed) return;

      self.MonacoEnvironment = {
        getWorker(_workerId: string, label: string) {
          if (label === "typescript" || label === "javascript") return new tsWorker.default();
          if (label.startsWith("json")) return new jsonWorker.default();
          return new editorWorker.default();
        }
      };

      const monacoApi = monaco;

      monacoRef = monacoApi;
      defineDevoThemes(monacoApi);
      setupDotenvLanguage(monacoApi);
      monacoApi.typescript.typescriptDefaults.setCompilerOptions({
        allowNonTsExtensions: true,
        allowJs: true,
        checkJs: true,
        module: monacoApi.typescript.ModuleKind.ESNext,
        moduleResolution: monacoApi.typescript.ModuleResolutionKind.NodeJs,
        noEmit: true,
        strict: true,
        target: monacoApi.typescript.ScriptTarget.ESNext
      });
      applyExtraLibs();

      model = monacoApi.editor.createModel(value, language, modelUri(monacoApi));
      validateDotenv(monacoApi, model);
      applyDiagnostics();
      editor = monacoApi.editor.create(container, {
        model,
        automaticLayout: true,
        bracketPairColorization: { enabled: true },
        fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 13,
        formatOnPaste: true,
        formatOnType: true,
        minimap: { enabled: false },
        overviewRulerBorder: false,
        padding: { top: 14, bottom: 14 },
        renderLineHighlight: "all",
        scrollBeyondLastLine: false,
        tabSize: 2,
        theme: currentTheme()
      });

      changeSubscription = editor.onDidChangeModelContent(() => {
        if (suppressEditorChange || !model) return;
        value = model.getValue();
        validateDotenv(monacoApi, model);
      });

      themeObserver = new MutationObserver(() => {
        monacoRef?.editor.setTheme(currentTheme());
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"]
      });
    })();

    return () => {
      disposed = true;
      for (const disposable of extraLibDisposables) disposable.dispose();
      changeSubscription?.dispose();
      themeObserver?.disconnect();
      editor?.dispose();
      model?.dispose();
    };
  });
</script>

{#if name}
  <input type="hidden" {name} {value} />
{/if}
<div class="editor-frame" bind:this={container}></div>

<style>
  .editor-frame {
    width: 100%;
    min-height: 100%;
    flex: 1;
    overflow: hidden;
    background: #1f2329;
  }

  :global(:root.light) .editor-frame {
    background: #ffffff;
  }
</style>
