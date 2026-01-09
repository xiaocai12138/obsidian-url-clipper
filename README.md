# Obsidian URL Clipper

**一个支持可视化正文选择的网页剪藏插件**

## 一、插件简介

**Obsidian URL Clipper** 是一款为 **Obsidian** 设计的网页剪藏插件，专注于解决传统网页剪藏中最棘手的问题之一：

> **如何稳定、准确地剪藏网页"正文内容"，而不是整页噪音。**

与普通"复制网页 → 粘贴 Markdown"的方式不同，本插件提供了一个 **可视化正文选择器（Web Picker）**，允许用户直接在网页中用鼠标选中真正的正文区域，并自动生成 **CSS 路径 / XPath 路径**，再将该区域内容转换为 Markdown 插入到当前笔记中。

## 二、核心功能概览

### 🔗 1. 网页剪藏（URL → Markdown）

* 支持输入任意网页 URL
* 通过内置 WebView 加载真实网页
* 保留网页原始结构与渲染效果
* 自动插入到当前 Obsidian 笔记光标位置

### 🖱 2. 可视化正文区域选择（核心能力）

* 鼠标移动实时高亮页面元素（红框预览）
* 单击预览当前节点路径
* **双击页面元素即可确认选择**
* 自动停止选择模式，避免误触
* 支持复杂页面结构（多层 div、动态内容）

### 🧭 3. 自动生成路径（CSS + XPath）

在选择正文区域后，插件会自动生成：

* **CSS Selector 路径**
* **XPath 路径**

并实时展示在弹窗底部，供你：

* 直接用于剪藏
* 复制到爬虫 / 自动化脚本
* 作为规则长期复用

### 🖼 4. 图片本地化（可选）

* 自动下载正文中的图片
* 按 Obsidian「附件存放规则」保存
* 自动替换为本地图片路径
* 支持图片名前缀 + 时间戳，避免冲突

### 🧱 5. 模块化架构（为扩展而设计）

当前插件代码已进行完整拆分：

* `main.ts`：插件入口与核心流程
* `core/clipper.ts`：剪藏核心逻辑
* `ui/ClipModal.ts`：剪藏主界面
* `ui/PickerModal.ts`：网页正文选择器
* `picker/injectedPicker.ts`：注入到 WebView 的选择脚本
* `settings/UrlClipperSettingTab.ts`：插件设置页
* `types.ts`：类型定义与默认设置

这种结构使插件非常适合：

* 二次开发
* 功能扩展
* 维护与调试

## 三、典型使用场景

### 📚 技术博客 / 文档剪藏

适用于：

* CSDN / 博客园 / 掘金
* GitHub Pages / Docs / Wiki
* 各类技术教程、规范文档

精准剪藏正文，避免：

* 侧边栏
* 推荐列表
* 评论区
* 广告与登录弹窗

### 🧪 爬虫 / 自动化规则配置

插件不仅是"剪藏工具"，也是一个 **可视化规则生成器**：

* 用鼠标点选即可生成选择器
* 避免手写 XPath / CSS 的痛苦
* 路径可直接复用于：
  * Puppeteer / Playwright
  * Python（lxml / BeautifulSoup）
  * Node / Java 抓取程序

### 🧠 知识管理与长期引用

对于 Obsidian 用户：

* 为网页内容建立**稳定结构锚点**
* 即使网页更新，也可快速重新定位正文
* 非一次性复制，而是"可维护引用"

## 四、安装指南

### 方法一：通过 Obsidian 社区插件安装（推荐）

1. 打开 Obsidian 设置
2. 进入 "Community plugins" 选项
3. 关闭 "Restricted mode"
4. 点击 "Browse" 按钮
5. 搜索 "URL Clipper"
6. 点击 "Install" 安装
7. 安装完成后点击 "Enable" 启用插件

### 方法二：手动安装

