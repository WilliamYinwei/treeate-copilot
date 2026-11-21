# Change Log

All notable changes to the "treeate-copilot" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2026-11-21

### Added

- Parameter table CSV import and export with the `Name,Description,<parameter>...` layout, where 1/2/3 leading spaces in `Name` denote project, test suite, and test case.
- Parameter table coverage for project (`.tp`), test suite, and test case rows, including inherited values.
- Create parameter column and delete parameter column actions in the parameter table.
- Simplified Chinese and English UI, controlled by `treeate.language` (`auto`, `zh-cn`, `en`); menus and command titles follow the VS Code display language.
- Expand All action in the TreeATE project view.
- DLL interface page for `libs/*.dll`, listing exported functions and parameter names through the Qt inspector.
- API completion and signature help for the injected `__ate` object.
- Editable JSON document opened side by side with the property panel when a `.tp`/`.tpx` file is opened.
- English README (`README.en.md`) alongside the Simplified Chinese README.

### Changed

- Aligned the extension description and documentation with TreeATE V3.0.
- Localized parameter table messages, CSV validation errors, engine output, DLL interface page, and input dialogs.

### Fixed

- CSV import no longer garbles Chinese: UTF-8 (with or without BOM), UTF-16 LE, and GBK are detected automatically; export writes UTF-8 with BOM and CRLF.
- Deleting a parameter column now updates `.tp` files even when the value comes from an inherited ancestor definition.
- The parameter table no longer omits test suite rows and suite parameters when a project is selected.
- The "new parameter column" button no longer wraps onto a second line.

## [0.0.3] - 2026-09-13

- TreeATE V2.4 compatible `.tp` / `.tpx` project management.
- Three-level project tree, parameter matrix and property editor.
- Script navigation/template generation, resource import and TestEngine runner.
