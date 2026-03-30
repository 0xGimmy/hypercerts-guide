// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DonationRouter.sol";

contract DeployDonationRouter is Script {
    function run() external {
        vm.startBroadcast();
        DonationRouter router = new DonationRouter();
        vm.stopBroadcast();

        console.log("DonationRouter deployed at:", address(router));
    }
}