1. 从 [GitHub Releases](https://github.com/yourusername/obsidian-url-clipper/releases) 下载最新版本的插件
2. 解压缩文件
3. 将解压后的文件夹复制到你的 Obsidian  vault 的 `.obsidian/plugins/` 目录下
4. 重启 Obsidian
5. 在设置中启用插件

## 五、使用教程

### 1. 基本剪藏流程

1. 在 Obsidian 中打开一个 Markdown 笔记
2. 将光标放在你想要插入剪藏内容的位置
3. 打开命令面板（默认快捷键：`Ctrl+P` / `Cmd+P`）
4. 输入并选择 "剪藏链接到当前笔记（插入到光标处）" 命令
5. 在弹出的对话框中：
   * 输入要剪藏的网页 URL
   * 选择提取模式（自动 / CSS / XPath）
   * （如果选择 CSS 或 XPath 模式）点击 "选择正文区域" 按钮
   * 在网页预览中双击选择正文区域
   * 点击 "插入" 按钮

### 2. 可视化选择正文区域

1. 在剪藏对话框中输入 URL 并选择 "CSS 选择器" 或 "XPath" 模式
2. 点击 "选择正文区域" 按钮
3. 在打开的网页预览中：
   * 移动鼠标，观察红色高亮框（显示当前选中的元素）
   * 单击元素可预览生成的路径
   * 双击元素确认选择并返回剪藏对话框
4. 确认路径已自动填入输入框
5. 点击 "插入" 完成剪藏

### 3. 图片本地化设置

1. 打开 Obsidian 设置
2. 进入 "URL Clipper" 设置页面
3. 在 "图片处理" 部分：
   * 启用 "图片本地化" 选项
   * 选择图片保存位置（遵循 Obsidian 附件设置）
   * 设置图片名前缀（可选）

## 六、设置选项

插件提供了以下设置选项：

| 设置项 | 描述 | 默认值 |
|-------|------|-------|
| 默认提取模式 | 自动 / CSS / XPath | 自动 |
| 图片本地化 | 是否下载并保存图片到本地 | 关闭 |
| 图片前缀 | 本地图片文件名前缀 | 空 |
| 调试模式 | 是否输出调试日志 | 关闭 |

## 七、常见问题与解决方案

### Q: 为什么有些网页无法剪藏？

A: 可能的原因包括：
* 网页需要登录才能访问
* 网页使用了复杂的 JavaScript 渲染
* 网页有反爬机制

解决方案：尝试使用不同的提取模式，或手动调整生成的 CSS/XPath 路径。

### Q: 图片本地化失败怎么办？

A: 检查以下几点：
* 网络连接是否正常
* Obsidian 附件文件夹权限是否正确
* 图片 URL 是否可访问

### Q: 生成的 Markdown 格式不正确？

A: 这可能是由于网页结构复杂导致的。解决方案：
* 尝试选择更精确的正文区域
* 手动编辑生成的 Markdown
* 反馈问题到 GitHub Issues

## 八、技术原理

### 1. 可视化选择器实现

* 使用 Obsidian 内置的 WebView 组件加载目标网页
* 注入自定义 JavaScript 脚本（`injectedPicker.ts`）到网页中
* 监听鼠标移动事件，实时计算并高亮当前元素
* 双击事件触发路径生成并返回结果

### 2. 路径生成算法

* **CSS 选择器**：从目标元素向上遍历 DOM 树，生成包含标签名、类名、ID 的选择器
* **XPath**：同样向上遍历 DOM 树，生成基于层级和属性的 XPath 表达式
* 优化路径唯一性，确保生成的选择器能够准确定位目标元素

### 3. 内容提取与转换

* 使用 `@mozilla/readability` 库进行智能内容提取
* 使用 `turndown` 库将 HTML 转换为 Markdown
* 处理图片、链接等特殊元素的转换逻辑

## 九、开发与扩展

### 环境搭建

1. 克隆本仓库
2. 确保 Node.js 版本 >= 16
3. 运行 `npm install` 安装依赖
4. 运行 `npm run dev` 启动开发模式（自动编译）
5. 将插件目录复制到 Obsidian 插件文件夹中
6. 重启 Obsidian 并启用插件

### 构建发布

1. 运行 `npm run build` 构建生产版本
2. 更新 `manifest.json` 中的版本号
3. 更新 `versions.json` 文件
4. 创建 GitHub Release 并上传构建产物

## 十、贡献指南

欢迎通过以下方式贡献本项目：

* 提交 Bug 报告和功能请求
* 提交代码 Pull Request
* 改进文档和翻译
* 分享使用技巧和案例

## 十一、许可证

本插件采用 [0-BSD 许可证](LICENSE)，允许自由使用、修改和分发。

## 十二、联系方式

* GitHub: [yourusername/obsidian-url-clipper](https://github.com/xiaocai12138/obsidian-url-clipper)
* Issues: [Bug 报告与功能请求](https://github.com/xiaocai12138/obsidian-url-clipper/issues)

---

> **Obsidian URL Clipper 不只是"把网页剪进笔记"，而是让你第一次真正"控制网页结构"。**