# TreeATE Copilot

English | [简体中文](README.md)

A VS Code extension for TreeATE V3.0 projects on VS Code 1.115+ / Windows x64. It reads and writes native `.tp` and `.tpx` JSON directly, introduces no proprietary project format, and preserves unknown fields as well as both object and array representations of `Parameter`.

## Features

- TreeATE activity bar: three-level project tree (project → test suite → test case) with an editable parameter table.
- Expand all and refresh from the view title; add, insert sibling, delete, rename, and drag to reorder nodes under the same parent.
- Theme-aware property Webviews for tpx, tp, test suites, and test cases.
- Parameter inheritance and override: test case > test suite > project.
- Parameter table supports creating and deleting parameter columns, plus CSV import and export.
- DLL interface page for `libs/*.dll`: shows exported functions and parameters (parsed by the Qt inspector).
- `.py` lifecycle function navigation and template generation; completion and signature help for the injected `__ate` API.
- Import dll/py/js into `libs`, and png/jpg/jpeg/gif into `images`.
- Watches external changes to `.tp`/`.tpx` files and refreshes automatically.
- Press F5 to run TestEngine; output goes to the `TreeATE Copilot` channel.
- Simplified Chinese and English UI; follows the VS Code display language by default.

## Parameter Table and CSV

The table reflects the selected level:

- Project selected: one row per `.tp` project, all test suite rows, and their test case rows.
- Test suite selected: the suite row and its test case rows.
- Test case selected: only that test case row.
- Italic values are inherited; editing any cell writes to the `Parameter` object of the row's own level.
- The `×` button in a column header deletes that parameter column. It removes the parameter from every node in the current table scope, including ancestor definitions that supply inherited values; a confirmation dialog is shown first.

CSV import and export are available only when a test project node is selected. The column layout is fixed:

```csv
Name,Description,timeout,retries
 demo,Main project,10,
  suite1,Smoke suite,20,2
   case1,Login flow,30,3
```

- Leading spaces in `Name` encode the level: 1 space = test project (one row per `.tp`), 2 spaces = test suite, 3 spaces = test case.
- The second column must be `Description`; all remaining columns are parameters, whose names may contain only letters, digits, and underscores.
- Import matches projects, suites, and cases by name. Unknown or duplicate names abort the import without writing any file.
- Import auto-detects UTF-8 (with or without BOM), UTF-16 LE, and GBK. Export writes UTF-8 with BOM and CRLF so Excel displays Chinese correctly.
- Export contains each level's own parameters, not inherited values. Empty cells are imported as empty strings.

## Settings

| Setting | Description |
|---|---|
| `treeate.testEnginePath` | Absolute path to `TestEngine.exe`. When empty, the project root is searched first, then PATH. |
| `treeate.testEngineArguments` | Argument template passed to TestEngine. Supports `${tpx}`, `${projectDir}`, and `${projectName}`. |
| `treeate.qtInspectorPath` | Path to `treeate-qt-inspector.exe`. When empty, the bundled `native/bin/treeate-qt-inspector.exe` is used. |
| `treeate.openScriptOnSelect` | Automatically open and jump to the associated script function when a test suite or test case is selected. |
| `treeate.language` | Language for extension panels and dialogs: `auto` (default, follow VS Code), `zh-cn`, or `en`. Menus and command titles follow the VS Code display language. |

## Commands

| Command ID | Title |
|---|---|
| `treeate.newProject` | TreeATE: New Project |
| `treeate.openProject` | TreeATE: Open Project |
| `treeate.refresh` | TreeATE: Refresh Project |
| `treeate.expandAll` | TreeATE: Expand All |
| `treeate.runProject` | TreeATE: Run Current Project (F5) |
| `treeate.addChild` | Add Child Node |
| `treeate.insertSibling` | Insert Sibling Node |
| `treeate.deleteNode` | Delete |
| `treeate.renameNode` | Rename |
| `treeate.importResource` | Import Resources |
| `treeate.importParameterCsv` | Import Parameter CSV |
| `treeate.exportParameterCsv` | Export Parameter CSV |
| `treeate.openProperties` | Open Properties Panel |
| `treeate.openScript` | Open Associated Script |
| `treeate.openSetup` | Go to setup Function |
| `treeate.openTeardown` | Go to teardown Function |
| `treeate.generateFunctions` | Generate Lifecycle Function Templates |

## Development

```powershell
npm install
npm run compile
```

Press F5 in this repository to launch the "Run Extension" debug configuration. In the Extension Development Host, open the TreeATE activity bar or run `TreeATE: New Project` / `TreeATE: Open Project` from the Command Palette.

The DLL interface page relies on the Qt inspector. Rebuild it when needed (requires CMake and Qt):

```powershell
npm run build:qt-inspector
```

The binary is written to `native/bin/treeate-qt-inspector.exe`; you can point `treeate.qtInspectorPath` to another location.

## Project Layout

```text
treeate-copilot/
├─ media/treeate.svg
├─ native/                        # Qt inspector sources and build
├─ package.nls.json               # English UI strings
├─ package.nls.zh-cn.json         # Simplified Chinese UI strings
├─ src/
│  ├─ extension.ts                # Activation, commands, project creation, resource import
│  ├─ i18n.ts                     # Message catalogs and language resolution
│  ├─ model.ts                    # TreeATE JSON and parameter compatibility layer
│  ├─ parameterTableCsv.ts        # CSV parsing, validation, and serialization
│  ├─ projectStore.ts             # Load, save, watch, node and parameter operations
│  ├─ projectTree.ts              # TreeView and same-parent drag reordering
│  ├─ parameterTableView.ts       # Parameter table WebviewView
│  ├─ propertyPanel.ts            # Property WebviewPanel
│  ├─ dllEditor.ts                # DLL interface page
│  ├─ dllInspector.ts             # Qt inspector invocation and result parsing
│  ├─ scriptService.ts            # Script function navigation and templates
│  ├─ engineRunner.ts             # TestEngine process and Output channel
│  ├─ treeAteApiIntelliSense.ts   # `__ate` API completion
│  ├─ webview/
│  │  ├─ parameterTable.js
│  │  ├─ properties.js
│  │  └─ webview.css
│  └─ test/extension.test.ts
├─ package.json
└─ tsconfig.json
```

## Compatibility

Only known fields edited by the user are modified on write-back; additional TreeATE fields are preserved verbatim. Parameters support both object form and `[{"Name":"...","Value":"..."}]` form, keeping the original representation whenever possible. The names and locations of `libs` and `images` inside a project directory are never changed.
