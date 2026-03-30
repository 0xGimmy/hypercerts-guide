# Taiwan HyperAwesome Guidebook / 台灣超讚指南

A community-driven donation platform connecting donors to vetted Taiwan nonprofits via blockchain, built with trust and transparency in mind.

用信任串起台灣的公益力量 — 一個社群驅動的捐款平台，透過區塊鏈連結捐款者與台灣公益組織。

**Live site:** https://hypercerts-guide.pages.dev

---

## What is this? / 這是什麼？

The Taiwan HyperAwesome Guidebook is a peer-to-peer trust network for charitable giving. Instead of top-down rankings, the community curates and recommends organizations worth supporting. Donations are recorded on-chain for transparency, and a quadratic funding algorithm encourages diverse, distributed giving.

台灣超讚指南是一個點對點的公益信任網路。不同於由上而下的排名，由社群策展並推薦值得支持的組織。捐款紀錄在鏈上公開透明，並透過 Quadratic Funding 演算法鼓勵多元、分散的捐款。

### Core ideas / 核心理念

- **Trust network** — Recommendations spread from trusted nodes, not authority. / 信任網路 — 推薦從信任的節點擴散，而非權威。
- **Quadratic Funding** — Points = (Σ√amounts)². Small donations from many matter more than large donations from few. / 二次方募資 — 來自多人的小額捐款比少數人的大額捐款更有影響力。
- **Sybil prevention** — 7-day cooldown per sender-receiver pair. / 防女巫攻擊 — 同一對捐款者與組織之間有 7 天冷卻期。
- **On-chain transparency** — Every donation is a verifiable event on the blockchain. / 鏈上透明 — 每筆捐款都是區塊鏈上可驗證的事件。

### Featured organizations / 收錄組織

| Organization | Description |
|---|---|
| 亞洲生成藝術聯展 dialog( ) | Asia Generative Art Exhibition |
| 多多益善 Right Plus | Independent media for public welfare |
| 微光合唱團 Halo Choir | Taiwanese youth choir |

---

## Tech stack / 技術棧

| Layer | Technology |
|---|---|
| Frontend | Astro 5 + React islands + Tailwind CSS |
| Wallet | wagmi v2 + RainbowKit |
| Backend | Hono on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM |
| Blockchain | viem (direct RPC, no third-party indexer) |
| Smart contract | DonationRouter (Solidity, Foundry) |
| Deploy | Cloudflare Pages + Workers + D1 |
| Cost | $0 |

### Monorepo structure / 專案結構

```
├── apps/
│   ├── web/          Astro frontend (Cloudflare Pages)
│   └── api/          Hono API (Cloudflare Workers + D1)
├── contracts/        DonationRouter (Foundry)
├── packages/
│   └── shared/       Types, ABI, chain config
```

---

## Smart contract: DonationRouter

Immutable, stateless, no owner, no admin. Pure routing — transfers tokens from sender to receiver and emits an event.

不可變、無狀態、無管理員。純粹的路由 — 將代幣從捐款者轉移到接收者並發出事件。

**Supported chains / 支援的鏈：**

| Chain | Address |
|---|---|
| Optimism | `0x3573B010F5eB5636B16A0Ce7bc0C0Ca51D01e91C` |
| Ethereum | `0x029cb0aa773237Da52F3Fe81894c801296343f2b` |
| BSC | `0x62e614b260B77EA1Fdd7Db82c13Ad816394932b3` |
| Base | `0xb239BE0C7d68c4aDe01c3F23b8DEe2915E1AA07F` |
| Sepolia | `0xb239BE0C7d68c4aDe01c3F23b8DEe2915E1AA07F` |

**Supported tokens:** USDT, USDC, ETH, BNB (varies by chain)

---

## Development / 開發

### Prerequisites / 先決條件

- Node.js >= 18
- pnpm
- [Foundry](https://getfoundry.sh/) (for contracts)

### Setup / 設定

```bash
pnpm install

# Copy env file
cp apps/web/.env.example apps/web/.env
# Fill in PUBLIC_WALLETCONNECT_PROJECT_ID and PUBLIC_API_URL
```

### Run / 執行

```bash
# Frontend
pnpm --filter web dev

# Backend (requires wrangler login)
pnpm --filter api dev

# Contract tests
cd contracts && forge test
```

### Test / 測試

```bash
pnpm test                        # All tests
pnpm --filter api test           # Backend
pnpm --filter web test           # Frontend
cd contracts && forge test       # Contracts
```

### Deploy / 部署

```bash
# Backend
cd apps/api && npx wrangler deploy

# Frontend
cd apps/web && pnpm build && npx wrangler pages deploy dist --project-name hypercerts-guide
```

---

## License

MIT
