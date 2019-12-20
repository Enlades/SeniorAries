const StellarSdk = require('stellar-sdk');
const IPFS = require('ipfs');
const CryptoJS = require('crypto-js');
const bs58 = require('bs58');

var pair = StellarSdk.Keypair
  .fromSecret('SCRRAIIYLZTZDQ7FKF7H74QBIRSMUD3VYXIS35DFNV4F4ZWOPRIG32QS');

  module.exports.GetMailsFromTransactions = async function GetMailsFromTransactions(transactionsArray){

    return new Promise(async function(res, rej){
        const node = await IPFS.create();

        let structuredMails = [];

        for(var i = 1; i < transactionsArray.length; i++){
            console.log("");
            console.log("From : " + transactionsArray[i].source_account);
            console.log("Memo : " + transactionsArray[i].memo);
    
            console.log("IPFS Hash : " + getIpfsHashFromBytes32(Buffer.from(transactionsArray[i].memo, 'base64').toString('hex')));
    
            const fileBuffer = await node.cat(getIpfsHashFromBytes32(Buffer.from(transactionsArray[i].memo, 'base64').toString('hex')));

            await node.get(getIpfsHashFromBytes32(Buffer.from(transactionsArray[i].memo, 'base64').toString('hex')));

            console.log('Message :', fileBuffer.toString());
            console.log("");

            var bytes  = CryptoJS.AES.decrypt(fileBuffer.toString(), 'C987AFE9531CBD3AF86EF6D436669');
            var plaintext = bytes.toString(CryptoJS.enc.Utf8);

            structuredMails.push({from:transactionsArray[i].source_account, message:plaintext});
        }
        
        await node.stop();

        res(structuredMails);
    });
}

module.exports.CreateAndAddIPFSMail = async function CreateAndAddIPFSMail(mailBody){

    return new Promise(async function(res, rej){
        let node = await IPFS.create();
 
        // Encrypt
        var ciphertext = CryptoJS.AES.encrypt(mailBody, 'C987AFE9531CBD3AF86EF6D436669');

        const filesAdded = await node.add({
            path: 'someMessage.txt',
            content: ciphertext.toString()
        });

        await node.pin.add(filesAdded[0].hash);
    
        await node.stop();
    
        res( getBytes32FromIpfsHash(filesAdded[0].hash));
    });
}


function getIpfsHashFromBytes32(bytes32Hex) {
    // Add our default ipfs values for first 2 bytes:
    // function:0x12=sha2, size:0x20=256 bits
    const hashHex = "1220" + bytes32Hex;
    const hashBytes = Buffer.from(hashHex, 'hex');
    const hashStr = bs58.encode(hashBytes);
    return hashStr;
}

function getBytes32FromIpfsHash(ipfsListing){
    // Decode the base58 string and then slice the first two bytes
    // which represent the function code and it's length, in this case:
    // function:0x12=sha2, size:0x20=256 bits
    console.log(ipfsListing);
    console.log(bs58.decode(ipfsListing).toString('hex'));
    console.log(bs58.decode(ipfsListing).slice(2).toString('hex'));
    return bs58.decode(ipfsListing).slice(2).toString('hex');
}