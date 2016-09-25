// Load the things we need
var mongoose = require('mongoose');
var ObjectID = mongoose.Schema.Types.ObjectId;

var DaySchema = mongoose.Schema({
  'date'    : {type: Date, required: true},
  'plateID' : {type: ObjectID, required: true},
});

module.exports = mongoose.model('Day', DaySchema);
