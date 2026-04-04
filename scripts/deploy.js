const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReceiptWithRetry(provider, txHash, maxAttempts = 30, delayMs = 3000) {
  for (let i = 1; i <= maxAttempts; i++) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) return receipt;
    await sleep(delayMs);
  }
  return null;
}

async function waitForCodeAtAddress(provider, address, maxAttempts = 30, delayMs = 3000) {
  for (let i = 1; i <= maxAttempts; i++) {
    const code = await provider.getCode(address);
    if (code && code !== "0x") return true;
    await sleep(delayMs);
  }
  return false;
}

async function main() {
  const networkName = hre.network.name;
  const signers = await hre.ethers.getSigners();

  if (!signers.length) {
    throw new Error(
      [
        "No deployer account found for this network.",
        "Set PRIVATE_KEY in your .env (with 0x prefix), then retry.",
        "Example: PRIVATE_KEY=0xabc123...",
      ].join(" ")
    );
  }

  const deployer = signers[0];
  const deployerAddress = await deployer.getAddress();
  console.log(`Deploying ZeroGLaunchpad to ${networkName} with:`, deployerAddress);

  const launchpadFactory = await hre.ethers.getContractFactory("ZeroGLaunchpad");
  const launchpad = await launchpadFactory.deploy(deployerAddress);

  const deploymentTx = launchpad.deploymentTransaction();
  if (!deploymentTx) {
    throw new Error("Deployment transaction not found.");
  }
  console.log("Deployment tx hash:", deploymentTx.hash);

  let receipt;
  try {
    receipt = await deploymentTx.wait(1);
  } catch (error) {
    const maybeReceiptError = String(error?.message || "").includes("no matching receipts found");
    if (!maybeReceiptError) throw error;

    console.warn("RPC did not return receipt immediately. Retrying receipt polling...");
    receipt = await waitForReceiptWithRetry(hre.ethers.provider, deploymentTx.hash);
  }

  const address = await launchpad.getAddress();

  if (!receipt) {
    console.warn("Receipt still unavailable. Checking deployed bytecode directly...");
    const hasCode = await waitForCodeAtAddress(hre.ethers.provider, address);

    if (!hasCode) {
      throw new Error(
        [
          "Deployment confirmation failed: no receipt and no contract code detected.",
          "Try a different RPC endpoint in OG_TESTNET_RPC (QuickNode/Thirdweb are suggested in 0G docs).",
          "Then rerun: npm run deploy:testnet",
        ].join(" ")
      );
    }

    console.warn("Contract bytecode detected on-chain despite missing receipt from RPC.");
  }

  console.log("ZeroGLaunchpad deployed at:", address);

  const cfg = {
    network: networkName,
    chainId: hre.network.config.chainId,
    launchpadAddress: address,
    explorer:
      networkName === "mainnet"
        ? "https://chainscan.0g.ai"
        : "https://chainscan-galileo.0g.ai",
    deployedAt: new Date().toISOString(),
  };

  const outputPath = process.env.FRONTEND_CONFIG_PATH || path.join(__dirname, "..", "frontend", "config.js");
  fs.writeFileSync(outputPath, `window.__LAUNCHPAD_CONFIG__ = ${JSON.stringify(cfg, null, 2)};\n`);
  console.log(`Frontend config written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
