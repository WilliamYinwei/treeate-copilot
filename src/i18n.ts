import * as vscode from 'vscode';

export type Language = 'zh-cn' | 'en';

/**
 * 运行时界面文案。以中文表为键的唯一定义源；英文表必须覆盖全部键，缺失项在编译期即报错。
 * 占位符使用 {0}、{1} 形式。
 */
const zh = {
    'common.delete': '删除',

    'ext.errorMessage': '{0}：{1}',
    'ext.projectCreated': 'TreeATE 工程已创建：{0}',
    'ext.newProjectFailed': '新建工程失败',
    'ext.selectProjectRoot': '选择 TreeATE 工程根目录',
    'ext.openProjectLabel': '打开工程',
    'ext.openProjectFailed': '打开工程失败',
    'ext.refreshFailed': '刷新失败',
    'ext.suite': '测试套',
    'ext.case': '测试项',
    'ext.addNodeTitle': '新增{0}',
    'ext.addNodePrompt': '输入{0}名称',
    'ext.addNodeFailed': '新增节点失败',
    'ext.insertNodeFailed': '插入节点失败',
    'ext.renameTitle': '重命名',
    'ext.renameFailed': '重命名失败',
    'ext.deleteNodeConfirm': '确定删除“{0}”及其下级内容吗？',
    'ext.deleteFailed': '删除失败',
    'ext.importResourceFailed': '导入资源失败',
    'ext.selectProjectRootWarning': '请先在 TreeATE 测试工程窗口中选中测试工程根节点。',
    'ext.importCsvTitle': '导入参表 CSV',
    'ext.importLabel': '导入',
    'ext.csvImported': '参表已导入：更新 {0} 个节点，保存 {1} 个文件。',
    'ext.importCsvFailed': '导入参表失败',
    'ext.exportCsvTitle': '导出参表 CSV',
    'ext.exportLabel': '导出',
    'ext.csvExported': '参表已导出：{0}',
    'ext.exportCsvFailed': '导出参表失败',
    'ext.openPropertiesFailed': '打开属性面板失败',
    'ext.openScriptFailed': '打开脚本失败',
    'ext.openSetupFailed': '打开 setup 失败',
    'ext.openTeardownFailed': '打开 teardown 失败',
    'ext.generateFunctionsFailed': '生成函数失败',
    'ext.runFailed': '运行失败',
    'ext.newProjectTitle': '新建 TreeATE 工程',
    'ext.projectNamePrompt': '输入工程名称',
    'ext.projectDescriptionTitle': '工程描述',
    'ext.selectProjectLocation': '选择工程保存位置',
    'ext.selectFolderLabel': '选择文件夹',
    'ext.targetExists': '目标目录已存在：{0}',
    'ext.targetExistsPrefix': '目标目录已存在',
    'ext.autoOpenPropertiesFailed': '自动打开属性面板失败',
    'ext.openProjectRequired': '请先打开 TreeATE 工程。',
    'ext.importResourceTitle': '导入 TreeATE 资源',
    'ext.resourceFilter': 'TreeATE 资源',
    'ext.overwriteConfirm': '{0} 已存在，是否覆盖？',
    'ext.overwriteLabel': '覆盖',
    'ext.resourcesImported': '资源已导入 {0}',
    'ext.namePattern': '必须以字母开头，且只能包含字母、数字和下划线。',
    'ext.defaultSuiteDesc': '默认测试套',
    'ext.defaultCaseDesc': '默认测试项',
    'ext.setupReturnDesc': '测试套启动返回值',
    'ext.exitReturnDesc': '测试套退出返回值',
    'ext.caseReturnDesc': '测试项返回值',

    'store.noTpx': '所选文件夹中没有找到 .tpx 文件。',
    'store.noTp': '工程中没有可读取的 .tp 文件。',
    'store.noProject': '没有打开的工程。',
    'store.caseCannotAddChild': '测试项不能再添加子节点；工程树固定为三级。',
    'store.rootNoSibling': '根节点没有同级节点。',
    'store.cannotDeleteRoot': '不能删除工程根节点。',
    'store.reorderSameParent': '只能调整同一父节点下的同级顺序。',
    'store.invalidParameterRow': '参数表只能编辑测试工程、测试套或测试项行。',
    'store.selectNodeFirst': '请先选择节点。',
    'store.exportOnlyRoot': '参表导出只能在测试工程根节点执行。',
    'store.importOnlyRoot': '参表导入只能在测试工程根节点执行。',
    'store.duplicateProject': '工程中存在重名测试工程“{0}”，无法导入。',
    'store.csvProjectNotFound': 'CSV 第 {0} 行：找不到测试工程“{1}”。',
    'store.csvProjectDuplicate': 'CSV 第 {0} 行：测试工程“{1}”重复出现。',
    'store.csvMissingProjectBeforeSuite': 'CSV 第 {0} 行：测试套或测试项前缺少测试工程行。',
    'store.csvSuiteNotFound': 'CSV 第 {0} 行：找不到测试套“{1}”。',
    'store.csvSuiteAmbiguous': 'CSV 第 {0} 行：测试套“{1}”重名，无法确定导入目标。',
    'store.csvSuiteDuplicate': 'CSV 第 {0} 行：测试套“{1}”重复出现。',
    'store.csvMissingSuiteBeforeCase': 'CSV 第 {0} 行：测试项前缺少测试套行。',
    'store.csvCaseNotFound': 'CSV 第 {0} 行：找不到测试项“{1}”。',
    'store.csvCaseAmbiguous': 'CSV 第 {0} 行：测试项“{1}”在当前测试套中重名，无法确定导入目标。',
    'store.csvCaseDuplicate': 'CSV 第 {0} 行：测试项“{1}”重复出现。',
    'store.noAssociatedTp': '未找到关联的 .tp 文件。',
    'store.fileNotFound': '找不到文件：{0}',
    'store.invalidJson': '{0} 不是有效 JSON：{1}',
    'store.rootNotObject': '{0} 的根节点必须是 JSON 对象。',
    'store.refreshFailed': 'TreeATE 刷新失败：{0}',

    'model.invalidParameterName': '参数名“{0}”不合法，只允许字母、数字和下划线。',

    'paramTable.deleteColumnConfirm': '确定删除参数列“{0}”吗？将从当前参数表涉及的各级节点（含上级继承定义）移除该参数。',
    'paramTable.deleteColumnFailed': '删除参数列失败：{0}',
    'paramTable.saveFailed': '参数保存失败：{0}',

    'props.panelTitle': 'TreeATE 属性配置',
    'props.pageTitle': 'TreeATE 属性',
    'props.panelTitleWithName': 'TreeATE 属性 · {0}',
    'props.dirtyJson': '左侧 JSON 有未保存的修改，请先保存 JSON 后再保存属性配置。',
    'props.savedStatus': 'TreeATE 配置已保存',
    'props.saveFailed': 'TreeATE 配置保存失败：{0}',

    'tree.noDescription': '无描述',

    'dllEditor.binaryMessage': '该文件可能是二进制文件或使用了不受支持的文本编码，因此未在文本编辑器中显示。',
    'dllEditor.loading': '正在读取 {0} 的 Qt 元对象信息…',
    'dllEditor.unnamed': '（未命名）',
    'dllEditor.className': 'QObject 类名',
    'dllEditor.functionName': '函数名',
    'dllEditor.parameterName': '参数名',
    'dllEditor.methodSignature': 'Qt 方法签名',
    'dllEditor.noMethods': 'CreateDeviceInst 已返回 QObject*，但该对象没有声明可调用的 Qt 方法。',
    'dllEditor.pageTitle': 'TreeATE DLL 接口',

    'dllInspector.readFailed': '无法读取 DLL：{0}',
    'dllInspector.inspectorMissing': '未找到 Qt DLL 探测器。请构建 native/treeate-qt-inspector，或配置 treeate.qtInspectorPath。',
    'dllInspector.noResult': 'Qt DLL 探测器没有返回有效结果。',
    'dllInspector.invalidJson': 'Qt DLL 探测器返回了无效的 JSON。',
    'dllInspector.invalidData': 'Qt DLL 探测器返回的数据格式不正确。',
    'dllInspector.failed': 'DLL 探测失败。',
    'dllInspector.runFailed': 'Qt DLL 探测器运行失败：{0}',

    'engine.openProjectFirst': '请先打开 TreeATE 工程。',
    'engine.alreadyRunning': 'TestEngine 正在运行。',
    'engine.startFailed': '启动失败：{0}',
    'engine.exited': 'TestEngine 已退出，代码 {0}。',

    'csv.empty': 'CSV 文件为空。',
    'csv.header': 'CSV 前两列必须是 Name 和 Description。',
    'csv.invalidColumn': '参数列“{0}”不合法，只允许字母、数字和下划线。',
    'csv.duplicateColumn': '参数列“{0}”重复。',
    'csv.columnCount': 'CSV 第 {0} 行：列数为 {1}，应为 {2}。',
    'csv.emptyName': 'CSV 第 {0} 行：Name 不能为空。',
    'csv.invalidDepth': 'CSV 第 {0} 行：Name 前的空格数必须是 1、2 或 3。',
    'csv.firstMustBeProject': 'CSV 第 {0} 行：第一行必须是测试工程（名称前 1 个空格）。',
    'csv.depthJump': 'CSV 第 {0} 行：层级不能跳跃，测试套前必须有测试工程，测试项前必须有测试套。',
    'csv.noRows': 'CSV 中没有可导入的数据行。',
    'csv.quoteStart': 'CSV 第 {0} 行：引号必须出现在字段开头。',
    'csv.unclosedQuote': 'CSV 第 {0} 行：引号未闭合。',

    'script.generated': '已在 {0} 生成：{1}',
    'script.listSeparator': '、',

    'intellisense.showParameterHints': '显示参数提示',
    'intellisense.parameterDoc': '- `{0}`：{1}',
    'intellisense.OutputRst.desc': '将测试结果输出到界面，并存储到本地或远程服务器。远程存储需要自定义扩展。',
    'intellisense.OutputRst.strName': '测试结果名称。建议使用统一规范的不良代码，例如 F01003。',
    'intellisense.OutputRst.strValue': '测试结果值，字符串格式。',
    'intellisense.OutputRst.strStand': '测试结果标准的描述信息，字符串格式。',
    'intellisense.OutputRstEx.desc': 'V1.1 及以上版本支持。功能与 OutputRst 相同，并可显式指定结果状态。',
    'intellisense.OutputRstEx.strName': '测试结果名称。建议使用统一规范的不良代码。',
    'intellisense.OutputRstEx.strValue': '测试结果值，字符串格式。',
    'intellisense.OutputRstEx.strStand': '测试结果标准的描述信息，字符串格式。',
    'intellisense.OutputRstEx.rst': '结果状态：0=Info，1=Pass，2=Fail，3=Exce（异常）。',
    'intellisense.OutputError.desc': '输出错误信息。该接口由 TreeATE API 文档示例使用。',
    'intellisense.OutputError.message': '要输出的信息。',
    'intellisense.GetUserName.desc': '获取当前用户名。该接口及其返回类型由 TreeATE API 文档示例给出。',
    'intellisense.GetProjectName.desc': '获取测试工程名称。该接口及其返回类型由 TreeATE API 文档示例给出。',
    'intellisense.GetProjectVer.desc': '获取测试工程版本号。该接口及其返回类型由 TreeATE API 文档示例给出。',
    'intellisense.GetProjectDesc.desc': '获取测试工程描述信息。该接口及其返回类型由 TreeATE API 文档示例给出。',
    'intellisense.GetWorkLine.desc': '获取产线名称。该接口及其返回类型由 TreeATE API 文档示例给出。',
    'intellisense.GetWorkStation.desc': '获取工站名称。该接口及其返回类型由 TreeATE API 文档示例给出。',
    'intellisense.GetTotalRst.desc': '获取当前总测试结果状态值（0：Info信息，1：Pass成功，2：Fail失败，3：Exce异常），在V1.1.3版本以上支持。',
    'intellisense.IsStopped.desc': '判断当前测试执行是否已停止。该接口仅属于 __aterun。',

    'webview.parameterTable.empty': '选择节点后显示参数矩阵',
    'webview.parameterTable.noParameters': '当前节点下没有可显示的参数。',
    'webview.parameterTable.newColumnPlaceholder': '新增参数列（字母/数字/下划线）',
    'webview.parameterTable.addColumn': '新建参数列',
    'webview.parameterTable.nodeHeader': '节点',
    'webview.parameterTable.deleteColumnTitle': '删除参数列 {0}',
    'webview.parameterTable.inheritedFromSuite': '继承自测试套；编辑后成为当前层级参数',
    'webview.parameterTable.inheritedFromProject': '继承自测试工程；编辑后成为当前层级参数',
    'webview.parameterTable.customParameter': '当前层级自定义参数',
    'webview.parameterTable.hint': '斜体值为继承值；编辑后写入当前行所属层级（测试工程/测试套/测试项）的 Parameter，优先级：测试项 > 测试套 > 工程。',

    'webview.properties.heading': 'TreeATE 属性配置',
    'webview.properties.save': '保存',
    'webview.properties.saved': '已保存',
    'webview.properties.saving': '正在保存…',
    'webview.properties.invalid': '请修正标红的参数名或 JSON。',
    'webview.properties.basicConfig': '基本配置',
    'webview.properties.parameterName': '参数名',
    'webview.properties.parameterValue': '参数值',
    'webview.properties.description': '描述',
    'webview.properties.deleteParameter': '删除参数',
    'webview.properties.addParameter': '新增参数',
    'webview.properties.addRow': '新增行',
    'webview.properties.guiPlugins': 'GUI 插件',
    'webview.properties.parallelTasks': '并行任务配置',
    'webview.properties.globalParameters': '工程全局参数',
    'webview.properties.bindings': '组件绑定',
    'webview.properties.publicParameters': '公共参数',
    'webview.properties.suiteParameters': '测试套参数',
    'webview.properties.caseParameters': '测试项自定义参数',
    'webview.properties.parameterHint': '参数名 / 参数值 / 描述',
    'webview.properties.kind.tpx': '全局配置',
    'webview.properties.kind.tp': 'TP 配置',
    'webview.properties.kind.suite': '测试套',
    'webview.properties.kind.case': '测试项'
} as const;

