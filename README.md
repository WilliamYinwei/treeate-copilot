# TreeATE Copilot

面向 VS Code 1.115+ / Windows x64 的 TreeATE V3.0 工程扩展。扩展直接读写原版 `.tp`、`.tpx` JSON，不引入私有工程格式，并保留文件中的未知字段以及 `Parameter` 的对象/数组表示。

## 功能

- TreeATE 活动栏：三级工程树（工程 → 测试套 → 测试项）和可编辑参数矩阵。
- 节点新增、同级插入、删除、重命名、同父级拖拽排序。
- tpx、tp、测试套和测试项的主题自适应属性 Webview。
- 打开 `.tp/.tpx` 时自动并排显示可编辑 JSON 与属性配置面板。
- 参数名双端校验；仅接受字母、数字和下划线。
- 测试项 > 测试套 > 工程的参数继承与覆盖。
- `.py` 脚本生命周期函数定位和缺失模板生成。
- TreeATE 注入对象 `__ate` 的 API 补全、参数提示和悬停文档，无需在测试脚本中添加 import。
- dll/py/js 导入 `libs`，png/jpg/jpeg/gif 导入 `images`。
- `.tp/.tpx` 外部修改监听和自动刷新。
- F5 调用 TestEngine，输出到 `TreeATE Copilot` 日志通道。

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

