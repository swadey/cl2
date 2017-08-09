// ------------------------------------------------------------------------------------------------------------------
// Imports
// ------------------------------------------------------------------------------------------------------------------
const _        = require('highland');
const utils    = require('utils');
const nedb     = require('nedb');
const request  = require('request');
const FP       = require('feedparser');
const qs       = require('querystring');
const mailer   = require('nodemailer');
const Entities = require('html-entities').XmlEntities;
const config   = require('config');
const entities = new Entities();

// ------------------------------------------------------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------------------------------------------------------
const footer = "</div></body></html>\n";
const header = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <!-- Latest compiled and minified CSS -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous">
    <!-- Optional theme -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap-theme.min.css" integrity="sha384-rHyoN1iRsVXV4nD0JutlnGaslCJuC7uwjduW9SVrLvRYooPp2bWYgmgJQIXwl/Sp" crossorigin="anonymous">
  </head>
  <body>
    <!-- Latest compiled and minified JavaScript -->
    <!-- <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js" integrity="sha384-Tc5IQib027qvyjSMfHjOMaLkfuWVxZxUPnCJA7l2mCWNIpG9mGCD8wGNIcPD7Txa" crossorigin="anonymous"></script> -->

  <div class="container-fluid">
`;

// ------------------------------------------------------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------------------------------------------------------
const UrlPattern = /^https:\/\/(.*)\.craigslist\.org.*$/;
const auto_search = {
  min: 600,
  max: 7000,
  urls: [ "https://boston.craigslist.org/search/cta",
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
        ],
  queries: [ "subaru turbo",
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
             //"bmw (m3|m5) convertible"
           ]
};
const bike_search = {
  min: 50,
  max: 250,
  urls: [ "https://boston.craigslist.org/search/bia",
          "https://capecod.craigslist.org/search/bia",
          "https://washingtondc.craigslist.org/search/bia"
        ],
  queries: [ "cannondale -kids -girls -boys",
             "specialized -kids -girls -boys",
             "marin -kids -girls -boys",
             "trek -kids -girls -boys",
             "giant -kids -girls -boys",
             "(fairdale|surly|novara) -kids -girls -boys",
             "(brompton|dahon|montague|tern|strida)"
           ]
};
const parking_search = {
  min: 50,
  max: 200,
  urls: [ "https://boston.craigslist.org/search/prk",
          "https://nh.craigslist.org/search/prk"
        ],
  queries: [ "garage"
           ]
};

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

function send_email({ body, subject, to, from } = {}, {user, password} = {}, server = "smtp.gmail.com", port = 587) {
  let transporter = mailer.createTransport({
    host: server,
    port: port,
    secure: false,
    requireTLS: true,
    auth: {
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

  try {
    let image = item["enc:enclosure"]["@"]["resource"];
    item_text += `<div class="span2"><img class="img-polaroid" style="max-width:100%;max-height:100%;" src=${image}></img></div>\n`;
  }
  catch (e) {
    item_text += `<div class="span2"></div>\n`;
  }

  item_text += `
<div class="span10 offset2">
  <a href="${item.link}">${entities.decode(item.title)}</a>
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
// Searches
// ------------------------------------------------------------------------------------------------------------------
async function query(q, conf) {
  for (let query of q.queries) {
    let message = header;
    console.log("------------------------------------------------------------------------------------------------------------");
    console.log("Searching for " + query);
    console.log("------------------------------------------------------------------------------------------------------------");
    var n = 0;

    for (let url of q.urls) {
      let city      = url.replace(UrlPattern, "$1");
      let res       = await run_search(url, { query : query, min_price : q.min, max_price : q.max, format : "rss", srchType: "T" });
      let new_items = await process_feed(db, res);

      if (new_items.length > 0) {
        message += `<div class="row-fluid" style="background-color:#dfdfdf;"><div class="span12"><h3>Results from: ${city}</h3></div></div>\n`;
        message += "<hr>\n";
      }
      for (let x of new_items) {
        insert_data(db, x);
        let item_text = format_item(x);
        message += item_text;
      }
      n += new_items.length;
    }
    message += footer;
    if (n > 0) {
      send_email({ body: message, to: conf.to, from: conf.from, subject: `Results from: ${query}` },
                 { user: conf.user, password: conf.password });
    }
  }
}

// ------------------------------------------------------------------------------------------------------------------
// Main
// ------------------------------------------------------------------------------------------------------------------
const doc  = `
Usage:
  cl2.js [ --password=X | --recipient=Y | --user=X ]

Options:
  -u, --user=X         username
  -p, --password=Y     password
  -t, --to=Z           email address
`;
const opts = utils.docopt(doc);
//const conf = config.get();

for (k in Object.keys(opts))
  if (k !== "--config")
    config[k] = opts[k]

query(auto_search, config);
query(bike_search, config);
query(parking_search, config);
