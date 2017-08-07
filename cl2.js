// ------------------------------------------------------------------------------------------------------------------
// Imports
// ------------------------------------------------------------------------------------------------------------------
const _       = require('highland');
const utils   = require('utils');
const nedb    = require('nedb');
const request = require('request');
const FP      = require('feedparser');

// ------------------------------------------------------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------------------------------------------------------
function insert_data(db, data) {
  db.insert( { url: data.url, time: Date.now() });
}

// parse
function run_search(url, db) {
  var req        = request(url);
  var feedparser = new FP({ normalize : true });

  _(req).through(feedparser).each(d => insert_data(db, d))
}

// ------------------------------------------------------------------------------------------------------------------
// Database setup
// ------------------------------------------------------------------------------------------------------------------
db = new nedb({ filename: "cl-history.db", autoload: true, timestampData: true });
db.ensureIndex({ fieldName: 'url' , unique: true }, (err) => {});
db.loadDatabase();

run_search("https://washingtondc.craigslist.org/search/cta?format=rss", db);

