// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DonationRouter
/// @notice Immutable, minimal donation router. Routes ERC20 or native currency
///         from sender to receiver(s) and emits an event for indexing.
///         No owner, no admin, no upgradability, no state.
contract DonationRouter {
    event DonationSent(
        address indexed sender,
        address indexed receiver,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    error ZeroAddress();
    error ZeroAmount();
    error ArrayLengthMismatch();
    error TransferFailed();
    error IncorrectNativeAmount();

    /// @dev Safe transferFrom that handles tokens which do not return a bool
    ///      (e.g. USDT on Ethereum mainnet). Reverts with TransferFailed on failure.
    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }

    /// @notice Donate ERC20 tokens to a single receiver.
    ///         Caller must have approved this contract to spend `amount` of `token`.
    function donate(address token, address receiver, uint256 amount) external {
        if (receiver == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _safeTransferFrom(token, msg.sender, receiver, amount);

        emit DonationSent(msg.sender, receiver, token, amount, block.timestamp);
    }

    /// @notice Donate ERC20 tokens to multiple receivers in one transaction.
    function donateBatch(
        address token,
        address[] calldata receivers,
        uint256[] calldata amounts
    ) external {
        if (receivers.length != amounts.length) revert ArrayLengthMismatch();

        for (uint256 i; i < receivers.length; ++i) {
            if (receivers[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();

            _safeTransferFrom(token, msg.sender, receivers[i], amounts[i]);

            emit DonationSent(msg.sender, receivers[i], token, amounts[i], block.timestamp);
        }
    }

    /// @notice Donate native currency (ETH/BNB) to a single receiver.
    function donateNative(address receiver) external payable {
        if (receiver == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert ZeroAmount();

        (bool ok, ) = payable(receiver).call{value: msg.value}("");
        if (!ok) revert TransferFailed();

        emit DonationSent(msg.sender, receiver, address(0), msg.value, block.timestamp);
    }

    /// @notice Donate native currency to multiple receivers in one transaction.
    function donateNativeBatch(
        address[] calldata receivers,
        uint256[] calldata amounts
    ) external payable {
        if (receivers.length != amounts.length) revert ArrayLengthMismatch();

        // Validate total before sending any ETH (Checks-Effects-Interactions)
        uint256 total;
        for (uint256 i; i < receivers.length; ++i) {
            if (receivers[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();
            total += amounts[i];
        }
        if (total != msg.value) revert IncorrectNativeAmount();

        for (uint256 i; i < receivers.length; ++i) {
            (bool ok, ) = payable(receivers[i]).call{value: amounts[i]}("");
            if (!ok) revert TransferFailed();

            emit DonationSent(msg.sender, receivers[i], address(0), amounts[i], block.timestamp);
        }
    }
}
