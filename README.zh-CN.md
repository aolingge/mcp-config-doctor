<p align="center">
  <img src="assets/readme-banner.svg" alt="MCP Config Doctor banner" width="100%">
</p>

<h1 align="center">MCP Config Doctor</h1>

<p align="center">
  一个本地优先的 MCP 配置体检 CLI，在 Claude Desktop、Cursor、Codex 等 AI 客户端连接失败前先帮你查问题。
</p>

<p align="center">
  <a href="README.md">English</a>
  ·
  <a href="#快速开始">快速开始</a>
  ·
  <a href="#检查项">检查项</a>
  ·
  <a href="#参与贡献">参与贡献</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/node-%3E%3D18-36C2A7">
  <img alt="zero dependency" src="https://img.shields.io/badge/dependencies-0-FFCF5C">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-6AA6FF">
</p>

## 为什么做这个

MCP 正在变成 AI 客户端连接工具、文件、API 和本地服务的标准方式。真正卡人的地方通常不是协议本身，而是配置：JSON 写错、命令不在 PATH、`args` 写成字符串、token 直接粘进配置，客户端最后只给一个很模糊的失败提示。

`mcp-config-doctor` 做的是启动前体检：

- 检查 MCP 配置里的 JSON、server 结构、命令、参数、环境变量和 URL。
- 发现常见的 token 泄露风险，方便你分享报告前先处理。
- 输出终端文本、JSON 或 Markdown，适合本地排查和 GitHub Issue。
- 全程本地运行，不上传你的配置。

<p align="center">
  <img src="assets/diagnosis-preview.svg" alt="MCP Config Doctor output preview" width="88%">
</p>

## 快速开始

```bash
npx github:aolingge/mcp-config-doctor --config claude_desktop_config.json
```

生成 Markdown 报告：

```bash
npx github:aolingge/mcp-config-doctor --config mcp.json --markdown > mcp-report.md
```

在 CI 里使用，低于指定分数就失败：

```bash
npx github:aolingge/mcp-config-doctor --config fixtures/valid.mcp.json --min-score 80
```

对本地 stdio server 做短启动探测：

```bash
npx github:aolingge/mcp-config-doctor --config mcp.json --start
```

## 检查项

| 检查 | 能发现什么 | 为什么重要 |
| --- | --- | --- |
| JSON parse | 配置语法错误 | 很多客户端不会清楚显示解析错误 |
| `mcpServers` / `servers` | 缺少 server 配置块 | 常见客户端通常需要这种结构 |
| `command` / `url` | 没有启动目标 | 本地 server 和远程 server 配法不同 |
| PATH lookup | 命令没安装或客户端找不到 | 终端能跑，不代表客户端能跑 |
| `args` type | 把数组写成字符串 | 复制示例时最常见 |
| `env` type | 环境变量格式错误 | 会导致 server 启动失败 |
| Secret-like values | token 被直接写进配置 | 分享报告前需要先脱敏 |
| Startup probe | 进程一启动就退出 | 提前发现本地 stdio server 问题 |

## 示例配置

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "ROOT": "."
      }
    },
    "remote-api": {
      "url": "https://example.com/mcp"
    }
  }
}
```

## 安全边界

这是配置体检工具，不是完整安全扫描器。它能发现常见配置错误和明显的 secret-like 字符串，但不能证明某个 MCP server 一定安全。安装任何能读文件、执行命令或访问私有 API 的 server 前，都应该先看源码和权限范围。

## Roadmap

- 补充 Claude Desktop、Cursor、Codex、Cline、Windsurf 的默认配置路径。
- 增加 MCP `initialize` 握手探测。
- 增加 SARIF 和 GitHub Actions 注释输出。
- 增加报告脱敏助手，方便公开发 Issue。
- 收集更多真实配置样例作为 fixtures。

## 参与贡献

欢迎从小 PR 开始：新增客户端配置路径、新增 fixture、优化检查提示、补充某个客户端的配置坑。

流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

MIT


## Quality Gate

Use this project as a repeatable gate before an AI agent marks work as done:

- [Quality gate guide](docs/quality-gates.md)
- [Copy-ready GitHub Actions example](examples/github-action.yml)

