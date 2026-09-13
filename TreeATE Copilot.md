# TreeATE Copilot

Official TreeATE V3\.0 engineering extension for VS Code\. Provides visual project tree editing, parameter management, Python IntelliSense and one\-click test engine running for native TP/TPX projects\.

## Features

- **TreeATE Activity Bar**: Three\-level project tree \(Project → Test Suite → Test Item\) and fully editable parameter matrix view\.

- **Tree Node Management**: Support adding child nodes, inserting sibling nodes, deleting, renaming, and drag\-and\-drop sorting under the same parent node\.

- **Theme\-adaptive Webview**: Provides property configuration panels for TPX, TP, test suite and test item, adapting automatically to VS Code UI themes\.

- **Split\-view Editing**: Automatically displays editable raw JSON and visual property panel side by side when opening `.tp` / `.tpx` files\.

- **Strict Parameter Validation**: Validates parameter names bidirectionally; only letters, numbers and underscores are allowed\.

- **Parameter Inheritance \& Override**: Hierarchical parameter overriding priority: Test Item \> Test Suite \> Project\.

- **Python Lifecycle Assistance**: Quickly locate setup/teardown lifecycle functions and auto\-generate standard templates for missing functions in Python test scripts\.

- **Built\-in \_\_ate IntelliSense**: Provides complete API completion, parameter hints and hover documentation for the TreeATE injected `__ate` object\. No manual import statements required in test scripts\.

- **Unified Resource Import**: Import `.dll`/`.py`/`.js` files to the `libs` directory; import image files \(png/jpg/jpeg/gif\) to the `images` directory\.

- **External Change Monitoring**: Real\-time file watching for external modifications of `.tp` / `.tpx` files with automatic project refresh\.

- **One\-click Test Execution**: Press **F5** to launch Test Engine directly, with all runtime logs output to the dedicated`TreeATE Copilot` output channel\.

## Commands

|Command ID|Title|
|---|---|
|`treeate.newProject`|TreeATE: New Project|
|`treeate.openProject`|TreeATE: Open Project|
|`treeate.refresh`|TreeATE: Refresh Project|
|`treeate.addChild`|Add Child Node|
|`treeate.insertSibling`|Insert Sibling Node|
|`treeate.deleteNode`|Delete|
|`treeate.renameNode`|Rename Node|
|`treeate.importResource`|Import Resource|
|`treeate.openProperties`|Open Properties Panel|
|`treeate.openScript`|Open Associated Script|
|`treeate.openSetup`|Jump to Setup Function|
|`treeate.openTeardown`|Jump to Teardown Function|
|`treeate.generateFunctions`|Generate Lifecycle Function Template|
|`treeate.runProject`|TreeATE: Run Current Project \(F5\)|
