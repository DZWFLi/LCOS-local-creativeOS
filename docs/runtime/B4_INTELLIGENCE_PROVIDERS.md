# LCOS B4 Intelligence Providers

B4 的 Intent / Context 轻推理不绑定某一家模型。Local Core 负责 provider transport、密钥边界与 role routing，GUI/CLI/MCP 只读取脱敏状态与结构化结果。

## Roles

- `utility`: Intent Resolution、结构化轻判断、后续 Context rerank。B4 当前主要使用这个角色。
- `chat`: 为后续 Companion / Harness 留出的主对话角色。B4 不强制与 utility 使用同一模型。

选择：

```bash
LCOS_UTILITY_PROVIDER=deepseek
LCOS_CHAT_PROVIDER=anthropic
```

未指定时按已配置 provider 的 priority 选择。首选 provider 临时失败时，会继续尝试同 role 的下一家 provider；全部失败后 B4 回到 deterministic rule fallback。

## Built-in wire protocols

- `openai-responses`
- `openai-chat`
- `anthropic-messages`
- `google-generate-content`
- `azure-openai-chat`
- `ollama-chat`

绝大多数 OpenAI-compatible 厂商不需要新增 Core 代码，只配置 endpoint / model / key。

## Built-in presets

当前 preset 包括：OpenAI、DeepSeek、Anthropic、Gemini、OpenRouter、Groq、Mistral、xAI、Qwen/DashScope、Zhipu/GLM、Moonshot/Kimi、SiliconFlow、MiniMax、Tencent Hunyuan、Baidu Qianfan、Cohere、Together、Fireworks、Volcengine Ark、Perplexity Agent API、Amazon Bedrock Mantle、Azure OpenAI、Ollama、LM Studio，以及 generic OpenAI-compatible endpoint。

模型目录变化很快，因此除少数有稳定默认名的 provider 外，推荐显式设置 model 环境变量。

## DeepSeek quick start

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
LCOS_UTILITY_PROVIDER=deepseek
```

`DEEPSEEK_MODEL` 可覆盖默认值。

## OpenAI quick start

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=...
LCOS_UTILITY_PROVIDER=openai
```

OpenAI preset 使用 Responses-compatible structured output。

## Generic OpenAI-compatible endpoint

```bash
LCOS_COMPATIBLE_BASE_URL=https://example.com/v1
LCOS_COMPATIBLE_MODEL=your-model
LCOS_COMPATIBLE_API_KEY=...
LCOS_UTILITY_PROVIDER=openai-compatible
```

## Custom provider JSON

也可以通过 `LCOS_INTELLIGENCE_PROVIDERS` 提供 JSON 数组：

```json
[
  {
    "id": "company-ai",
    "label": "Company AI",
    "protocol": "openai-chat",
    "baseUrl": "https://ai.company.internal/v1",
    "model": "utility-model",
    "apiKeyEnv": "COMPANY_AI_KEY",
    "roles": ["utility", "chat"],
    "priority": 5,
    "structuredOutput": "json-object"
  }
]
```

配置对象只保存 `apiKeyEnv` 名称，不保存原始 secret。

## Security boundary

- API key 只从 Local Core 进程环境读取。
- Provider status 不返回 secret。
- Web GUI 不接触 API key。
- 当前源码包没有实现 OS keychain / secure credential vault。桌面 Runtime Host 的安全凭据 UI 应在后续阶段补，而不是把 key 明文写进 Project DB。

## B4 fallback order

```text
Explicit Intent / deterministic high-confidence rule
        ↓ ambiguous only
Preferred Utility Provider
        ↓ failure
Other configured Utility Providers by priority
        ↓ failure
Local Ollama / LM Studio if configured
        ↓ all unavailable
Deterministic B4 fallback
```

Provider 改变不能改变 Intent / Attention contracts，只改变模型推理来源与能力上限。