export type MessageKey = keyof typeof zh;

const en: Record<MessageKey, string> = {
    'common.delete': 'Delete',

    'ext.errorMessage': '{0}: {1}',
    'ext.projectCreated': 'TreeATE project created: {0}',
    'ext.newProjectFailed': 'Failed to create project',
    'ext.selectProjectRoot': 'Select the TreeATE project root folder',
    'ext.openProjectLabel': 'Open Project',
    'ext.openProjectFailed': 'Failed to open project',
    'ext.refreshFailed': 'Refresh failed',
    'ext.suite': 'test suite',
    'ext.case': 'test case',
    'ext.addNodeTitle': 'Add {0}',
    'ext.addNodePrompt': 'Enter the {0} name',
    'ext.addNodeFailed': 'Failed to add node',
    'ext.insertNodeFailed': 'Failed to insert node',
    'ext.renameTitle': 'Rename',
    'ext.renameFailed': 'Rename failed',
    'ext.deleteNodeConfirm': 'Delete "{0}" and all its children?',
    'ext.deleteFailed': 'Delete failed',
    'ext.importResourceFailed': 'Failed to import resources',
    'ext.selectProjectRootWarning': 'Select the test project root node in the TreeATE Test Project view first.',
    'ext.importCsvTitle': 'Import Parameter CSV',
    'ext.importLabel': 'Import',
    'ext.csvImported': 'Parameters imported: {0} nodes updated, {1} files saved.',
    'ext.importCsvFailed': 'Failed to import parameters',
    'ext.exportCsvTitle': 'Export Parameter CSV',
    'ext.exportLabel': 'Export',
    'ext.csvExported': 'Parameters exported: {0}',
    'ext.exportCsvFailed': 'Failed to export parameters',
    'ext.openPropertiesFailed': 'Failed to open the properties panel',
    'ext.openScriptFailed': 'Failed to open script',
    'ext.openSetupFailed': 'Failed to open setup',
    'ext.openTeardownFailed': 'Failed to open teardown',
    'ext.generateFunctionsFailed': 'Failed to generate functions',
    'ext.runFailed': 'Run failed',
    'ext.newProjectTitle': 'New TreeATE Project',
    'ext.projectNamePrompt': 'Enter the project name',
    'ext.projectDescriptionTitle': 'Project Description',
    'ext.selectProjectLocation': 'Select where to save the project',
    'ext.selectFolderLabel': 'Select Folder',
    'ext.targetExists': 'The target directory already exists: {0}',
    'ext.targetExistsPrefix': 'The target directory already exists',
    'ext.autoOpenPropertiesFailed': 'Failed to open the properties panel automatically',
    'ext.openProjectRequired': 'Open a TreeATE project first.',
    'ext.importResourceTitle': 'Import TreeATE Resources',
    'ext.resourceFilter': 'TreeATE resources',
    'ext.overwriteConfirm': '{0} already exists. Overwrite it?',
    'ext.overwriteLabel': 'Overwrite',
    'ext.resourcesImported': 'Resources imported to {0}',
    'ext.namePattern': 'Must start with a letter and contain only letters, digits, and underscores.',
    'ext.defaultSuiteDesc': 'Default test suite',
    'ext.defaultCaseDesc': 'Default test case',
    'ext.setupReturnDesc': 'Test suite setup return value',
    'ext.exitReturnDesc': 'Test suite teardown return value',
    'ext.caseReturnDesc': 'Test case return value',

    'store.noTpx': 'No .tpx file was found in the selected folder.',
    'store.noTp': 'The project contains no readable .tp files.',
    'store.noProject': 'No project is open.',
    'store.caseCannotAddChild': 'Test cases cannot have child nodes; the project tree has a fixed three-level structure.',
    'store.rootNoSibling': 'The root node has no siblings.',
    'store.cannotDeleteRoot': 'The project root node cannot be deleted.',
    'store.reorderSameParent': 'Only nodes under the same parent can be reordered.',
    'store.invalidParameterRow': 'The parameter table can only edit test project, test suite, or test case rows.',
    'store.selectNodeFirst': 'Select a node first.',
    'store.exportOnlyRoot': 'Parameter export can only be run on the test project root node.',
    'store.importOnlyRoot': 'Parameter import can only be run on the test project root node.',
    'store.duplicateProject': 'The project contains duplicate test project "{0}" and cannot be imported.',
    'store.csvProjectNotFound': 'CSV line {0}: test project "{1}" was not found.',
    'store.csvProjectDuplicate': 'CSV line {0}: test project "{1}" appears more than once.',
    'store.csvMissingProjectBeforeSuite': 'CSV line {0}: a test suite or test case appears before any test project row.',
    'store.csvSuiteNotFound': 'CSV line {0}: test suite "{1}" was not found.',
    'store.csvSuiteAmbiguous': 'CSV line {0}: test suite "{1}" is ambiguous, so the import target cannot be determined.',
    'store.csvSuiteDuplicate': 'CSV line {0}: test suite "{1}" appears more than once.',
    'store.csvMissingSuiteBeforeCase': 'CSV line {0}: a test case appears before any test suite row.',
    'store.csvCaseNotFound': 'CSV line {0}: test case "{1}" was not found.',
    'store.csvCaseAmbiguous': 'CSV line {0}: test case "{1}" is ambiguous in the current test suite, so the import target cannot be determined.',
    'store.csvCaseDuplicate': 'CSV line {0}: test case "{1}" appears more than once.',
    'store.noAssociatedTp': 'No associated .tp file was found.',
    'store.fileNotFound': 'File not found: {0}',
    'store.invalidJson': '{0} is not valid JSON: {1}',
    'store.rootNotObject': 'The root of {0} must be a JSON object.',
    'store.refreshFailed': 'TreeATE refresh failed: {0}',

    'model.invalidParameterName': 'Invalid parameter name "{0}". Only letters, digits, and underscores are allowed.',

    'paramTable.deleteColumnConfirm': 'Delete parameter column "{0}"? This removes it from all nodes covered by the current parameter table, including inherited definitions.',
    'paramTable.deleteColumnFailed': 'Failed to delete parameter column: {0}',
    'paramTable.saveFailed': 'Failed to save parameter: {0}',

    'props.panelTitle': 'TreeATE Properties',
    'props.pageTitle': 'TreeATE Properties',
    'props.panelTitleWithName': 'TreeATE Properties · {0}',
    'props.dirtyJson': 'The JSON on the left has unsaved changes. Save the JSON before saving the properties.',
    'props.savedStatus': 'TreeATE configuration saved',
    'props.saveFailed': 'Failed to save TreeATE configuration: {0}',

    'tree.noDescription': 'No description',

    'dllEditor.binaryMessage': 'The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.',
    'dllEditor.loading': 'Reading Qt meta-object information from {0}…',
    'dllEditor.unnamed': '(unnamed)',
    'dllEditor.className': 'QObject class',
    'dllEditor.functionName': 'Function',
    'dllEditor.parameterName': 'Parameter',
    'dllEditor.methodSignature': 'Qt method signature',
    'dllEditor.noMethods': 'CreateDeviceInst returned a QObject*, but the object declares no callable Qt methods.',
    'dllEditor.pageTitle': 'TreeATE DLL Interface',

    'dllInspector.readFailed': 'Failed to read the DLL: {0}',
    'dllInspector.inspectorMissing': 'The Qt DLL inspector was not found. Build native/treeate-qt-inspector or configure treeate.qtInspectorPath.',
    'dllInspector.noResult': 'The Qt DLL inspector did not return a valid result.',
    'dllInspector.invalidJson': 'The Qt DLL inspector returned invalid JSON.',
    'dllInspector.invalidData': 'The Qt DLL inspector returned data in an unexpected format.',
    'dllInspector.failed': 'DLL inspection failed.',
    'dllInspector.runFailed': 'The Qt DLL inspector failed to run: {0}',

    'engine.openProjectFirst': 'Open a TreeATE project first.',
    'engine.alreadyRunning': 'TestEngine is already running.',
    'engine.startFailed': 'Failed to start: {0}',
    'engine.exited': 'TestEngine exited with code {0}.',

    'csv.empty': 'The CSV file is empty.',
    'csv.header': 'The first two CSV columns must be Name and Description.',
    'csv.invalidColumn': 'Invalid parameter column "{0}". Only letters, digits, and underscores are allowed.',
    'csv.duplicateColumn': 'Duplicate parameter column "{0}".',
    'csv.columnCount': 'CSV line {0}: {1} columns found, but {2} were expected.',
    'csv.emptyName': 'CSV line {0}: Name must not be empty.',
    'csv.invalidDepth': 'CSV line {0}: the Name must be preceded by exactly 1, 2, or 3 spaces.',
    'csv.firstMustBeProject': 'CSV line {0}: the first row must be a test project (one leading space).',
    'csv.depthJump': 'CSV line {0}: levels cannot be skipped. A test suite must follow a test project, and a test case must follow a test suite.',
    'csv.noRows': 'The CSV contains no data rows to import.',
    'csv.quoteStart': 'CSV line {0}: a quote may only appear at the start of a field.',
    'csv.unclosedQuote': 'CSV line {0}: an opening quote is not closed.',

    'script.generated': 'Generated in {0}: {1}',
    'script.listSeparator': ', ',

    'intellisense.showParameterHints': 'Show Parameter Hints',
    'intellisense.parameterDoc': '- `{0}`: {1}',
    'intellisense.OutputRst.desc': 'Outputs test results to the UI and stores them locally or on a remote server. Remote storage requires a custom extension.',
    'intellisense.OutputRst.strName': 'Test result name. A standardized defect code such as F01003 is recommended.',
    'intellisense.OutputRst.strValue': 'Test result value as a string.',
    'intellisense.OutputRst.strStand': 'Description of the test result standard, as a string.',
    'intellisense.OutputRstEx.desc': 'Supported in V1.1 and later. Same as OutputRst but lets you specify the result status explicitly.',
    'intellisense.OutputRstEx.strName': 'Test result name. A standardized defect code is recommended.',
    'intellisense.OutputRstEx.strValue': 'Test result value as a string.',
    'intellisense.OutputRstEx.strStand': 'Description of the test result standard, as a string.',
    'intellisense.OutputRstEx.rst': 'Result status: 0=Info, 1=Pass, 2=Fail, 3=Exce (exception).',
    'intellisense.OutputError.desc': 'Outputs an error message. This API is used by the TreeATE API documentation examples.',
    'intellisense.OutputError.message': 'Message to output.',
    'intellisense.GetUserName.desc': 'Returns the current user name. The API and return type come from the TreeATE API documentation examples.',
    'intellisense.GetProjectName.desc': 'Returns the test project name. The API and return type come from the TreeATE API documentation examples.',
    'intellisense.GetProjectVer.desc': 'Returns the test project version. The API and return type come from the TreeATE API documentation examples.',
    'intellisense.GetProjectDesc.desc': 'Returns the test project description. The API and return type come from the TreeATE API documentation examples.',
    'intellisense.GetWorkLine.desc': 'Returns the production line name. The API and return type come from the TreeATE API documentation examples.',
    'intellisense.GetWorkStation.desc': 'Returns the workstation name. The API and return type come from the TreeATE API documentation examples.',
    'intellisense.GetTotalRst.desc': 'Returns the current overall test result status (0: Info, 1: Pass, 2: Fail, 3: Exce). Supported in V1.1.3 and later.',
    'intellisense.IsStopped.desc': 'Checks whether the current test run has stopped. This API belongs to __aterun only.',

    'webview.parameterTable.empty': 'Select a node to show the parameter matrix',
    'webview.parameterTable.noParameters': 'No parameters to display for the current node.',
    'webview.parameterTable.newColumnPlaceholder': 'New parameter column (letters/digits/underscore)',
    'webview.parameterTable.addColumn': 'Add Column',
    'webview.parameterTable.nodeHeader': 'Node',
    'webview.parameterTable.deleteColumnTitle': 'Delete parameter column {0}',
    'webview.parameterTable.inheritedFromSuite': 'Inherited from the test suite; editing makes it a parameter of the current level',
    'webview.parameterTable.inheritedFromProject': 'Inherited from the test project; editing makes it a parameter of the current level',
    'webview.parameterTable.customParameter': 'Custom parameter of the current level',
    'webview.parameterTable.hint': 'Italic values are inherited; editing writes to the Parameter of the current row level (test project/test suite/test case). Priority: test case > test suite > project.',

    'webview.properties.heading': 'TreeATE Properties',
    'webview.properties.save': 'Save',
    'webview.properties.saved': 'Saved',
    'webview.properties.saving': 'Saving…',
    'webview.properties.invalid': 'Fix the highlighted parameter names or JSON.',
    'webview.properties.basicConfig': 'Basic Settings',
    'webview.properties.parameterName': 'Parameter name',
    'webview.properties.parameterValue': 'Parameter value',
    'webview.properties.description': 'Description',
    'webview.properties.deleteParameter': 'Delete parameter',
    'webview.properties.addParameter': 'Add Parameter',
    'webview.properties.addRow': 'Add Row',
    'webview.properties.guiPlugins': 'GUI Plugins',
    'webview.properties.parallelTasks': 'Parallel Task Configuration',
    'webview.properties.globalParameters': 'Project Global Parameters',
    'webview.properties.bindings': 'Component Bindings',
    'webview.properties.publicParameters': 'Public Parameters',
    'webview.properties.suiteParameters': 'Test Suite Parameters',
    'webview.properties.caseParameters': 'Test Case Parameters',
    'webview.properties.parameterHint': 'Name / value / description',
    'webview.properties.kind.tpx': 'Global Configuration',
    'webview.properties.kind.tp': 'TP Configuration',
    'webview.properties.kind.suite': 'Test Suite',
    'webview.properties.kind.case': 'Test Case'
};

