// ------------------------------------------------------------------------------------------------------------------
// Imports
// ------------------------------------------------------------------------------------------------------------------
const _        = require('highland');
const utils    = require('utils');
const nedb     = require('nedb');
const request  = require('request');
const FP       = require('feedparser');
const qs       = require('querystring');
const mail     = require('nodemailer');
const entities = require('html-entities');

// ------------------------------------------------------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------------------------------------------------------
const min = 600;
const max = 7000;

const urls = [ "https://boston.craigslist.org/search/cta",
               "https://sfbay.craigslist.org/search/cta",
               "https://seattle.craigslist.org/search/cta",
               "https://la.craigslist.org/search/cta", //
               "https://nh.craigslist.org/search/cta", //
               "https://maine.craigslist.org/search/cta", //
               "https://providence.craigslist.org/search/cta",
               "https://washingtondc.craigslist.org/search/cta",
               "https://baltimore.craigslist.org/search/cta", //
               "https://monterey.craigslist.org/search/cta"
               //"https://mendocino.craigslist.org/search/cta",
             ];
const UrlPattern = /^https:\/\/(.*)\.craigslist\.org.*$/
const queries = [ "subaru turbo",
                  "subaru xt",
                  "subaru wrx",
                  "subaru legacy gt",
                  "saab (92-x|92x)",
                  //"miata (mazdaspeed|turbo)",
                  //"mr2 turbo",
                  // "miata",
                  // "bmw (330xi|325xi)",
                  // "bmw (525xi|535xi|530xi)",
                  //"audi s4",
                  "acura nsx",
                  // "audi tt",
                   // "porsche",
                  // "mini cooper",
                  // "bmw (635csi|m6)",
                  "bmw (m3|m5) convertible"
                ];

// ------------------------------------------------------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------------------------------------------------------
function insert_data(db, data) {
  db.insert( { url: data.link, time: Date.now() } );
             //function(err, ds) { if (err != null) console.log(err) } );
}

async function process_feed(db, items) {
  let ret = []
  for (let item of items) {
    ret.push(new Promise(function (resolve, reject) {
      db.find({ url : item.link }, (e, ds) => ds.length > 0 ? resolve(null) : resolve(item))
    }));
  }
  let new_items = await Promise.all(ret);

  return new_items.filter(x => x != null);
}

function send_email({ body, subject, to, from } = {}, {user, password, server, port} = { server: smtp.gmail.com, port: 587 }) {
  let transporter = nodemailer.createTransport({
    host   : server,
    port   : port,
    secure : true,
    auth   : {
      user: user,
      pass: password
    }
  });
  
  let mailOptions = {
    from    : from,
    to      : to,
    subject : subject,
    html    : body
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('Message %s sent: %s', info.messageId, info.response);
  });
}

function format_item(item) {
  let item_text = `<div class="row-fluid">\n`;
  let image     = item["enc:enclosure"]["@"]["resource"];

  if (image === undefined)
    item_text += `<div class="row-fluid">\n`;
  else
    item_text += `<div class="span1"><img class="img-polaroid" style="max-width:100%;max-height:100%;" src=${image}></img></div>\n`;

  item_text += `
<div class="span11">
  <a href=${item.source}>${entities.decode(item.title)}</a>
  <p>${entities.decode(item.description)}</p>
</div>\n`;
  return item_text + "</div>\n";
}

function run_search(url, params) {
  var req        = request({ url: url, qs: params });//, (err, r, body) => console.log(body));
  var feedparser = new FP( { normalize : true } );

  return _(req).through(feedparser).collect().toPromise(Promise);
}

// ------------------------------------------------------------------------------------------------------------------
// Database setup
// ------------------------------------------------------------------------------------------------------------------
db = new nedb({ filename: "cl-history.db", autoload: true, timestampData: true });
db.ensureIndex({ fieldName: 'url' , unique: true }, (err) => {});
db.loadDatabase();

// ------------------------------------------------------------------------------------------------------------------
// Main
// ------------------------------------------------------------------------------------------------------------------
async function main(recipient, user, password) {
  let message = `
<html>
<link href="http://netdna.bootstrapcdn.com/twitter-bootstrap/2.3.1/css/bootstrap-combined.min.css" rel="stylesheet">
<script src="http://netdna.bootstrapcdn.com/twitter-bootstrap/2.3.1/js/bootstrap.min.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1.0"

`;
  for (let query of queries) {
    console.log("------------------------------------------------------------------------------------------------------------");
    console.log("Searching for " + query);
    console.log("------------------------------------------------------------------------------------------------------------");

    for (let url of urls) {
      let city      = url.replace(UrlPattern, "$1");
      let res       = await run_search(url, { query : query, min_price : min, max_price : max, format : "rss" });
      let new_items = await process_feed(db, res);

      if (new_items.length > 0) {
        message += `<div class="row-fluid" style="background-color:#dfdfdf;"><div class="span12"><h3>Results from: ${city}</h3></div></div>\n`;
        message += "<hr>\n";
      }
      for (let x of new_items) {
        console.log(x.title);
        insert_data(x);
        // format HTML
        let item_text = format_item(x);
        message += item_text;
      }
    }
  }
  message += "</html>\n";
  send_email({ body: message, to: recipient, from: recipient, subject: `Results from: ${city}` }, { user: user, password: password });
}

main();
