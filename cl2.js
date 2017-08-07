// ------------------------------------------------------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------------------------------------------------------
const _     = require('highland');
const utils = require('utils');
const nedb  = require('nedb');
const hp    = require('htmlparser2');

function process_line(l) {
}

// ------------------------------------------------------------------------------------------------------------------
// Database setup
// ------------------------------------------------------------------------------------------------------------------
db = new nedb({ filename: "cl-history.db", autoload: true, timestampData: true });
db.ensureIndex({ fieldName: 'url' , unique: true }, (err) => {});

// parse
//new htmlparser.FeedHandler(function(error, feed) {
//  
//});
