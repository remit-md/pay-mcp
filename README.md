# @pay-skill/mcp

MCP server for [Pay](https://pay-skill.com) — USDC payments for AI agents on Base.

Gives any MCP-compatible client (Claude Desktop, Cursor, VS Code, custom frameworks) the full power of Pay: direct payments, tabs, x402 paywalls, service discovery, and wallet management. No CLI binary needed.

## Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pay": {
      "command": "npx",
      "args": ["-y", "@pay-skill/mcp"],
      "env": {
        "PAYSKILL_SIGNER_KEY": "your-private-key-hex",
        "PAY_NETWORK": "mainnet"
      }
    }
  }
}
```

### VS Code / Cursor

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "pay": {
      "command": "npx",
      "args": ["-y", "@pay-skill/mcp"],
      "env": {
        "PAYSKILL_SIGNER_KEY": "your-private-key-hex"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add pay -- npx -y @pay-skill/mcp
```

Set env var: `export PAYSKILL_SIGNER_KEY=your-private-key-hex`

## Configuration

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `PAYSKILL_SIGNER_KEY` | Yes | — | Private key (64 hex chars, with or without `0x`). If a `.enc` keystore exists, this is the decryption password. |
| `PAY_NETWORK` | No | `mainnet` | `mainnet` (Base) or `testnet` (Base Sepolia) |

### Key Sources (checked in order)

1. `PAYSKILL_SIGNER_KEY` env var as raw hex key
2. OS keychain via `keytar` (reads `~/.pay/keys/default.meta`)
3. Encrypted keystore at `~/.pay/keys/default.enc` (uses `PAYSKILL_SIGNER_KEY` as password)

The key format matches the `pay` CLI — if you've run `pay init`, the MCP server can use the same wallet.

## Diagnostic Check

Verify everything is configured correctly:

```bash
PAYSKILL_SIGNER_KEY=0x... npx @pay-skill/mcp --check
```

Output:
```
pay-mcp diagnostic check
  network: Base (chain 8453)
  api:     https://pay-skill.com/api/v1
  wallet:  0x1234...
  key:     env
  server:  OK (router: 0xABCD...)
  auth:    OK (balance: $50.00)

All checks passed. MCP server is ready.
```

## Tools (15)

### Payments
| Tool | Description |
|------|-------------|
| `pay_send` | Direct USDC payment ($1 min). Confirmation thresholds: <$10 auto, $10-100 plan, >$100 explicit. |
| `pay_request` | HTTP request with x402 auto-payment. Handles 402 detection, direct/tab settlement, price skepticism. |

### Tabs (metered accounts)
| Tool | Description |
|------|-------------|
| `pay_tab_open` | Open pre-funded tab ($5 min, $50 recommended). Provider charges per-call. |
| `pay_tab_close` | Close tab. Returns distribution breakdown (provider 99%, fee 1%, agent remainder). |
| `pay_tab_charge` | Charge against open tab (provider only). |
| `pay_tab_topup` | Add funds to open tab (agent only). |
| `pay_tab_list` | List tabs with idle/low-balance flags. |

### Wallet
| Tool | Description |
|------|-------------|
| `pay_status` | Balance, locked/available funds, actionable suggestions. |
| `pay_fund` | Generate 1-hour funding link (Coinbase Onramp or direct USDC). |
| `pay_withdraw` | Generate 1-hour withdrawal link. |
| `pay_mint` | Mint testnet USDC (Base Sepolia only). |

### Discovery & Webhooks
| Tool | Description |
|------|-------------|
| `pay_discover` | Search paid API services by keyword/category. |
| `pay_webhook_register` | Register webhook for payment events (HMAC-signed). |
| `pay_webhook_list` | List registered webhooks. |
| `pay_webhook_delete` | Delete a webhook. |

## Resources (5)

| URI | Description |
|-----|-------------|
| `pay://wallet/status` | Balance, tabs, locked/available |
| `pay://wallet/tabs` | All open tabs |
| `pay://tab/{tab_id}` | Single tab detail |
| `pay://wallet/address` | Wallet address |
| `pay://network` | Network config + contract addresses |

## Prompts (3)

| Prompt | Description |
|--------|-------------|
| `pay-for-service` | Guided: discover service, evaluate pricing, make request |
| `review-tabs` | Review tabs, flag idle, suggest close/topup |
| `fund-wallet` | Generate fund link, explain deposit process |

## Development

```bash
git clone https://github.com/remit-md/pay-mcp.git
cd pay-mcp
npm install
npm run build
npm test                    # unit tests (mocked)
npm run test:acceptance     # testnet (requires PAYSKILL_SIGNER_KEY)
```

## License

MIT
