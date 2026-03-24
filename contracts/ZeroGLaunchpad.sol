// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract LaunchpadCollection is ERC721, Ownable {
    using Strings for uint256;

    uint256 public immutable maxSupply;
    string public baseTokenURI;
    uint256 private _nextTokenId;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        string memory baseURI_,
        address launchpadOwner
    ) ERC721(name_, symbol_) Ownable(launchpadOwner) {
        require(maxSupply_ > 0, "maxSupply must be > 0");
        maxSupply = maxSupply_;
        baseTokenURI = baseURI_;
    }

    function mintTo(address to, uint256 quantity) external onlyOwner {
        require(quantity > 0, "quantity must be > 0");
        require(_nextTokenId + quantity <= maxSupply, "sold out");

        for (uint256 i = 0; i < quantity; i++) {
            _nextTokenId++;
            _safeMint(to, _nextTokenId);
        }
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    function setBaseTokenURI(string calldata newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(baseTokenURI, tokenId.toString(), ".json");
    }
}

contract ZeroGLaunchpad is Ownable {
    struct Project {
        address collection;
        address payable treasury;
        uint256 priceWei;
        uint64 saleStart;
        uint64 saleEnd;
        bool active;
    }

    uint256 public projectCount;
    mapping(uint256 => Project) public projects;

    event ProjectCreated(
        uint256 indexed projectId,
        address indexed collection,
        address indexed treasury,
        uint256 priceWei,
        uint64 saleStart,
        uint64 saleEnd
    );
    event ProjectStatusUpdated(uint256 indexed projectId, bool active);
    event Minted(uint256 indexed projectId, address indexed buyer, uint256 quantity, uint256 paidWei);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function createProject(
        string calldata name_,
        string calldata symbol_,
        uint256 maxSupply_,
        uint256 priceWei_,
        string calldata baseURI_,
        uint64 saleStart_,
        uint64 saleEnd_,
        address payable treasury_
    ) external onlyOwner returns (uint256 projectId, address collection) {
        require(treasury_ != address(0), "invalid treasury");
        require(saleEnd_ == 0 || saleEnd_ > saleStart_, "invalid sale window");

        LaunchpadCollection nft = new LaunchpadCollection(name_, symbol_, maxSupply_, baseURI_, address(this));

        projectId = ++projectCount;
        projects[projectId] = Project({
            collection: address(nft),
            treasury: treasury_,
            priceWei: priceWei_,
            saleStart: saleStart_,
            saleEnd: saleEnd_,
            active: true
        });

        emit ProjectCreated(projectId, address(nft), treasury_, priceWei_, saleStart_, saleEnd_);
        return (projectId, address(nft));
    }

    function setProjectStatus(uint256 projectId, bool active) external onlyOwner {
        _requireProjectExists(projectId);
        projects[projectId].active = active;
        emit ProjectStatusUpdated(projectId, active);
    }

    function setProjectPrice(uint256 projectId, uint256 priceWei_) external onlyOwner {
        _requireProjectExists(projectId);
        projects[projectId].priceWei = priceWei_;
    }

    function mint(uint256 projectId, uint256 quantity) external payable {
        require(quantity > 0, "quantity must be > 0");
        Project memory project = _getProjectOrRevert(projectId);
        require(project.active, "inactive");
        if (project.saleStart != 0) {
            require(block.timestamp >= project.saleStart, "sale not started");
        }
        if (project.saleEnd != 0) {
            require(block.timestamp <= project.saleEnd, "sale ended");
        }

        uint256 totalCost = project.priceWei * quantity;
        require(msg.value == totalCost, "incorrect payment");

        LaunchpadCollection(project.collection).mintTo(msg.sender, quantity);
        (bool sent, ) = project.treasury.call{value: msg.value}("");
        require(sent, "transfer failed");

        emit Minted(projectId, msg.sender, quantity, msg.value);
    }

    function _requireProjectExists(uint256 projectId) internal view {
        require(projectId != 0 && projectId <= projectCount, "project not found");
    }

    function _getProjectOrRevert(uint256 projectId) internal view returns (Project memory project) {
        _requireProjectExists(projectId);
        return projects[projectId];
    }
}
