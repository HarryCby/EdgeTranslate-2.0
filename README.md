# Edge Translate 2.0 (Personal Update)

> 🌐 [中文文档](#中文文档) | [English Documentation](#english-documentation)

---

<p align="center">
  <strong>⬇️ 直接下载使用（无需编译）</strong>
</p>

<p align="center">
  <a href="https://github.com/HarryCby/EdgeTranslate-2.0/raw/main/packages/EdgeTranslate/build/chrome.zip">
    <img src="https://img.shields.io/badge/下载-chrome.zip-blue?style=for-the-badge&logo=google-chrome" alt="Download chrome.zip" />
  </a>
</p>
---

## English Documentation

A versatile Chrome/Edge extension for fast and easy translation of selected text, powered by hybrid engines and free AI APIs.

**This is a personal update** of [Edge Translate](https://github.com/EdgeTranslate/EdgeTranslate). I'm not a software engineering professional — potential bugs are inevitable. Feedback and code contributions are welcome!

### Quick Install (Just Use It)

**No need to build from source!** Just download and load the extension:

1. Click the **⬇️ Download** button above to get `chrome.zip`
2. Unzip it to any folder (e.g., `EdgeTranslate-chrome/`)
3. Open Edge → Settings → Extensions → **Developer mode** (toggle on)
4. Click **Load unpacked** → select the unzipped folder
5. Done! Click the extension icon to start using it

### For Developers (Build from Source)

**Prerequisites:** Node.js 18+, npm or yarn（详见 `requirements.txt`）

```bash
git clone https://github.com/HarryCby/EdgeTranslate-2.0.git
cd EdgeTranslate-2.0
npm install -g gulp-cli   # 若未安装 gulp
npm install
npm run build --browser chrome
```

### Configuration

1. Click the extension icon → **Options**
2. Set **default target language** (what language to translate TO)
3. Set **UI language** (interface language): zh_CN / zh_TW / en / ja / ru / fr
4. Save and refresh

### Features

| Feature | Description |
|---------|-------------|
| **Hybrid Translator** | Combines Bing, Tencent, Baidu, Youdao for best accuracy |
| **AI Context Translation** | DeepSeek / Groq / OpenAI — free API, smarter results |
| **Dictionary** | Detailed meanings, pronunciation, examples |
| **Page Translation** | Use browser's built-in translation (Edge/Chrome) |
| **i18n** | 6 UI languages: 简体中文 / 繁體中文 / English / 日本語 / Русский / Français |

### API Keys (Optional)

| API | Status | Note |
|-----|--------|------|
| Tencent Cloud | Optional | SecretId + SecretKey |
| Baidu Translate | Optional | AppID + AppKey |
| Youdao Dictionary | **Removed** | Uses free dict API, no key needed |
| Google Translate | Optional | Proxy URL only (needed behind GFW) |
| AI Models | Optional | DeepSeek, Groq, OpenAI etc. — free tier available |

> 💡 **Tip:** DeepL and Google Translate **don't work without a proxy** in China. Use Tencent/Baidu/AI instead.

### AI Context Translation Setup

1. Options → **AI Configuration** → Click **"+ Add Model"**
2. Fill in:
   - **Name**: e.g. `DeepSeek`
   - **API URL**: e.g. `https://api.deepseek.com`
   - **API Key**: your key
   - **Model**: e.g. `deepseek-chat`
3. Save — AI translation will appear in results automatically

### Translation Button Position

Default: **BottomRight** (bottom-right corner). Change in Options → Layout Settings.

### Changes from Original

- ✅ Full i18n — 6 languages, dynamic UI switching
- ✅ AI context translation — free DeepSeek/Groq/OpenAI
- ✅ Fixed button position bug (was jumping to top-right)
- ✅ Removed install/update pop-ups and auto-open pages
- ✅ Removed Youdao page translation (use browser's built-in instead)
- ✅ Simplified API config — auto-save, export/import all settings

---

## 中文文档

一个多功能的 Chrome/Edge 翻译扩展，支持混合翻译引擎和免费 AI API，快速翻译选中文字。

**本项目基于** [Edge Translate](https://github.com/EdgeTranslate/EdgeTranslate) 源代码进行个人更新。本人非软件专业，bug 在所难免，欢迎大家使用和反馈，最好能贡献代码一起分享！

### 直接安装使用（无需编译）

**不需要从源码构建！** 直接下载加载即可：

1. 点击上方 **⬇️ 下载** 按钮，获取 `chrome.zip`
2. 解压到任意文件夹（如 `EdgeTranslate-chrome/`）
3. 打开 Edge → 设置 → 扩展 → **开发人员模式**（打开开关）
4. 点击 **加载解压缩的扩展** → 选择解压后的文件夹
5. 完成！点击扩展图标即可使用

### 开发者（从源码构建）

**环境要求：** Node.js 18+, npm 或 yarn（详见 `requirements.txt`）

```bash
git clone https://github.com/HarryCby/EdgeTranslate-2.0.git
cd EdgeTranslate-2.0
npm install -g gulp-cli   # 若未安装 gulp
npm install
npm run build --browser chrome
```

### 配置说明

1. 点击扩展图标 → **设置**
2. 设置 **默认翻译语言**（翻译到什么语言）
3. 设置 **界面语言**：简体中文 / 繁體中文 / English / 日本語 / Русский / Français
4. 保存并刷新

### 功能一览

| 功能 | 说明 |
|------|------|
| **混合翻译** | Bing + 腾讯 + 百度 + 有道词典，组合取最优结果 |
| **AI 上下文翻译** | DeepSeek / Groq / OpenAI 等免费 API，翻译更智能 |
| **词典功能** | 单词详解、音标、例句、发音 |
| **网页翻译** | 使用浏览器自带翻译（更稳定） |
| **国际化** | 6 种界面语言：简体中文 / 繁體中文 / English / 日本語 / Русsky / Français |

### API 密钥（可选）

| API | 状态 | 说明 |
|-----|------|------|
| 腾讯云翻译 | 可选 | SecretId + SecretKey |
| 百度翻译 | 可选 | APP ID + 密钥 |
| 有道词典 | **已移除** | 使用免费词典 API，无需密钥 |
| Google 翻译 | 可选 | 仅需代理地址（无梯子时使用） |
| AI 模型 | 可选 | DeepSeek、Groq、OpenAI 等——有免费额度 |

> 💡 **提示：** DeepL 和 Google 翻译 **在没有代理（梯子）的情况下无法使用**，建议用腾讯/百度/AI 翻译。

### AI 上下文翻译配置

1. 设置 → **AI 模型配置** → 点击 **"+ 添加模型"**
2. 填写：
   - **名称**：如 `DeepSeek`
   - **API 地址**：如 `https://api.deepseek.com`
   - **API Key**：你的密钥
   - **模型**：如 `deepseek-chat`
3. 保存 — 翻译结果中会自动出现 AI 上下文翻译

### 翻译按钮位置

默认：**右下角**。可在设置 → 布局设置中更改。

### 与原版的主要改动

- ✅ 完整国际化 — 6 种语言，动态切换界面
- ✅ AI 上下文翻译 — 免费 DeepSeek/Groq/OpenAI
- ✅ 修复按钮位置 bug（之前会跳到右上角）
- ✅ 移除安装/更新弹窗和自动打开网页
- ✅ 移除有道网页翻译（改用浏览器自带翻译）
- ✅ 简化 API 配置 — 自动保存、导出/导入全部设置

---

<p align="center">
  <strong>⬇️ 直接下载使用</strong>
</p>

<p align="center">
  <a href="https://github.com/HarryCby/EdgeTranslate-2.0/raw/main/packages/EdgeTranslate/build/chrome.zip">
    <img src="https://img.shields.io/badge/下载-chrome.zip-blue?style=for-the-badge&logo=google-chrome" alt="Download chrome.zip" />
  </a>
</p>

<p align="center">
  <em>本人非软件专业，潜在bug在所难免。欢迎大家使用和反馈，最好能贡献代码一起分享！</em>
</p>

<p align="center">
  <em>I'm not a professional software engineer. potential bugs are inevitable. Feedback and code contributions are welcome!</em>
</p>
