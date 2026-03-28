require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

function normalizePrivateKey(rawValue) {
  if (!rawValue) return "";

  let key = rawValue.trim().replace(/^['"]|['"]$/g, "");

  // Common copy/paste mistake: key already has 0x and user prepends another 0x.
  if (key.startsWith("0x0x")) {
    key = key.slice(2);
  }

  if (!key.startsWith("0x")) {
    key = `0x${key}`;
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    console.warn(
      "[hardhat.config] PRIVATE_KEY is invalid. Expected exactly 32 bytes (64 hex chars, optional 0x prefix). Ignoring PRIVATE_KEY for now."
    );
    return "";
  }

  return key;
}

const PRIVATE_KEY = normalizePrivateKey(process.env.PRIVATE_KEY || "");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    testnet: {
      url: process.env.OG_TESTNET_RPC || "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    mainnet: {
      url: process.env.OG_MAINNET_RPC || "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      testnet: process.env.CHAINSCAN_API_KEY || "placeholder",
      mainnet: process.env.CHAINSCAN_API_KEY || "placeholder",
    },
    customChains: [
      {
        network: "testnet",
        chainId: 16602,
        urls: {
          apiURL: "https://chainscan-galileo.0g.ai/open/api",
          browserURL: "https://chainscan-galileo.0g.ai",
        },
      },
      {
        network: "mainnet",
        chainId: 16661,
        urls: {
          apiURL: "https://chainscan.0g.ai/open/api",
          browserURL: "https://chainscan.0g.ai",
        },
      },
    ],
  },
};
