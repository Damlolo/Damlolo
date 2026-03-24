const CHAIN_CONFIG = {
  testnet: {
    chainIdDec: 16602,
    chainIdHex: "0x40da",
    chainName: "0G-Galileo-Testnet",
    nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
    rpcUrls: ["https://evmrpc-testnet.0g.ai"],
    blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
  },
  mainnet: {
    chainIdDec: 16661,
    chainIdHex: "0x4115",
    chainName: "0G-Mainnet",
    nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
    rpcUrls: ["https://evmrpc.0g.ai"],
    blockExplorerUrls: ["https://chainscan.0g.ai"],
  },
};

const abi = [
  "function createProject(string,string,uint256,uint256,string,uint64,uint64,address) returns (uint256,address)",
  "function mint(uint256,uint256) payable",
  "function projects(uint256) view returns (address collection,address treasury,uint256 priceWei,uint64 saleStart,uint64 saleEnd,bool active)",
];

const logEl = document.getElementById("log");
const accountEl = document.getElementById("account");
const launchpadAddressInput = document.getElementById("launchpadAddress");

const appConfig = window.__LAUNCHPAD_CONFIG__ || {};
const network = appConfig.network === "mainnet" ? CHAIN_CONFIG.mainnet : CHAIN_CONFIG.testnet;

if (appConfig.launchpadAddress) {
  launchpadAddressInput.value = appConfig.launchpadAddress;
}

let provider;
let signer;

function log(msg) {
  logEl.textContent = `${new Date().toISOString()} | ${msg}\n${logEl.textContent}`;
}

async function connect() {
  if (!window.ethereum) {
    throw new Error("MetaMask not detected");
  }
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  accountEl.textContent = `Connected: ${await signer.getAddress()}`;
  log("Wallet connected");
}

async function switchNetwork() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: network.chainIdHex }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: network.chainIdHex,
            chainName: network.chainName,
            nativeCurrency: network.nativeCurrency,
            rpcUrls: network.rpcUrls,
            blockExplorerUrls: network.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw err;
    }
  }
  log(`Network switched to ${network.chainName}`);
}

function getLaunchpadContract() {
  const address = launchpadAddressInput.value.trim();
  if (!address) throw new Error("Please enter launchpad contract address");
  if (!signer) throw new Error("Connect wallet first");
  return new ethers.Contract(address, abi, signer);
}

async function createProject() {
  const c = getLaunchpadContract();
  const name = document.getElementById("name").value.trim();
  const symbol = document.getElementById("symbol").value.trim();
  const maxSupply = BigInt(document.getElementById("maxSupply").value || "0");
  const priceWei = ethers.parseEther(document.getElementById("price").value || "0");
  const baseURI = document.getElementById("baseUri").value.trim();
  const saleStart = Number(document.getElementById("saleStart").value || "0");
  const saleEnd = Number(document.getElementById("saleEnd").value || "0");
  const treasury = document.getElementById("treasury").value.trim();

  const tx = await c.createProject(name, symbol, maxSupply, priceWei, baseURI, saleStart, saleEnd, treasury);
  log(`Create project tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  log(`Create project confirmed in block ${receipt.blockNumber}`);
}

async function mint() {
  const c = getLaunchpadContract();
  const projectId = BigInt(document.getElementById("projectId").value);
  const quantity = BigInt(document.getElementById("quantity").value);

  const project = await c.projects(projectId);
  const totalCost = project.priceWei * quantity;

  const tx = await c.mint(projectId, quantity, { value: totalCost });
  log(`Mint tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  log(`Mint confirmed in block ${receipt.blockNumber}`);
}

if (appConfig.launchpadAddress) {
  log(
    `Using ${appConfig.network || "testnet"} config with launchpad ${appConfig.launchpadAddress}`
  );
}

document.getElementById("connectBtn").addEventListener("click", () => connect().catch((e) => log(e.message)));
document.getElementById("switchBtn").addEventListener("click", () => switchNetwork().catch((e) => log(e.message)));
document.getElementById("createBtn").addEventListener("click", () => createProject().catch((e) => log(e.message)));
document.getElementById("mintBtn").addEventListener("click", () => mint().catch((e) => log(e.message)));
