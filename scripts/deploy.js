const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const networkName = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying ZeroGLaunchpad to ${networkName} with:`, deployer.address);

  const launchpadFactory = await hre.ethers.getContractFactory("ZeroGLaunchpad");
  const launchpad = await launchpadFactory.deploy(deployer.address);
  await launchpad.waitForDeployment();

  const address = await launchpad.getAddress();
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
