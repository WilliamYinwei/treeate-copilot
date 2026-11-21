# TreeATE Copilot

[English](README.en.md) | 简体中文

面向 VS Code 1.115+ / Windows x64 的 TreeATE V3.0 工程扩展。直接读写原版 `.tp`、`.tpx` JSON，不引入私有工程格式，并保留文件中的未知字段以及 `Parameter` 的对象/数组表示。

## 功能

- TreeATE 活动栏：三级工程树（工程 → 测试套 → 测试项）与可编辑参数表。
- 工程树一键展开全部、刷新，节点新增、同级插入、删除、重命名、同父级拖拽排序。
- tpx、tp、测试套和测试项的主题自适应属性 Webview。
- 测试项 > 测试套 > 工程的参数继承与覆盖。
- 参数表支持新建参数列、删除参数列，以及 CSV 导入/导出。
- `libs/*.dll` 的 DLL 接口页：展示导出函数与参数（由 Qt 检查器解析）。
- `.py` 脚本生命周期函数定位和缺失模板生成；`__ate` 注入对象 API 补全与参数提示。
- dll/py/js 导入 `libs`，png/jpg/jpeg/gif 导入 `images`。
- `.tp/.tpx` 外部修改监听和自动刷新。
- F5 调用 TestEngine，输出到 `TreeATE Copilot` 日志通道。
- 界面支持简体中文与英文切换，默认跟随 VS Code 显示语言。

## 参数表与 CSV

参数表按当前选中层级展示：

- 选中测试工程：该工程下每个 `.tp` 的工程行、全部测试套行及其测试项行。
- 选中测试套：测试套行及其测试项行。
- 选中测试项：仅该测试项行。
- 斜体值表示继承所得；编辑任意单元格均写入该行所属层级的 `Parameter`。
- 表头 `×` 可删除参数列，会移除当前表范围内各级节点的同名参数（包括提供继承值的上级定义），删除前有确认提示。

CSV 导入仅对选中的测试工程节点可用，导出同理。列结构固定为：

```csv
Name,Description,timeout,retries
 demo,主工程,10,
  suite1,冒烟测试套,20,2
   case1,登录场景,30,3
```

- `Name` 前的空格数表示层级：1 个为测试工程（每个 `.tp` 一行），2 个为测试套，3 个为测试项。
- 第二列必须为 `Description`，其余列均为参数列，名称只允许字母、数字和下划线。
- 导入时按名称匹配工程、测试套和测试项；名称不存在或重复会直接报错，且不会写入任何文件。
- 导入自动识别 UTF-8（含 BOM）、UTF-16 LE 和 GBK；导出使用 UTF-8 BOM + CRLF，便于 Excel 直接打开中文。
- 导出内容为各层级自身参数，不包含继承值；导入时空单元格会写入空字符串。

## 设置

| 设置项 | 说明 |
|---|---|
| `treeate.testEnginePath` | `TestEngine.exe` 的绝对路径。留空时先查找工程根目录，再使用 PATH。 |
| `treeate.testEngineArguments` | 传给 TestEngine 的参数模板，支持 `${tpx}`、`${projectDir}`、`${projectName}`。 |
| `treeate.qtInspectorPath` | `treeate-qt-inspector.exe` 路径。留空时使用随扩展的 `native/bin/treeate-qt-inspector.exe`。 |
| `treeate.openScriptOnSelect` | 选择测试套或测试项时，是否自动打开并定位关联脚本函数。 |
| `treeate.language` | 扩展面板与对话框语言：`auto`（默认，跟随 VS Code）、`zh-cn`、`en`。菜单与命令标题由 VS Code 显示语言决定。 |

## 命令

| 命令 ID | 标题 |
|---|---|
| `treeate.newProject` | TreeATE: 新建工程 |
| `treeate.openProject` | TreeATE: 打开工程 |
| `treeate.refresh` | TreeATE: 刷新工程 |
| `treeate.expandAll` | TreeATE: 展开全部 |
| `treeate.runProject` | TreeATE: 运行当前工程（F5） |
| `treeate.addChild` | 新增子节点 |
| `treeate.insertSibling` | 插入同级节点 |
| `treeate.deleteNode` | 删除 |
| `treeate.renameNode` | 重命名 |
| `treeate.importResource` | 导入资源 |
| `treeate.importParameterCsv` | 导入参数 CSV |
| `treeate.exportParameterCsv` | 导出参数 CSV |
| `treeate.openProperties` | 打开属性面板 |
| `treeate.openScript` | 打开关联脚本 |
| `treeate.openSetup` | 跳转 setup 函数 |
| `treeate.openTeardown` | 跳转 teardown 函数 |
| `treeate.generateFunctions` | 生成生命周期函数模板 |

## 开发与运行

```powershell
npm install
npm run compile
```

在本仓库中按 F5 启动“Run Extension”调试配置。扩展宿主中打开 TreeATE 活动栏，或从命令面板运行 `TreeATE: 新建工程` / `TreeATE: 打开工程`。

DLL 接口页依赖 Qt 检查器，可按需重新构建（需要 CMake 与 Qt）：

```powershell
npm run build:qt-inspector
```

产物位于 `native/bin/treeate-qt-inspector.exe`，也可通过 `treeate.qtInspectorPath` 指定其他路径。

## 源码目录

```text
treeate-copilot/
├─ media/treeate.svg
├─ native/                        # Qt 检查器源码与构建脚本
├─ package.nls.json               # 英文界面文案
├─ package.nls.zh-cn.json         # 中文界面文案
├─ src/
│  ├─ extension.ts                # 激活、命令、工程创建与资源导入
│  ├─ i18n.ts                     # 中英文文案表与语言解析
│  ├─ model.ts                    # TreeATE JSON/参数兼容层
│  ├─ parameterTableCsv.ts        # CSV 解析、校验与序列化
│  ├─ projectStore.ts             # 工程加载、保存、监听、节点与参数操作
│  ├─ projectTree.ts              # TreeView 与同级拖拽
│  ├─ parameterTableView.ts       # 参数表 WebviewView
│  ├─ propertyPanel.ts            # 右侧属性 WebviewPanel
│  ├─ dllEditor.ts                # DLL 接口页
│  ├─ dllInspector.ts             # Qt 检查器调用与结果解析
│  ├─ scriptService.ts            # 脚本函数定位和模板生成
│  ├─ engineRunner.ts             # TestEngine 与 Output 通道
│  ├─ treeAteApiIntelliSense.ts   # `__ate` API 补全
│  ├─ webview/
│  │  ├─ parameterTable.js
│  │  ├─ properties.js
│  │  └─ webview.css
│  └─ test/extension.test.ts
├─ package.json
└─ tsconfig.json
```

## 兼容策略

写回时仅修改用户编辑的已知字段；额外的 TreeATE 字段会原样保留。参数既支持对象形式，也支持 `[{"Name":"...","Value":"..."}]` 形式，并尽量保留原表示。工程目录中的 `libs`、`images` 名称与位置不会改变。
