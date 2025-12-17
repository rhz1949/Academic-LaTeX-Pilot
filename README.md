# Overleaf Intelligent Translator

Overleaf Intelligent Translator 是一款基于 Manifest V3 的 Chrome 插件，帮助在 Overleaf 中编辑 LaTeX 时对中文注释或草稿进行润色并翻译成英文。

## 功能亮点
- 在 Overleaf 顶部工具栏插入 `Trans` 按钮，点击后自动读取当前选中的文本以及前文上下文。
- 侧边栏显示 AI 润色后的中文与英文 LaTeX 翻译，支持复制与错误提示。
- 支持 Gemini 与 OpenAI，API Key 可通过插件弹窗或侧边栏设置保存到本地。

## 安装步骤
1. 在浏览器地址栏输入 `chrome://extensions/` 打开扩展管理页面并开启右上角的 **开发者模式**。
2. 点击 **加载已解压的扩展程序**，选择本项目所在文件夹（包含 `manifest.json` 的目录）。
3. 加载完成后，工具栏会出现插件图标；如需固定，请在扩展管理中点击固定图钉。

## API Key 配置
- 方式一：点击浏览器工具栏中的插件图标，弹出窗口内输入 OpenAI 或 Gemini 的 API Key，并选择 Provider 后保存。
- 方式二：在 Overleaf 页面打开侧边栏后，点击齿轮图标填写 API Key；保存后会同步写入 `chrome.storage.local`。

## 使用指南
1. 打开 Overleaf 项目页面，等待顶部工具栏出现 **Trans** 按钮。
2. 选中需要润色或翻译的中文注释/草稿文本。
3. 点击 **Trans** 按钮，右侧会滑出侧边栏并自动携带前文上下文提交给后台。
4. 稍候即可在侧边栏查看「润色后的中文」与「英文 LaTeX」，可点击「Copy」按钮复制内容。
5. 如遇请求失败，侧边栏会以红色文字显示错误信息；请检查 API Key、网络或稍后重试。

## 常见问题排查
- **Gemini 404 模型错误**：请确认已在设置中选择 Gemini，并填入有效的 Gemini API Key。插件已改用官方 v1 版本的 `gemini-1.5-flash-latest` 端点，如仍报错可在 Google AI Studio 确认该 Key 拥有对应模型的访问权限或尝试重新生成 Key。
- **点击按钮后提示未选择文本**：在 CodeMirror 编辑器中点击按钮会取消当前高亮，插件会自动缓存最近一次有效的选区。确保先用鼠标拖拽或键盘选中中文文本，再点击 **Trans**，即可使用缓存的选区发起翻译。

## 开发/调试提示
- 侧边栏与按钮的样式定义在 `styles.css`，可根据需要调整配色或布局。
- `content.js` 负责 DOM 注入、上下文提取与与后台通信，`background.js` 处理与 LLM 的交互。
- 需要重新加载代码时，可在 `chrome://extensions/` 页面点击插件卡片上的刷新按钮。
