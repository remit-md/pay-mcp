/**
 * Test fixtures — mock Wallet for unit tests.
 */

import type {
  Wallet,
  SendResult,
  Tab,
  ChargeResult,
  Balance,
  Status,
  DiscoverService,
  WebhookRegistration,
  MintResult,
} from "@pay-skill/sdk";

export const AGENT_ADDR = "0x1111111111111111111111111111111111111111";
export const PROVIDER_ADDR = "0x2222222222222222222222222222222222222222";

export const MOCK_TAB: Tab = {
  id: "tab-001",
  provider: PROVIDER_ADDR,
  amount: 50.0,
  balanceRemaining: 45.0,
  totalCharged: 5.0,
  chargeCount: 10,
  maxChargePerCall: 0.5,
  totalWithdrawn: 0,
  status: "open",
  pendingChargeCount: 2,
  pendingChargeTotal: 1.0,
  effectiveBalance: 44.0,
};

export const MOCK_STATUS: Status = {
  address: AGENT_ADDR,
  balance: { total: 50.0, locked: 10.0, available: 40.0 },
  openTabs: 2,
};

export const MOCK_SEND_RESULT: SendResult = {
  txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  status: "confirmed",
  amount: 5.0,
  fee: 0.05,
};

export const MOCK_WEBHOOK: WebhookRegistration = {
  id: "wh-001",
  url: "https://example.com/webhook",
  events: ["payment.completed"],
};

/**
 * Create a mock Wallet with all public methods stubbed.
 * Override specific responses by passing partial overrides.
 */
export function createMockWallet(overrides?: {
  status?: Status;
  balance?: Balance;
  tabs?: Tab[];
  tab?: Tab;
  sendResult?: SendResult;
  chargeResult?: ChargeResult;
  webhook?: WebhookRegistration;
  webhooks?: WebhookRegistration[];
  fundUrl?: string;
  withdrawUrl?: string;
  mintResult?: MintResult;
  discoverServices?: DiscoverService[];
}): Wallet {
  const status = overrides?.status ?? MOCK_STATUS;
  const balance = overrides?.balance ?? status.balance;
  const tabs = overrides?.tabs ?? [MOCK_TAB];
  const tab = overrides?.tab ?? MOCK_TAB;
  const sendResult = overrides?.sendResult ?? MOCK_SEND_RESULT;
  const chargeResult = overrides?.chargeResult ?? { chargeId: "ch-001", status: "buffered" };
  const webhook = overrides?.webhook ?? MOCK_WEBHOOK;
  const webhooks = overrides?.webhooks ?? [MOCK_WEBHOOK];
  const fundUrl = overrides?.fundUrl ?? "https://pay-skill.com/fund?token=abc123";
  const withdrawUrl = overrides?.withdrawUrl ?? "https://pay-skill.com/withdraw?token=xyz789";
  const mintResult = overrides?.mintResult ?? { txHash: "0x" + "00".repeat(32), amount: 100.0 };
  const discoverServices = overrides?.discoverServices ?? [];

  return {
    address: AGENT_ADDR,

    // Direct payment
    send: async () => sendResult,

    // Tabs
    openTab: async () => tab,
    closeTab: async () => ({ ...tab, status: "closed" as const }),
    topUpTab: async () => tab,
    listTabs: async () => tabs,
    getTab: async () => tab,
    chargeTab: async () => chargeResult,

    // x402
    request: async (url: string) => new Response(JSON.stringify({ data: "ok" }), { status: 200 }),

    // Wallet
    balance: async () => balance,
    status: async () => status,

    // Discovery
    discover: async () => discoverServices,

    // Funding
    createFundLink: async () => fundUrl,
    createWithdrawLink: async () => withdrawUrl,

    // Webhooks
    registerWebhook: async () => webhook,
    listWebhooks: async () => webhooks,
    deleteWebhook: async () => {},

    // Testnet
    mint: async () => mintResult,
  } as unknown as Wallet;
}
