// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DonationRouter.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] < amount) return false;
        if (balanceOf[from] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev ERC20 that does NOT return a bool from transferFrom (like USDT on mainnet)
contract MockUSDT {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        require(balanceOf[from] >= amount, "insufficient balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        // Note: no return value — mimics USDT behavior
    }
}

/// @dev Contract that rejects ETH transfers
contract RejectingReceiver {
    receive() external payable {
        revert("no ETH accepted");
    }
}

contract DonationRouterTest is Test {
    DonationRouter public router;
    MockERC20 public token;
    MockUSDT public usdt;

    address public donor = address(0x1);
    address public org1 = address(0x10);
    address public org2 = address(0x20);

    function setUp() public {
        router = new DonationRouter();
        token = new MockERC20();
        token.mint(donor, 10_000e6);

        usdt = new MockUSDT();
        usdt.mint(donor, 10_000e6);
    }

    // --- donate (ERC20) ---

    function test_donate() public {
        vm.startPrank(donor);
        token.approve(address(router), 100e6);

        vm.expectEmit(true, true, true, true);
        emit DonationRouter.DonationSent(donor, org1, address(token), 100e6, block.timestamp);

        router.donate(address(token), org1, 100e6);
        vm.stopPrank();

        assertEq(token.balanceOf(org1), 100e6);
        assertEq(token.balanceOf(donor), 10_000e6 - 100e6);
    }

    function test_donate_usdt_no_return_value() public {
        vm.startPrank(donor);
        usdt.approve(address(router), 100e6);
        router.donate(address(usdt), org1, 100e6);
        vm.stopPrank();

        assertEq(usdt.balanceOf(org1), 100e6);
    }

    function test_donateBatch() public {
        address[] memory receivers = new address[](2);
        receivers[0] = org1;
        receivers[1] = org2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100e6;
        amounts[1] = 200e6;

        vm.startPrank(donor);
        token.approve(address(router), 300e6);
        router.donateBatch(address(token), receivers, amounts);
        vm.stopPrank();

        assertEq(token.balanceOf(org1), 100e6);
        assertEq(token.balanceOf(org2), 200e6);
    }

    // --- donateNative ---

    function test_donateNative() public {
        vm.deal(donor, 1 ether);
        vm.prank(donor);

        vm.expectEmit(true, true, true, true);
        emit DonationRouter.DonationSent(donor, org1, address(0), 0.5 ether, block.timestamp);

        router.donateNative{value: 0.5 ether}(org1);

        assertEq(org1.balance, 0.5 ether);
    }

    function test_donateNativeBatch() public {
        vm.deal(donor, 1 ether);

        address[] memory receivers = new address[](2);
        receivers[0] = org1;
        receivers[1] = org2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0.3 ether;
        amounts[1] = 0.7 ether;

        vm.prank(donor);
        router.donateNativeBatch{value: 1 ether}(receivers, amounts);

        assertEq(org1.balance, 0.3 ether);
        assertEq(org2.balance, 0.7 ether);
    }

    // --- Revert: donate (ERC20) ---

    function test_revert_zeroAddress() public {
        vm.startPrank(donor);
        token.approve(address(router), 100e6);
        vm.expectRevert(DonationRouter.ZeroAddress.selector);
        router.donate(address(token), address(0), 100e6);
        vm.stopPrank();
    }

    function test_revert_zeroAmount() public {
        vm.prank(donor);
        vm.expectRevert(DonationRouter.ZeroAmount.selector);
        router.donate(address(token), org1, 0);
    }

    function test_revert_insufficientAllowance() public {
        vm.prank(donor);
        vm.expectRevert(DonationRouter.TransferFailed.selector);
        router.donate(address(token), org1, 100e6);
    }

    function test_revert_insufficientBalance() public {
        address poorDonor = address(0x99);
        vm.startPrank(poorDonor);
        token.approve(address(router), 100e6);
        vm.expectRevert(DonationRouter.TransferFailed.selector);
        router.donate(address(token), org1, 100e6);
        vm.stopPrank();
    }

    // --- Revert: donateBatch ---

    function test_revert_arrayMismatch() public {
        address[] memory receivers = new address[](2);
        receivers[0] = org1;
        receivers[1] = org2;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e6;

        vm.prank(donor);
        vm.expectRevert(DonationRouter.ArrayLengthMismatch.selector);
        router.donateBatch(address(token), receivers, amounts);
    }

    function test_revert_batch_zeroAddress() public {
        address[] memory receivers = new address[](2);
        receivers[0] = org1;
        receivers[1] = address(0);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100e6;
        amounts[1] = 100e6;

        vm.startPrank(donor);
        token.approve(address(router), 200e6);
        vm.expectRevert(DonationRouter.ZeroAddress.selector);
        router.donateBatch(address(token), receivers, amounts);
        vm.stopPrank();
    }

    function test_revert_batch_zeroAmount() public {
        address[] memory receivers = new address[](2);
        receivers[0] = org1;
        receivers[1] = org2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100e6;
        amounts[1] = 0;

        vm.startPrank(donor);
        token.approve(address(router), 100e6);
        vm.expectRevert(DonationRouter.ZeroAmount.selector);
        router.donateBatch(address(token), receivers, amounts);
        vm.stopPrank();
    }

    // --- Revert: donateNative ---

    function test_revert_donateNative_zeroAddress() public {
        vm.deal(donor, 1 ether);
        vm.prank(donor);
        vm.expectRevert(DonationRouter.ZeroAddress.selector);
        router.donateNative{value: 0.5 ether}(address(0));
    }

    function test_revert_donateNative_zeroAmount() public {
        vm.prank(donor);
        vm.expectRevert(DonationRouter.ZeroAmount.selector);
        router.donateNative{value: 0}(org1);
    }

    function test_revert_donateNative_rejectingReceiver() public {
        RejectingReceiver rejecter = new RejectingReceiver();
        vm.deal(donor, 1 ether);
        vm.prank(donor);
        vm.expectRevert(DonationRouter.TransferFailed.selector);
        router.donateNative{value: 0.5 ether}(address(rejecter));
    }

    // --- Revert: donateNativeBatch ---

    function test_revert_nativeAmountMismatch_overpay() public {
        vm.deal(donor, 1 ether);
        address[] memory receivers = new address[](1);
        receivers[0] = org1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0.5 ether;

        vm.prank(donor);
        vm.expectRevert(DonationRouter.IncorrectNativeAmount.selector);
        router.donateNativeBatch{value: 1 ether}(receivers, amounts);
    }

    function test_revert_nativeAmountMismatch_underpay() public {
        vm.deal(donor, 1 ether);
        address[] memory receivers = new address[](1);
        receivers[0] = org1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether;

        vm.prank(donor);
        vm.expectRevert(DonationRouter.IncorrectNativeAmount.selector);
        router.donateNativeBatch{value: 0.5 ether}(receivers, amounts);
    }

    function test_revert_nativeBatch_zeroAddress() public {
        vm.deal(donor, 1 ether);
        address[] memory receivers = new address[](2);
        receivers[0] = org1;
        receivers[1] = address(0);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0.5 ether;
        amounts[1] = 0.5 ether;

        vm.prank(donor);
        vm.expectRevert(DonationRouter.ZeroAddress.selector);
        router.donateNativeBatch{value: 1 ether}(receivers, amounts);
    }

    function test_revert_nativeBatch_zeroAmount() public {
        vm.deal(donor, 1 ether);
        address[] memory receivers = new address[](2);
        receivers[0] = org1;
        receivers[1] = org2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 0;

        vm.prank(donor);
        vm.expectRevert(DonationRouter.ZeroAmount.selector);
        router.donateNativeBatch{value: 1 ether}(receivers, amounts);
    }

    function test_revert_nativeBatch_arrayMismatch() public {
        vm.deal(donor, 1 ether);
        address[] memory receivers = new address[](2);
        receivers[0] = org1;
        receivers[1] = org2;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether;

        vm.prank(donor);
        vm.expectRevert(DonationRouter.ArrayLengthMismatch.selector);
        router.donateNativeBatch{value: 1 ether}(receivers, amounts);
    }

    function test_revert_nativeBatch_rejectingReceiver() public {
        RejectingReceiver rejecter = new RejectingReceiver();
        vm.deal(donor, 1 ether);

        address[] memory receivers = new address[](2);
        receivers[0] = org1;
        receivers[1] = address(rejecter);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0.5 ether;
        amounts[1] = 0.5 ether;

        vm.prank(donor);
        vm.expectRevert(DonationRouter.TransferFailed.selector);
        router.donateNativeBatch{value: 1 ether}(receivers, amounts);
    }

    // --- Edge cases ---

    function test_emptyBatch_erc20() public {
        address[] memory receivers = new address[](0);
        uint256[] memory amounts = new uint256[](0);

        vm.prank(donor);
        router.donateBatch(address(token), receivers, amounts);
    }

    function test_emptyBatch_native() public {
        address[] memory receivers = new address[](0);
        uint256[] memory amounts = new uint256[](0);

        vm.prank(donor);
        router.donateNativeBatch{value: 0}(receivers, amounts);
    }
}
