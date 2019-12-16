const StellarSdk = require('stellar-sdk');
const fs = require('fs');
const fetch = require('node-fetch');

const stellarServer = new StellarSdk.Server("https://horizon-testnet.stellar.org");

module.exports.GetKeyPairFromFile = function GetKeyPairFromFile(data){
    return StellarSdk.Keypair.fromSecret(data.toString());
}

module.exports.CreateRandomKey = function CreateRandomKey(){
    let tempPair = StellarSdk.Keypair.random();
    fs.writeFileSync('StellarWalletKey_Git.txt', tempPair.secret());
    return tempPair;
}

module.exports.CreateNewStellarAccount = async function CreateNewStellarAccount(keyPair){
    try {
        const response = await fetch(
          `https://friendbot.stellar.org?addr=${encodeURIComponent(keyPair.publicKey())}`
        );
        const responseJSON = await response.json();
        console.log("SUCCESS! You have a new account :)\n", responseJSON);
      } catch (e) {
        console.error("ERROR!", e);
    }
}

module.exports.GetStellarAccount = async function GetStellarAccount(publicKey){
  return await stellarServer.loadAccount(publicKey);
}

module.exports.MakeStellarTransaction = async function MakeStellarTransaction(ipfsmemo, sender, receiver){
  StellarSdk.Network.useTestNetwork();
  // Check if destination user exists
  stellarServer.loadAccount(receiver).catch(StellarSdk.NotFoundError, function(error){
    // Destination is the problem
    throw new Error('The destination account does not exist!');
  }).then(function(){
    // Load up sender account
    return stellarServer.loadAccount(sender.publicKey());
  }).then(function(sourceAccount){
      // Start building the transaction.
      transaction = new StellarSdk.TransactionBuilder(sourceAccount, { fee: 100})
      .addOperation(StellarSdk.Operation.payment({
        destination: receiver,
        // Because Stellar allows transaction in many currencies, you must
        // specify the asset type. The special "native" asset represents Lumens.
        asset: StellarSdk.Asset.native(),
        amount: "10"
      }))
      // A memo allows you to add your own metadata to a transaction. It's
      // optional and does not affect how Stellar treats the transaction.
      .addMemo(StellarSdk.Memo.hash(ipfsmemo))
      // Wait a maximum of three minutes for the transaction
      .setTimeout(180)
      .build();
      // Sign the transaction to prove you are actually the person sending it.
      transaction.sign(sender);
      // And finally, send it off to Stellar!
      return stellarServer.submitTransaction(transaction);
  });
}

module.exports.GetTransactions = async function GetTransactions(keyPair){

  return new Promise(function(res, rej){
    stellarServer.transactions()
    .forAccount(keyPair.publicKey())
    .call()
    .then(function (result) {
      //console.log(result.records);
      res(result.records);
      //return result.records;
    });
  });
}

//console.log(secret);