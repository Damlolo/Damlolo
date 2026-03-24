# 0G NFT Launchpad

A starter NFT launchpad for **0G Chain** with:

- `ZeroGLaunchpad` Solidity contract for creating and selling NFT drops.
- Hardhat config pre-wired for 0G testnet/mainnet.
- Minimal frontend to connect wallet, create projects, and mint.
- Frontend config auto-generated during contract deployment.

## 0G Chain settings used

Based on `docs.0g.ai` deployment docs:

- Testnet RPC: `https://evmrpc-testnet.0g.ai`
- Testnet chain ID: `16602`
- Mainnet RPC: `https://evmrpc.0g.ai`
- Mainnet chain ID: `16661`
- EVM version: `cancun`
- ChainScan APIs:
  - Testnet: `https://chainscan-galileo.0g.ai/open/api`
  - Mainnet: `https://chainscan.0g.ai/open/api`

## Project structure

- `contracts/ZeroGLaunchpad.sol` - launchpad + per-project ERC-721 collection logic.
- `hardhat.config.js` - compiler + network + verify config for 0G.
- `scripts/deploy.js` - deploys `ZeroGLaunchpad` and writes `frontend/config.js`.
- `scripts/host-frontend.js` - static hosting server for the frontend.
- `frontend/` - web UI (`index.html`, `app.js`, `styles.css`, `config.js`).

## Quick start

```bash
npm install
cp .env.example .env
# add PRIVATE_KEY in .env
npm run compile
npm run deploy:testnet
npm run host:frontend
```

Open `http://localhost:4173`.

## .env

Create a `.env` file:

```dotenv
PRIVATE_KEY=0x...
OG_TESTNET_RPC=https://evmrpc-testnet.0g.ai
OG_MAINNET_RPC=https://evmrpc.0g.ai
CHAINSCAN_API_KEY=placeholder
```

## Deploy + host workflow

1. Deploy contract:
   - Testnet: `npm run deploy:testnet`
   - Mainnet: `npm run deploy:mainnet`
2. Deployment script writes `frontend/config.js` with deployed launchpad address.
3. Start hosting UI:
   - `npm run host:frontend`
4. Open hosted UI and connect wallet.

## Contract workflow

1. Owner deploys `ZeroGLaunchpad`.
2. Owner calls `createProject(...)` to create a dedicated NFT collection contract.
3. Users call `mint(projectId, quantity)` with exact payment.
4. Funds are forwarded directly to project treasury.

## Notes

- This is a production-minded scaffold, but you should still add tests, allowlists, royalties, and security review before mainnet.
- For testnet tokens use 0G faucet: https://faucet.0g.ai


## Troubleshooting

### `TypeError: Cannot read properties of undefined (reading "address")`
This usually means Hardhat could not load a deployer signer for the selected network.

Fix:
1. Ensure `.env` exists (`cp .env.example .env`).
2. Set `PRIVATE_KEY` with `0x` prefix in `.env`.
3. Retry: `npm run deploy:testnet`.

Also ensure the private key account has testnet 0G from faucet: https://faucet.0g.ai


### `ProviderError: no matching receipts found`
This is usually an RPC indexing/polling issue (transaction broadcasted but receipt API lags).

Fix:
1. Wait ~15-60 seconds and check tx hash on ChainScan.
2. Retry deployment (the script now retries receipt polling + checks contract bytecode).
3. If it still fails, switch `OG_TESTNET_RPC` to another provider endpoint (0G docs suggest QuickNode or Thirdweb as alternatives).
