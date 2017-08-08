// ------------------------------------------------------------------------------------------------------------------
// Imports
// ------------------------------------------------------------------------------------------------------------------
const _       = require('highland');
const utils   = require('utils');
const nedb    = require('nedb');
const request = require('request');
const FP      = require('feedparser');
const qs      = require('querystring');

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
async function main() {
  for (let query of queries) {
    console.log("------------------------------------------------------------------------------------------------------------");
    console.log("Searching for " + query);
    console.log("------------------------------------------------------------------------------------------------------------");
    for (let url of urls) {
      let city      = url.replace(UrlPattern, "$1");
      let res       = await run_search(url, { query : query, min_price : min, max_price : max, format : "rss" });
      let new_items = await process_feed(db, res);
      for (let x of new_items) {
        console.log(x.title);
        insert_data(x);
        // format HTML
      }
    }
  }
}

main();