const messages: Record<Language, Record<MessageKey, string>> = { 'zh-cn': zh, en };

let languageOverride: Language | undefined;

/** 测试专用：固定界面语言，避免测试结果受运行环境语言影响。 */
export function setLanguageOverrideForTests(language?: Language): void {
    languageOverride = language;
}

export function currentLanguage(): Language {
    if (languageOverride) { return languageOverride; }
    const value = vscode.workspace.getConfiguration('treeate').get<string>('language');
    if (value === 'en' || value === 'zh-cn') { return value; }
    return String(vscode.env?.language ?? 'zh-cn').toLowerCase().startsWith('zh') ? 'zh-cn' : 'en';
}

export function t(key: MessageKey, ...args: Array<string | number>): string {
    const table = messages[currentLanguage()] ?? zh;
    const template = table[key] ?? zh[key];
    return template.replace(/\{(\d+)\}/g, (match, index) => {
        const value = args[Number(index)];
        return value === undefined ? match : String(value);
    });
}

export interface ParameterTableStrings {
    empty: string;
    noParameters: string;
    newColumnPlaceholder: string;
    addColumn: string;
    nodeHeader: string;
    deleteColumnTitle: string;
    inheritedFromSuite: string;
    inheritedFromProject: string;
    customParameter: string;
    hint: string;
}

