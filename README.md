# sy-ship（3D 太阳系 · 星舰交互版）

> 基于 React + Three.js 的 3D 太阳系模拟，支持虚拟摇杆触屏操控与飞船音效。

## 项目简介

sy-ship 是一个使用 React + Three.js 构建的 3D 太阳系模拟网页项目。在完整太阳系漫游的基础上，额外提供 **虚拟摇杆（Joystick）** 触屏操控与 **飞船音效（ShipSound）**，并带有错误边界等健壮性设计，兼顾桌面与移动端体验。与 solor-zipu（可实际驾驶的程序化星舰）不同，本项目聚焦于太阳系本身的沉浸式浏览与交互。

## 功能特性

- **完整行星系统**：太阳、八大行星及主要卫星（基于 `src/data/planetData.js`、`orbitalData.js` 的真实参数）
- **轨道运动**：行星公转与自转，支持时间流速调节与暂停
- **视角控制**：鼠标拖拽旋转、滚轮缩放（OrbitControls）；支持点击星球查看信息并聚焦
- **控制面板（ControlPanel）**：暂停 / 时间流速 / 轨道线 / 星空 / 名称 / 全局缩放 / Bloom 辉光 等开关
- **导航面板（PlanetNav）**：从列表直接跳转聚焦任意天体
- **行星信息（PlanetInfo）**：点击星球弹出信息卡片
- **行星标签（PlanetLabels）**：场景中实时显示天体名称
- **虚拟摇杆（Joystick）**：屏幕摇杆控制视角 / 位移，方便触屏设备操作
- **飞船音效（ShipSound）**：背景/交互音效，可开关
- **加载界面（LoadingScreen）**：带加载进度提示
- **健壮性**：React 错误边界（ErrorBoundary）捕获渲染异常，避免整页白屏且无提示

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.2 | UI 组件与状态管理 |
| react-dom | 18.2 | 渲染 |
| Three.js | 0.160 | 3D 渲染引擎 |
| Vite | 5.0 | 构建工具（`@vitejs/plugin-react`） |

- `vite.config.js` 中配置了 `manualChunks`，将 `three` 与 `react-vendor` 单独分包，提升缓存命中率
- 行星贴图位于 `public/textures/`，全部本地资源，无外部 API 依赖

## 目录结构

```
src/
├── App.jsx                # 主应用组件（含错误边界）
├── main.jsx               # 入口文件
├── data/
│   ├── planetData.js       # 行星数据（半径/距离/纹理等）
│   └── orbitalData.js      # 轨道参数
├── components/
│   ├── ControlPanel.jsx    # 控制面板
│   ├── PlanetNav.jsx       # 天体导航面板
│   ├── PlanetInfo.jsx      # 行星信息卡片
│   ├── PlanetLabels.jsx    # 行星标签
│   ├── StatusDisplay.jsx   # 状态信息
│   ├── Header.jsx          # 顶部标题
│   ├── LoadingScreen.jsx   # 加载画面
│   └── Joystick.jsx        # 虚拟摇杆（触屏控制）
├── audio/
│   └── shipSound.js        # 飞船音效
├── styles/
│   └── index.css           # 全局样式
└── three/                  # Three.js 3D 场景
    ├── SolarSystemScene.js  # 主场景管理器
    ├── sun/                 # 太阳特效
    ├── planets/             # 行星与卫星
    ├── objects/             # 小行星带等
    ├── utils/               # 星场等工具
    └── postprocessing/      # 后期处理（Bloom 等）
```

## 本地运行

```bash
npm install     # 安装依赖（React 18 + Three.js + Vite 5）
npm run dev     # 启动开发服务器，自动打开 http://localhost:3000
npm run build   # 生产构建，输出到 dist/
npm run preview # 本地预览生产构建
```

## 在线演示

<https://chenbenkong.github.io/sy-ship/>

## 说明 / 备注

- 分支 `main` 为源码，GitHub Pages 从 `main` 根目录部署；`vite.config.js` 中 `base: './'`（相对路径），同时兼容 Pages 子路径与本地预览。
- 桌面端用鼠标 / 键盘操作，移动端可直接使用屏幕虚拟摇杆。
- 与同系列仓库的关系：sy-826（含 GARGANTUA 黑洞）、solor-zipu（可驾驶星舰「星隼号」）均为本项目的同族衍生版本。
