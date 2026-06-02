# Claude Code + 国产模型使用教程 🚀

由于 Claude 官方 API 对中国大陆网络限制且需要翻墙，我们可以通过 **cc-switch** 配合国内的大模型（如 **DeepSeek**、**智谱 GLM-4**、**通义千问**）来驱动 Claude Code，全程免翻墙且费用低廉。

下面是详细的配置和使用指南。

---

##  第一步：获取国产模型的 API Key

在使用之前，你需要到对应的国内大模型平台申请一个 API Key：

| 推荐模型 | 价格优势 | API Key 申请地址 |
| :--- | :--- | :--- |
| **DeepSeek-Coder** 🌟 (推荐) | 约 ¥0.001 / 千 token（极便宜，编程首选） | [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) |
| **智谱 GLM-4-Plus** | 约 ¥0.05 / 千 token（中文理解能力极佳） | [智谱 AI 开放平台](https://open.bigmodel.cn/usercenter/apikeys) |
| **通义千问 Qwen-Max** | 约 ¥0.02 / 千 token（阿里云旗舰模型） | [阿里云百炼平台](https://dashscope.console.aliyun.com/apiKey) |

---

## 第二步：使用 cc-switch 切换与配置模型

**cc-switch** 是一个运行在系统托盘的轻量管理工具，它可以动态修改 Claude Code 的网络代理和模型接口。

1. **启动软件**：
   * 在可视化安装器点击 **「打开 cc-switch」**，或者在应用程序中手动启动。
2. **定位托盘图标**：
   * **macOS**：屏幕顶部最右侧的菜单栏上会出现 cc-switch 图标。
   * **Windows**：右下角系统托盘（可能折叠在 `^` 箭头的任务栏里）会出现 cc-switch 图标。
3. **填写 API Key**：
   * 点击托盘上的 cc-switch 图标，在菜单中选择你刚才挑选的模型（如 **DeepSeek**）。
   * 点击配置（Settings），在对应的模型输入框中粘贴你的 **API Key**，然后点击 **保存 (Save)**。
4. **一键切换**：
   * 再次点击托盘图标，勾选你配置好的模型（例如勾选 `DeepSeek`）。

---

## 第三步：在终端启动 Claude Code

1. **打开新终端**：
   * **Windows 用户**：推荐使用安装好的 **Git Bash** 或者 **PowerShell** 窗口。
   * **macOS 用户**：直接使用 **终端 (Terminal)** 窗口。
   * *⚠️ 注意：必须使用一个**新打开**的终端窗口，否则新配置的系统环境变量不会生效。*
2. **运行启动命令**：
   ```bash
   claude
   ```
3. **首次运行授权**：
   * 第一次使用时，Claude Code 会在终端里输出一段欢迎说明，并询问你是否同意相关条款（按回车选择同意即可）。
   * 随后便会成功进入交互式对话界面。

---

## 第四步：常见日常使用

成功进入 `claude>` 命令行后，你就可以像往常一样向它提问了：

```bash
# 常见中文对话
claude> 帮我写一个 Python 的快速排序
claude> 分析一下当前目录下的 package.json
claude> 运行测试并修复报错
```

* **安全退出**：输入 `exit` 或 `ctrl + d` 即可退出 Claude Code 对话界面。
* **无缝切换模型**：如果你想把模型从 DeepSeek 换成通义千问，**不需要关闭终端**。只需在系统托盘点击 cc-switch 切换为 Qwen，并在终端里重新运行 `claude` 即可，一切无缝切换！

---

## 常见问题与排查 (FAQ)

### 1. 提示 "Authentication Error" 或 "403/401" 错误？
* 检查你的 API Key 是否输入正确。
* 检查你的国内大模型账户是否有余额（部分平台新注册会赠送免费额度，若额度过期或用完需要充值几块钱才能使用）。

### 2. 输入 `claude` 提示“找不到命令”？
* 请确保你已经**关闭并重新打开了终端**。
* 如果依然找不到，说明 Node.js 的全局 Bin 路径未被自动加入系统环境变量。
  * **macOS 用户**：在终端运行 `npm config get prefix`，查看输出的路径。如果是 `/usr/local`，将 `/usr/local/bin` 添加到你的 `~/.zshrc` 或 `~/.bash_profile` 里。
  * **Windows 用户**：在系统搜索栏输入“环境变量”，打开「编辑系统环境变量」，在 `Path` 变量中加入 `C:\Users\你的用户名\AppData\Roaming\npm`。

### 3. 一直卡在 “Connecting to server...” 阶段？
* 打开 cc-switch 确认代理状态正常，一般选择 `cc-switch` 推荐的国内中转模型接口即可免翻墙访问。
