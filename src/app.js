// http://localhost:8080/login
const express = require("express");
const StellarSdk = require('stellar-sdk');
const hbs = require("hbs");
const multer  = require('multer')
const fs = require('fs');
const upload = multer({ dest: 'uploads/' })
const bodyParser = require('body-parser');

// Our modules
const stellarModule = require("./StellarModule");
const ipfsModule = require("./IpfsModule");

const port = 8080 ;
const app = express();

let userKeyPair;
let userId;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(express.static("/public"));

hbs.registerPartials("views/partials");

app.set("views", "views");
app.set("view options", {layout: "layout/base"});
app.set("view engine", "hbs");

// Login End
app.get("/login", (req, res) => {
  res.render("login", {
    title: "Welcome to Aries"
  })    
});

// Create End
app.get("/compose", (req, res) => {
  res.render("compose", {
    title: "Welcome to Aries",
    user : userId
  })    
});

// Home End
app.get("/home", async(req, res) =>{
  res.locals.userLoggedIn = true;

  await stellarModule.GetTransactions(userKeyPair)
  .catch(function(err){
    console.log(err);
  }).then(async function(rawMails){

    ipfsModule.GetMailsFromTransactions(rawMails)
    .catch(function(err){
      console.log(err);
    }).then(function(structuredMails){
      for(var i = 0; i < structuredMails.length; i++){
        console.log(structuredMails[i].from.localeCompare(userId));
        if(structuredMails[i].from.localeCompare(userId) == 0){
          structuredMails.splice(i, 1);
        }
      }
  
      res.render("home", {
        title : "Welcome to Aries",
        user : userId,
        mails : structuredMails
      })
    });
  });
})

// Login Post
app.post('/login', upload.single('pkFile'), async(req, res) => {
  console.log("Login post ");

  var keyData = fs.readFileSync(req.file.path);
  fs.unlink(req.file.path, (err) => {console.log(err);});

  userKeyPair = stellarModule.GetKeyPairFromFile(keyData);

  stellarModule.GetStellarAccount(userKeyPair.publicKey()).then(async function(accRes){
    userId = accRes.accountId();

    res.redirect('/home');
  }).catch(async(reason) => {
    console.log(reason);
    
    await stellarModule.CreateNewStellarAccount(userKeyPair);

    res.redirect('/login');
  });
});

// Createacc Post
app.post('/newuser', function(req, res) {
  stellarModule.CreateRandomKey();
  res.redirect('/login');
});

// Send Post
app.post('/send', async (req, res)=>{
    // Check if destination user exists
  stellarModule.GetStellarAccount(req.body.receiver).catch(StellarSdk.NotFoundError, function(error){
    // Destination is the problem
    throw new Error('The destination account does not exist!');
  }).then(async function(){

  await ipfsModule.CreateAndAddIPFSMail(req.body.body)
    .catch(function(error){
      console.log(error);
    }).then(async (memoHash) =>{

      await stellarModule.MakeStellarTransaction(memoHash, userKeyPair, req.body.receiver)
      .catch(function(err){
        console.log(err);
        res.redirect('/home');
      }).then(function(){
        res.redirect('/home');
      });
    });
  });
});

// Compose Post
app.post('/compose', function(req, res) {
  res.locals.userComposing = true;
  res.redirect('/compose');
});

// Default not found catch
app.use((req, res, next) => {
    res.type("text/text");
    res.status(404);
    res.send("404 File not found - Nodejs App");
});
 
// Start the server
app.listen(port, (err) => {
  console.log("Server started at port " + port);
});