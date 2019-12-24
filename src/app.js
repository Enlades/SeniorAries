// http://localhost:8080/login
const express = require("express");
const StellarSdk = require('stellar-sdk');
const hbs = require("hbs");
const multer  = require('multer')
const fs = require('fs');
const upload = multer({ dest: 'uploads/' })
const bodyParser = require('body-parser');
const path = require('path')

// Our modules
const stellarModule = require("./StellarModule");
const ipfsModule = require("./IpfsModule");

const port = 8080 ;
const app = express();

const adminPub = "GA2DGZGL2XS2YOMAJCUF74HGIOIWZHYLAESB3EBMB3VJDCO4UAEGAEP6";
const newUserHash = "6b436d6f7750307a653436505a536574484c7134675247527239346a5869414b";

let userKeyPair;
let userId;
let selectedMailSender;
let selectedMailHash;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, '../public')));

hbs.registerPartials(path.join(__dirname, "/../public/views/partials"));

hbs.registerHelper("mailOnClick", function(context) { 
  return 'onClick=console.log("hello");';
});

hbs.registerHelper("section", function(name, options) { 
  // "this" shows the main context object.
  if (!this._sections) this._sections = {}; // not to override _sections in context.
     this._sections[name] = options.fn(this); 
     //console.log(this);
     return null;
}); 

app.set("views", path.join(__dirname,"/../public/views"));
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
  res.locals.userLoggedIn = true;
  res.render("compose", {
    title: "Welcome to Aries",
    user : userId
  })    
});

// ReadMail End
app.get('/readmail', async(req, res) =>{
  res.locals.userLoggedIn = true;

  let mailBody = ipfsModule.GetMailFromHash(selectedMailHash).catch(function(err){
    console.log(err);
  }).then(function(messageBody){
    res.render("readmail", {
      title: "Welcome to Aries",
      user : userId,
      sender : selectedMailSender,
      message : messageBody
    });
  });
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

    res.redirect('/login');
  });
});

// ReadMail Post
app.post('/readmail', function(req, res) {
  selectedMailHash = req.body.hash.substring(0, req.body.hash.length - 1);
  selectedMailSender = req.body.from;
  res.redirect('/readmail');
});

// Createacc Post
app.post('/newuser', async(req, res) =>{
  stellarModule.CreateRandomKey();

  var keyData = fs.readFileSync('StellarWalletKey_Git.txt');

  userKeyPair = stellarModule.GetKeyPairFromFile(keyData);

  await stellarModule.CreateNewStellarAccount(userKeyPair).catch(function(err){
    console.log(err);
    res.redirect('/login');
  }).then(async()=>{
    await stellarModule.MakeStellarTransaction(newUserHash, userKeyPair, adminPub)
    .catch(function(err){
      console.log(err);
      res.redirect('/login');
    }).then(async()=>{
      stellarModule.GetStellarAccount(userKeyPair.publicKey()).then(async function(accRes){
        userId = accRes.accountId();
    
        res.redirect('/home');
      }).catch(async(reason) => {
        console.log(reason);
    
        res.redirect('/login');
      });
    });
  })

});

// Logout Post
app.post('/logout', function(req, res) {
  userKeyPair = "";
  userId = "";
  selectedMailSender = "";
  selectedMailHash = "";

  res.redirect('/login');
});

// Home Post
app.post('/home', function(req, res) {
  res.redirect('/home');
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