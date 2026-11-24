# 空气唢呐 Air Suona

用空中手势吹唢呐：智能戒指选音孔，智能手杖控气口。Capacitor 打包为手机 App，并适配手表小屏。

## 功能

- **调式**：喜庆 / 悲壮 / 民歌 / 戏曲（五声音阶）
- **Web Audio 合成**：双簧管式持续音色（鼻音共鸣 + 气噪 + 揉音）
- **可穿戴输入**
  - 戒指：左右切换音孔 · 上下切换调式 · 甩动静音
  - 手杖：挥动吹奏 · 敲击收气/吐音停
- **触控兜底**：点按音孔选音 · 按住吹奏按钮
- **手表适配**：`max-width: 280px` 或 `max-height: 300px` 紧凑布局

## 项目结构

```
air-suona/
├── protocol/air-suona.json   # 手势与调式协议
└── mobile/
    ├── index.html
    ├── capacitor.config.json
    ├── package.json
    ├── scripts/build-web.js
    ├── src/
    │   ├── app.js              # UI 与手势路由
    │   ├── audio-engine.js     # Web Audio 唢呐合成
    │   ├── scales.js           # 调式与音孔频率
    │   └── wearable-input.js   # 戒指 / 手杖
    └── test/
```

## 快速开始

```bash
cd mobile
npm install
npm run build          # → www/
npm test
```

浏览器预览：

```bash
npx serve www
```

## 打包 Android / iOS

```bash
cd mobile
npm install
npx cap add android    # 或 ios
npm run mobile:android
# 或 npm run mobile:ios
```

日常：改 `src/` 或 `index.html` → `npm run build` → `npx cap sync android` → 真机运行。

## 手势对照

| 设备 | 动作 | 效果 |
|------|------|------|
| 戒指 | 左右倾 > 5° | 上一/下一音孔 |
| 戒指 | 上下倾 > 5° | 上一/下一调式 |
| 戒指 | 甩动 > 20° | 切换静音 |
| 手杖 | 挥动 > 3 | 吹奏（气口强弱） |
| 手杖 | 加速度尖峰 > 8 | 收气停音 |

桌面调试：`←` `→` 切音，`↑` `↓` 切调式，空格/按住吹，`S` 停，`M` 静音。
