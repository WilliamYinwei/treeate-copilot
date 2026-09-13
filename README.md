# TreeATE Copilot

面向 VS Code 1.115+ / Windows x64 的 TreeATE V2.4 工程扩展。扩展直接读写原版 `.tp`、`.tpx` JSON，不引入私有工程格式，并保留文件中的未知字段以及 `Parameter` 的对象/数组表示。

## 功能

- TreeATE 活动栏：三级工程树（工程 → 测试套 → 测试项）和可编辑参数矩阵。
- 节点新增、同级插入、删除、重命名、同父级拖拽排序。
- tpx、tp、测试套和测试项的主题自适应属性 Webview。
- 参数名双端校验；仅接受字母、数字和下划线。
- 测试项 > 测试套 > 工程的参数继承与覆盖。
- `.py` 脚本生命周期函数定位和缺失模板生成。
- dll/py/js 导入 `libs`，png/jpg/jpeg/gif 导入 `images`。
- `.tp/.tpx` 外部修改监听和自动刷新。
- F5 调用 TestEngine，输出到 `TreeATE Copilot` 日志通道。

## 开发与运行

```powershell
npm install
npm run compile
```

在本仓库中按 F5 启动“Run Extension”调试配置。扩展宿主中打开 TreeATE 活动栏，或从命令面板运行 `TreeATE: 新建工程` / `TreeATE: 打开工程`。

TestEngine 可在设置中指定：

- `treeate.testEnginePath`：`TestEngine.exe` 的绝对路径。留空时先查找工程根目录，再使用 PATH。
- `treeate.testEngineArguments`：参数模板，支持 `${tpx}`、`${projectDir}`、`${projectName}`。
- `treeate.openScriptOnSelect`：选择树节点时是否打开并定位关联函数。

## 源码目录

```text
treeate-copilot/
├─ media/treeate.svg
├─ src/
│  ├─ extension.ts                # 激活、命令、工程创建与资源导入
│  ├─ model.ts                    # TreeATE JSON/参数兼容层
│  ├─ projectStore.ts             # 工程加载、保存、监听和节点操作
│  ├─ projectTree.ts              # TreeView 与同级拖拽
│  ├─ parameterTableView.ts       # 参数矩阵 WebviewView
│  ├─ propertyPanel.ts            # 右侧属性 WebviewPanel
│  ├─ scriptService.ts            # 脚本函数定位和模板生成
│  ├─ engineRunner.ts             # TestEngine 与 Output 通道
│  ├─ treeAteApiIntelliSense.ts   # 智能API补全
│  ├─ webview/
│  │  ├─ parameterTable.js
│  │  ├─ properties.js
│  │  └─ webview.css
│  └─ test/extension.test.ts
├─ package.json
└─ tsconfig.json
```

## 命令

| 命令 ID | 标题 |
|---|---|
| `treeate.newProject` | TreeATE: 新建工程 |
| `treeate.openProject` | TreeATE: 打开工程 |
| `treeate.refresh` | TreeATE: 刷新工程 |
| `treeate.addChild` | 新增子节点 |
| `treeate.insertSibling` | 插入同级节点 |
| `treeate.deleteNode` | 删除 |
| `treeate.renameNode` | 重命名 |
| `treeate.importResource` | 导入资源 |
| `treeate.openProperties` | 打开属性面板 |
| `treeate.openScript` | 打开关联脚本 |
| `treeate.openSetup` | 跳转 setup 函数 |
| `treeate.openTeardown` | 跳转 teardown 函数 |
| `treeate.generateFunctions` | 生成生命周期函数模板 |
| `treeate.runProject` | TreeATE: 运行当前工程（F5） |

## 兼容策略

写回时仅修改用户编辑的已知字段；额外的 TreeATE 字段会原样保留。参数既支持对象形式，也支持 `[{"Name":"...","Value":"..."}]` 形式，并尽量保留原表示。工程目录中的 `libs`、`images` 名称与位置不会改变。