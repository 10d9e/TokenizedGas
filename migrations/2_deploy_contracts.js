var FixedSupplyToken = artifacts.require("./FixedSupplyToken.sol")
var GasTokenRelay = artifacts.require("./GasTokenRelay.sol")

module.exports = function (deployer, network, accounts) {

  var contractDeployer = accounts[5]
  var user = accounts[1]
  var relayer = accounts[2]

  deployer.then(async () => {

    console.log('network: ' + network)
    console.log(accounts)
    const owner = accounts[0]
    console.log('owner: ' + owner)

    let token = await deployer.deploy(FixedSupplyToken, {from: contractDeployer})
    let relay = await deployer.deploy(GasTokenRelay, token.address, {from: contractDeployer})

    // transfer some tokens to user
    await token.transfer(user, 1000000, {from: contractDeployer})

    // user approves relay contract to spend tokens to pay relayers
    await token.approve(relay.address, 1000000, {from: user})

    // 132000000000000
    /*
    console.log('balance:', await web3.eth.getBalance(user))

    let amount = await web3.eth.getBalance(user) - (2400 * 2000000000)

    console.log('amount', amount)

    await web3.eth.sendTransaction({ from: user, to: relayer, value: amount })
    */

  })

};
