const CHAIN_CONFIG = {
  testnet: {
    chainIdHex: "0x40da",
    chainName: "0G-Galileo-Testnet",
    nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
    rpcUrls: ["https://evmrpc-testnet.0g.ai"],
    blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
  },
  mainnet: {
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
  "function projectCount() view returns (uint256)",
  "function projects(uint256) view returns (address collection,address treasury,uint256 priceWei,uint64 saleStart,uint64 saleEnd,bool active)",
];

const appConfig = window.__LAUNCHPAD_CONFIG__ || {};
const network = appConfig.network === "mainnet" ? CHAIN_CONFIG.mainnet : CHAIN_CONFIG.testnet;
const logEl = document.getElementById("log");
const accountEl = document.getElementById("account");
const launchpadAddressInput = document.getElementById("launchpadAddress");
const marketGrid = document.getElementById("marketGrid");
const myCollectionsEl = document.getElementById("myCollections");
const profilePreview = document.getElementById("profilePreview");

let provider;
let signer;
let walletAddress = "";
let uploadedPfp = "";
let uploadedBanner = "";

if (appConfig.launchpadAddress) {
  launchpadAddressInput.value = appConfig.launchpadAddress;
}

function log(msg) {
  logEl.textContent = `${new Date().toISOString()} | ${msg}\n${logEl.textContent}`;
}

function userKey(suffix) {
  return walletAddress ? `0g_launchpad_${walletAddress.toLowerCase()}_${suffix}` : "";
}

function getContract() {
  const address = launchpadAddressInput.value.trim();
  if (!address) throw new Error("Enter launchpad contract address");
  if (!signer) throw new Error("Connect wallet first");
  return new ethers.Contract(address, abi, signer);
}

function setTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
}

async function connect() {
  if (!window.ethereum) throw new Error("MetaMask not detected");
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  walletAddress = await signer.getAddress();
  accountEl.textContent = `Wallet: ${walletAddress}`;
  hydrateProfile();
  renderMyCollections();
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
        params: [network],
      });
    } else {
      throw err;
    }
  }
  log(`Switched to ${network.chainName}`);
}

function saveCreatedProject(project) {
  if (!walletAddress) return;
  const key = userKey("projects");
  const current = JSON.parse(localStorage.getItem(key) || "[]");
  current.unshift(project);
  localStorage.setItem(key, JSON.stringify(current.slice(0, 100)));
}

function renderMyCollections() {
  if (!walletAddress) {
    myCollectionsEl.innerHTML = `<p class="hint">Connect wallet to view your collections.</p>`;
    return;
  }

  const projects = JSON.parse(localStorage.getItem(userKey("projects")) || "[]");
  if (!projects.length) {
    myCollectionsEl.innerHTML = `<p class="hint">No collections created yet.</p>`;
    return;
  }

  myCollectionsEl.innerHTML = projects
    .map(
      (p) => `
      <article class="collection-card">
        <h3>${p.name} (${p.symbol})</h3>
        <p><b>Project ID:</b> ${p.projectId}</p>
        <p><b>Collection:</b> ${p.collection}</p>
        <p><b>Price:</b> ${p.price} 0G</p>
        <p><b>Max Supply:</b> ${p.maxSupply}</p>
      </article>`
    )
    .join("");
}

async function createProject() {
  const c = getContract();

  const payload = {
    name: document.getElementById("name").value.trim(),
    symbol: document.getElementById("symbol").value.trim(),
    maxSupply: document.getElementById("maxSupply").value,
    price: document.getElementById("price").value,
    baseUri: document.getElementById("baseUri").value.trim(),
    saleStart: Number(document.getElementById("saleStart").value || "0"),
    saleEnd: Number(document.getElementById("saleEnd").value || "0"),
    treasury: document.getElementById("treasury").value.trim(),
  };

  const tx = await c.createProject(
    payload.name,
    payload.symbol,
    BigInt(payload.maxSupply || "0"),
    ethers.parseEther(payload.price || "0"),
    payload.baseUri,
    payload.saleStart,
    payload.saleEnd,
    payload.treasury
  );

  log(`Create tx: ${tx.hash}`);
  await tx.wait();

  const count = Number(await c.projectCount());
  const project = await c.projects(BigInt(count));

  saveCreatedProject({
    projectId: count,
    name: payload.name,
    symbol: payload.symbol,
    maxSupply: payload.maxSupply,
    price: payload.price,
    collection: project.collection,
  });

  renderMyCollections();
  await loadMarketplace();
  log(`Project #${count} created (${project.collection})`);
  setTab("collection");
}

