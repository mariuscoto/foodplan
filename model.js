// load the things we need
var mongoose = require('mongoose');

// define the schemas
var PlateSchema = mongoose.Schema({
  'name'        : {type: String, required: true},
  'ingredients' : [{
    'name'      : String
  }]
});

module.exports = mongoose.model('Plate', PlateSchema);
