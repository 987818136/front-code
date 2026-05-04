## 项目特点
- **项目定位**: AI终端辅助开发应用（类Claude Code）
- **技术栈**: Node.js, ESM规范, 纯JavaScript, OpenAI API
- **核心目录**: `src/app.js`(入口), `src/docs`(提示词模板), `src/tool`(本地Function Tool), `src/utils`(工具函数)
- **开发分支**: 默认开发分支为 `ssdev2`

## 项目功能开发记录
- **数组工具函数开发**:
  - `src/utils/array.js`: 基础累加方法 `sumArray` (含类型校验)
  - `src/utils/arrayUtils.js`: 进阶累加方法 `sumArray(arr, initialValue = 0)` (支持初始值参数)

## 项目常见错误/注意事项
- 网络请求调试时，部分外部API（如ipify）可能因网络限制连接失败，已验证 `httpbin.org` 可作为稳定备用接口
- 加载自定义Skill时偶发 `Cannot read properties of undefined (reading 'handle')` 错误，需检查Skill文件路径与格式