pragma solidity ^0.5.0;

import "./ECDSA.sol";

/**
 * @title ERC20 interface
 * @dev see https://eips.ethereum.org/EIPS/eip-20
 */
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function totalSupply() external view returns (uint256);
    function balanceOf(address who) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface ApproveAndCall {
    function approveAndCall(address spender, uint tokens, bytes32 data) external returns (bool success);
}

contract GasTokenRelay {
    using ECDSA for bytes32;
    
    IERC20 public token;

    mapping (bytes32 => bool) public executed;

    constructor(IERC20 _token) public {
        token = _token;
    }

    function swap(uint256 _tokens, uint256 _gas, address payable _origin, bytes32 _nonce, bytes memory _signature) public payable {
        // requires sender to send ether
        require(msg.value == _gas);
        bytes32 hashedTx = swapHash(_tokens, _gas, _origin, _nonce);
        require(executed[hashedTx] == false, "Transaction has already been executed");
        address txnAddress = hashedTx.recover(_signature);
        require(txnAddress != address(0), "Invalid minter address recovered from signature");
        require(txnAddress == _origin, "Origin minter address does not match recovered signature address");
        
        // transfer tokens to address
        require(token.transferFrom(txnAddress, msg.sender, _tokens), "There was an error transfering tokens");
        // transfer gas to origin
        _origin.transfer(_gas);
        executed[hashedTx] = true;
    }

    /**
     * @notice Hash (keccak256) of the payload used by delegatedMint
     * @param _nonce the golden nonce
     * @param _origin the original minter
     */
    function swapHash(uint256 _tokens, uint256 _gas, address _origin, bytes32 _nonce) public pure returns (bytes32) {
        bytes4 func = bytes4(keccak256("swapHash(uint256,uint256,address,bytes32)"));
        return keccak256(abi.encodePacked(func, _tokens, _gas, _origin, _nonce)).toEthSignedMessageHash();
    }

}