async function loadMarketplace() {
  marketGrid.innerHTML = `<p class="hint">Loading marketplace...</p>`;
  if (!signer) {
    marketGrid.innerHTML = `<p class="hint">Connect wallet to load marketplace.</p>`;
    return;
  }

  const c = getContract();
  const count = Number(await c.projectCount());

  if (!count) {
    marketGrid.innerHTML = `<p class="hint">No projects live yet.</p>`;
    return;
  }

  const items = [];
  for (let id = count; id >= 1; id--) {
    const p = await c.projects(BigInt(id));
    items.push({ id, ...p });
  }

  marketGrid.innerHTML = items
    .map(
      (p) => `
      <article class="collection-card">
        <h3>Project #${p.id}</h3>
        <p><b>Collection:</b> ${p.collection}</p>
        <p><b>Price:</b> ${ethers.formatEther(p.priceWei)} 0G</p>
        <p><b>Active:</b> ${p.active ? "Yes" : "No"}</p>
        <label>Quantity <input id="qty-${p.id}" type="number" min="1" value="1" /></label>
        <button onclick="mintFromMarket(${p.id})">Mint</button>
      </article>`
    )
    .join("");
}

window.mintFromMarket = async function mintFromMarket(projectId) {
  try {
    const c = getContract();
    const qtyEl = document.getElementById(`qty-${projectId}`);
    const quantity = BigInt(qtyEl?.value || "1");
    const p = await c.projects(BigInt(projectId));
    const total = p.priceWei * quantity;
    const tx = await c.mint(BigInt(projectId), quantity, { value: total });
    log(`Mint tx: ${tx.hash}`);
    await tx.wait();
    log(`Minted ${quantity.toString()} NFT(s) from project #${projectId}`);
  } catch (err) {
    log(err.message || String(err));
  }
};

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function hydrateProfile() {
  if (!walletAddress) return;
  const data = JSON.parse(localStorage.getItem(userKey("profile")) || "{}");

  document.getElementById("username").value = data.username || "";
  document.getElementById("bio").value = data.bio || "";
  document.getElementById("socialX").value = data.socialX || "";
  document.getElementById("socialDiscord").value = data.socialDiscord || "";
  document.getElementById("socialWebsite").value = data.socialWebsite || "";

  uploadedPfp = data.pfp || "";
  uploadedBanner = data.banner || "";

  renderProfilePreview(data);
}

function renderProfilePreview(data) {
  if (!data || Object.keys(data).length === 0) {
    profilePreview.innerHTML = `<p class="hint">No profile saved yet.</p>`;
    return;
  }

  profilePreview.innerHTML = `
    <div class="banner" style="background-image:url('${data.banner || ""}')"></div>
    <div class="pfp" style="background-image:url('${data.pfp || ""}')"></div>
    <h3>${data.username || "Unnamed Creator"}</h3>
    <p>${data.bio || ""}</p>
    <p><b>X:</b> ${data.socialX || "-"}</p>
    <p><b>Discord:</b> ${data.socialDiscord || "-"}</p>
    <p><b>Website:</b> ${data.socialWebsite || "-"}</p>
  `;
}

function saveProfile() {
  if (!walletAddress) throw new Error("Connect wallet first");
  const data = {
    username: document.getElementById("username").value.trim(),
    bio: document.getElementById("bio").value.trim(),
    pfp: uploadedPfp,
    banner: uploadedBanner,
    socialX: document.getElementById("socialX").value.trim(),
    socialDiscord: document.getElementById("socialDiscord").value.trim(),
    socialWebsite: document.getElementById("socialWebsite").value.trim(),
  };

  localStorage.setItem(userKey("profile"), JSON.stringify(data));
  renderProfilePreview(data);
  log("Profile saved");
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setTab(tab.dataset.tab));
});

if (appConfig.launchpadAddress) {
  log(`Using launchpad: ${appConfig.launchpadAddress}`);
}

document.getElementById("connectBtn").addEventListener("click", () =>
  connect()
    .then(loadMarketplace)
    .catch((e) => log(e.message || String(e)))
);

document.getElementById("switchBtn").addEventListener("click", () =>
  switchNetwork().catch((e) => log(e.message || String(e)))
);

document.getElementById("createBtn").addEventListener("click", () =>
  createProject().catch((e) => log(e.message || String(e)))
);

document.getElementById("saveProfile").addEventListener("click", () => {
  try {
    saveProfile();
  } catch (e) {
    log(e.message || String(e));
  }
});

document.getElementById("refreshMarket").addEventListener("click", () =>
  loadMarketplace().catch((e) => log(e.message || String(e)))
);

document.getElementById("profileQuickBtn").addEventListener("click", () => setTab("profile"));

document.getElementById("pfpUpload").addEventListener("change", async (event) => {
  if (!walletAddress) {
    log("Connect wallet before uploading profile assets.");
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;
  uploadedPfp = await fileToDataUrl(file);
  const existing = JSON.parse(localStorage.getItem(userKey("profile")) || "{}");
  renderProfilePreview({ ...existing, pfp: uploadedPfp, banner: uploadedBanner || existing.banner });
  log("Profile picture selected. Click Save Profile to persist.");
});

document.getElementById("bannerUpload").addEventListener("change", async (event) => {
  if (!walletAddress) {
    log("Connect wallet before uploading profile assets.");
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;
  uploadedBanner = await fileToDataUrl(file);
  const existing = JSON.parse(localStorage.getItem(userKey("profile")) || "{}");
  renderProfilePreview({ ...existing, banner: uploadedBanner, pfp: uploadedPfp || existing.pfp });
  log("Banner image selected. Click Save Profile to persist.");
});

renderProfilePreview({});
renderMyCollections();
