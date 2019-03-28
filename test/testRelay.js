const Tx = require('ethereumjs-tx')

var GasTokenRelay = artifacts.require("./GasTokenRelay.sol")
var FixedSupplyToken = artifacts.require("./FixedSupplyToken.sol")

contract('gas relay tests', async (accounts) => {
	var user = accounts[1]
    var relayer = accounts[2]
    var contractDeployer = accounts[5]

    //let accountUser = {	address: '0x3f080D29D96df203bBbd86fC2a2a4c73ab078FcA', 
	//					privateKey: '0x705a6cdf0971421a29c9fc32ca446f96eb185d35b4532ce7d8f40db8f738e9ae' }

	var accountUser = { address: '0x07C042ddC05Be443EFe81B3125062045c1a0a68D',
  						privateKey: '0x5929e74781cf1e3cabaf7079a5040dd6eda1f0b82f618efdd5ca5e94b06f0d55' }

	async function setup(relay, token){
		// accountUser = web3.eth.accounts.create()
		// transfer some tokens to user
    	await token.transfer(accountUser.address, 1000000, {from: contractDeployer})

    	let amount = 50000 * 2000000000
    	await web3.eth.sendTransaction({ from: contractDeployer, to: accountUser.address, value: amount })

    	// user approves relay contract to spend tokens to pay relayers
    	await token.approve(relay.address, 1000000, {from: accountUser.address})
	}

    it("should test sendTxn no parameters", async () => {

		let relay = await GasTokenRelay.deployed()
		let token = await FixedSupplyToken.deployed()
		await setup(relay, token)

		console.log('token balances: ', (await token.balanceOf(accountUser.address)).toString(), (await token.balanceOf(relayer)).toString()  )
		//console.log('allowance: ', (await gasDelegator.allowance(accountUser.address)).toString() )
		console.log('ETH balances: ', (await web3.eth.getBalance(accountUser.address)).toString(), (await web3.eth.getBalance(relayer)).toString()  )

		
		// Step 1 - User creates builds transaction
		let txn = await buildRawTxnDirect('transfer(address,uint256)', ['address', 'uint256'], [relayer, 77], {
			account: accountUser,
			target: token.address
		})
		
		
		let data = await getFunctionData('transfer(address,uint256)', ['address', 'uint256'], [relayer, 77], {
			account: accountUser,
			target: token.address
		})
		var gas = {
		    to: token.address,
		    data: data,
		    from: user
		}
		let estimate = await web3.eth.estimateGas(gas)
		console.log('estimate', estimate)

		// step 2 Relayer estimates gas and submits
		// estimate gas
		let swapTxn = prepareSwapTxn(50, estimate, web3.utils.randomHex(32), accountUser)
		let relayTxn = await relay.swap(swapTxn.tokens, swapTxn.gas, swapTxn.origin, swapTxn.nonce, swapTxn.signature, {from: relayer, value: estimate})
		console.log(relayTxn)
		
		// Step 3 - relayer receives packet and transmits to contract
		let txnResult = await web3.eth.sendSignedTransaction(txn, {from: relayer})
		//console.log('RESULT: ', txnResult)

		console.log('balances: ', (await token.balanceOf(accountUser.address)).toString(), (await token.balanceOf(relayer)).toString()  )
		//console.log('allowance: ', (await gasDelegator.allowance(accountUser.address)).toString() )

		//throw 'ksdjf'

	});

    function prepareSwapTxn(tokens, gas, nonce, account) {
	  var functionSig = web3.eth.abi.encodeFunctionSignature("swapHash(uint256,uint256,address,bytes32)")
	  console.log(functionSig, tokens, gas, account.address, nonce)
	  var data = web3.utils.soliditySha3( functionSig, tokens, gas, account.address, nonce )
	  console.log('datahash', data)
	  var sig = web3.eth.accounts.sign(data, account.privateKey )

	  /*
	  	let func = web3.eth.abi.encodeFunctionSignature(funcDef)
		var data = web3.utils.soliditySha3( func, metadata.target, metadata.origin, metadata.paymentTokens)
		console.log('soliditySha3', data)

		var sig = web3.eth.accounts.sign(data, metadata.user.privateKey )
	*/

	  // prepare the mint packet
	  var packet = {}
	  packet.tokens = tokens
	  packet.gas = gas
	  packet.origin = account.address
	  packet.nonce = nonce
	  packet.signature = sig.signature
	  // deliver resulting JSON packet to pool or third party
	  console.log( JSON.stringify(packet, null, 4) )
	  return packet
	}

	async function getFunctionData(funcDef, paramTypes, paramValues, metadata) {
		let func = web3.eth.abi.encodeFunctionSignature(funcDef)
		let target = metadata.target.substring(2)
		let params = web3.eth.abi.encodeParameters(paramTypes, paramValues).substring(2)
		let newData = func + params
		console.log('newData', newData)
		return newData
	}

	async function buildRawTxnDirect(funcDef, paramTypes, paramValues, metadata) {
		let func = web3.eth.abi.encodeFunctionSignature(funcDef)
		let target = metadata.target.substring(2)
		let params = web3.eth.abi.encodeParameters(paramTypes, paramValues).substring(2)
		let newData = func + params
		console.log('newData', newData)

		const privateKey = new Buffer(metadata.account.privateKey.substring(2), 'hex')
		let txnCount = await web3.eth.getTransactionCount(metadata.account.address);

		const rawTx = {
		  nonce: txnCount,
		  //gasPrice: '0x3B9ACA00',
		  //gasLimit: '0x6ACFC0',
		  from: metadata.account.address,
		  gas: 2000000,
		  to: metadata.target,
		  value: '0x0',
		  data: newData
		}

		const tx = new Tx(rawTx);
		tx.sign(privateKey);
		const serializedTx = tx.serialize();

		console.log('serializedTx', serializedTx)

		return '0x' + serializedTx.toString('hex')
	}


});