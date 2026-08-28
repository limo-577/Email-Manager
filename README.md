# 邮箱账号管理 — Windows 桌面版

这是把原来的 `email-manager.jsx` 封装成 Windows 桌面程序的完整项目。

## 功能

- 批量粘贴导入：邮箱链接、浏览器类型、编号
- 自动跳过重复邮箱
- 搜索邮箱 / 浏览器 / 编号
- 使用后 24 小时自动恢复可用
- 显示使用时间和已用时长
- 撤销使用状态
- 删除账号
- 一键复制邮箱链接
- 点击邮箱链接使用系统默认浏览器打开
- 数据保存在电脑本地，关闭软件不会丢失

## Windows 打包

需要安装 Node.js 20+。

在本文件夹打开 PowerShell：

```powershell
npm install
npm run dist
```

打包完成后，安装包在：

```text
release\\邮箱账号管理-1.0.0-Setup.exe
```

双击安装后，桌面会自动创建「邮箱账号管理」快捷方式。

## 开发测试

```powershell
npm install
npm run dev
```

## 直接运行已构建版本

```powershell
npm run build
npm start
```

## 数据位置

数据使用浏览器的 `localStorage` 保存在 Electron 应用的本地用户数据目录中，不依赖网络。


## Chrome Profile 自动打开

批量导入支持 4 列：

`邮箱链接    浏览器    Chrome Profile    编号`

例如：

`mail.example.com/user1    Chrome    Profile 43    001`

点击“使用”时，Windows EXE 会调用内置的 `OpenBrowser.ps1`，通过 `browserprofile://open?...` 参数启动对应 Chrome Profile，并在该 Profile 中打开邮箱链接。

如果没有填写 Profile，程序会退回使用系统默认浏览器打开链接。
