# TreeATE Qt DLL Inspector

点击 TreeATE 工程 `libs` 目录中的 DLL 时，扩展通过这个独立进程加载 DLL。DLL 导出无参数的
`CreateDeviceInst` 且返回有效 `QObject*` 时，探测器使用 `QMetaObject` 返回函数名、参数名和方法签名。

探测器必须与目标 DLL 的位数、Qt 主版本及运行库兼容。安装对应的 Qt 与 CMake 后，在扩展根目录运行：

```powershell
npm run build:qt-inspector
```

可执行文件生成在 `native/bin/treeate-qt-inspector.exe`。也可以在 VS Code 设置中通过
`treeate.qtInspectorPath` 指定其他构建产物。扩展会把 DLL 目录、TreeATE 工程根目录和已配置的
TestEngine 目录加入探测进程的 DLL 搜索路径。
