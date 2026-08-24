// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @notice Phase 1 spike for encrypted inputs, ACLs, and FHE randomness.
contract ZamaPrimitiveSpike is ZamaEthereumConfig {
    mapping(address account => euint32 value) private _values;
    euint32 private _lastRandom;

    function submitValue(externalEuint32 encryptedValue, bytes calldata inputProof) external {
        euint32 value = FHE.fromExternal(encryptedValue, inputProof);

        _values[msg.sender] = value;

        FHE.allowThis(_values[msg.sender]);
        FHE.allow(_values[msg.sender], msg.sender);
    }

    function getValue(address account) external view returns (euint32) {
        return _values[account];
    }

    function drawRandomForCaller() external {
        _lastRandom = FHE.randEuint32(16);

        FHE.allowThis(_lastRandom);
        FHE.allow(_lastRandom, msg.sender);
    }

    function getLastRandom() external view returns (euint32) {
        return _lastRandom;
    }
}
