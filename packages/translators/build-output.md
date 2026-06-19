# Build Output — @edge_translate/translators

## Build Commands

```bash
# translators package
cd packages/translators
vite build
tsc --emitDeclarationOnly
```

## Generated Files

| File | Size |
|------|------|
| `dist/translators.es.js` | 61.90 KiB (gzip: 21.13 KiB) |
| `dist/translators.umd.js` | 61.32 KiB (gzip: 20.70 KiB) |
| `dist/translators.iife.js` | 61.13 KiB (gzip: 20.64 KiB) |
| `dist/types/` | TypeScript declaration files |

## All Changes (3 files in EdgeTranslate + 2 files in translators)

### 1. `packages/EdgeTranslate/src/options/options.html` — main translator 不再覆盖读音

`data-affected` 从 `"originalText mainMeaning tPronunciation sPronunciation"` → `"originalText mainMeaning"`

**根因：** 用户下拉选择"主翻译源：百度翻译"时，options 页面把 `selections.tPronunciation` 和 `selections.sPronunciation` 也写成了 BaiduTranslate。之后无论"单词读音"怎么设，音标数据源始终是百度（无音标）。

### 2. `packages/EdgeTranslate/src/options/options.js` — 读音下拉联动 selections

改写 `onchange` 处理器：当 `configKey === "pronunciationSource"` 时，额外把 `selections.tPronunciation` 和 `selections.sPronunciation` 设为同一切换器。并且把**翻译器列表重构移出 if/else**，确保任何改动后 translators 数组永远与 selections 一致。

### 3. `packages/EdgeTranslate/src/common/scripts/settings.js` — 默认配置 + 深度合并

- 默认 `targetPronunciation` 从 `"YoudaoDict"` → `"BingTranslate"`（跟随主翻译源）
- `getOrSetDefaultSettings` 新增深度合并：已保存的嵌套对象缺失新键时自动补上

### 4. `packages/translators/src/translators/hybrid.ts` — `_mergeResults` 回退逻辑

- `targetPronunciation` 优先从 **mainMeaning 同源**获取
- `sPronunciation`/`tPronunciation` 扫描所有翻译器回退

### 5. `packages/translators/src/translators/youdao.ts` — `fetchPhonetics` 回退

## Build Status

- `vite build` — ✅ 72 modules transformed, 3 output bundles
- `tsc --emitDeclarationOnly` — ✅ No errors
