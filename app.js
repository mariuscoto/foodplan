var express    = require('express');
var mongoose   = require('mongoose');
var bodyParser = require('body-parser');

var app = module.exports = express();

// App config
app.set('views', './views');
app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Skip mongoose deprication warning on startup:
// Mongoose: mpromise (mongoose's default promise library) is deprecated, plug
// in your own promise library instead: http://mongoosejs.com/docs/promises.html
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://admin:admin@ds039125.mlab.com:39125/heroku_b6h4cx6r');

// Require DB schemas
var Plate      = require('./model');

// Index page
app.get('/', function(req, res) {
  Plate.find().exec(gotPLates);

  function gotPLates(err, plates) {
    res.render('index', {
      'plates': plates
    });
  }
});

// Save route
app.post('/save', function(req, res) {
  var ingredients = [];
  req.body.ing.forEach(function(ingredient) {
    if (ingredient != '') {
      ingredients.push({
        'name': ingredient
      });
    }
  });

  new Plate({
    'name'        : req.body.plateName,
    'ingredients' : ingredients
  }).save(function(err) {
    if (err) console.log(err);
    else res.redirect('/');
  });
});

// Delete route
app.get('/delete', function(req, res) {
  Plate.remove({_id: req.query.id}).exec(removedPlate);

  function removedPlate(err) {
    if (err) console.log(err);
    res.redirect('/');
  }
});

// Start server
app.listen(5000, function() {
  console.log('Server listening on port 5000: http://localhost:5000/')
});