export interface PropertiesStrings {
    heading: string;
    save: string;
    saved: string;
    saving: string;
    invalid: string;
    basicConfig: string;
    parameterName: string;
    parameterValue: string;
    description: string;
    deleteParameter: string;
    addParameter: string;
    addRow: string;
    guiPlugins: string;
    parallelTasks: string;
    globalParameters: string;
    bindings: string;
    publicParameters: string;
    suiteParameters: string;
    caseParameters: string;
    parameterHint: string;
    kindTpx: string;
    kindTp: string;
    kindSuite: string;
    kindCase: string;
}

export interface WebviewStrings {
    language: Language;
    parameterTable: ParameterTableStrings;
    properties: PropertiesStrings;
}

/** 传给两个 webview 的全部文案；HTML 静态文案与脚本动态文案共用同一组 key。 */
export function webviewStrings(): WebviewStrings {
    return {
        language: currentLanguage(),
        parameterTable: {
            empty: t('webview.parameterTable.empty'),
            noParameters: t('webview.parameterTable.noParameters'),
            newColumnPlaceholder: t('webview.parameterTable.newColumnPlaceholder'),
            addColumn: t('webview.parameterTable.addColumn'),
            nodeHeader: t('webview.parameterTable.nodeHeader'),
            deleteColumnTitle: t('webview.parameterTable.deleteColumnTitle'),
            inheritedFromSuite: t('webview.parameterTable.inheritedFromSuite'),
            inheritedFromProject: t('webview.parameterTable.inheritedFromProject'),
            customParameter: t('webview.parameterTable.customParameter'),
            hint: t('webview.parameterTable.hint')
        },
        properties: {
            heading: t('webview.properties.heading'),
            save: t('webview.properties.save'),
            saved: t('webview.properties.saved'),
            saving: t('webview.properties.saving'),
            invalid: t('webview.properties.invalid'),
            basicConfig: t('webview.properties.basicConfig'),
            parameterName: t('webview.properties.parameterName'),
            parameterValue: t('webview.properties.parameterValue'),
            description: t('webview.properties.description'),
            deleteParameter: t('webview.properties.deleteParameter'),
            addParameter: t('webview.properties.addParameter'),
            addRow: t('webview.properties.addRow'),
            guiPlugins: t('webview.properties.guiPlugins'),
            parallelTasks: t('webview.properties.parallelTasks'),
            globalParameters: t('webview.properties.globalParameters'),
            bindings: t('webview.properties.bindings'),
            publicParameters: t('webview.properties.publicParameters'),
            suiteParameters: t('webview.properties.suiteParameters'),
            caseParameters: t('webview.properties.caseParameters'),
            parameterHint: t('webview.properties.parameterHint'),
            kindTpx: t('webview.properties.kind.tpx'),
            kindTp: t('webview.properties.kind.tp'),
            kindSuite: t('webview.properties.kind.suite'),
            kindCase: t('webview.properties.kind.case')
        }
    };
}
