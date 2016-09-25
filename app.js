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
var Plate = require('./models/plate');
var Day   = require('./models/day');

// Index page
app.get('/', function(req, res) {

  var _self = {};
  Plate.find().exec(gotPLates);

  function gotPLates(err, plates) {
    _self.plates = plates;
    Day.findOne({'date': getTomorrow()}).exec(gotDay);
  }

  function gotDay(err, day) {
    _self.plates.forEach(function(plate) {
      if (plate._id.toString() == day.plateID) {
        _self.tomorrow = plate;
      }
    });

    res.render('index', {
      'plates'   : _self.plates,
      'tomorrow' : _self.tomorrow
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

app.get('/list', function(req, res) {

  _self = {};
  _SCHEDULE_IN_ADVANCE = 1;

  // Get plates from last days
  Day.find().exec(gotDays);

  function gotDays(err, days) {
    if (err) console.log(err);

    _self.days     = [];
    _self.tomorrow = false;

    days.forEach(function(day) {
      _self.days.push(day.plateID);

      console.log(day.date.getTime())
      console.log(getTomorrow().getTime())
      if (day.date.getTime() == getTomorrow().getTime()) {
        _self.tomorrow = true;
      }
    });

    // No meal for tomorrow, let's plan it
    if (!_self.tomorrow) {
      console.log('ceva')
      Plate.find({_id: {$not: {$in: _self.days}}}).exec(gotPlates);
    } else {
      res.redirect('/');
    }
  }

  function gotPlates(err, plates) {
    // Get one random plate
    var randomPlate = shuffle(plates).splice(0, 1)[0];

    new Day({
      'date'    : getTomorrow(),
      'plateID' : randomPlate._id
    }).save(savedDay);
  }

  function savedDay(err) {
    if (err) console.log(err);
    res.redirect('/');
  }
});

// UTILS
function shuffle(a) {
  var j, x, i;
  for (i = a.length; i; i--) {
    j = Math.floor(Math.random() * i);
    x = a[i - 1];
    a[i - 1] = a[j];
    a[j] = x;
  }

  return a;
}

function getTomorrow() {
  var today = new Date(new Date().setHours(0,0,0,0));

  var tomorrow = new Date();
  tomorrow = new Date(tomorrow.setDate(today.getDate() + 1));
  tomorrow = new Date(tomorrow.setHours(0,0,0,0));

  return tomorrow;
}

// Start server
app.listen(process.env.PORT || 5000, function() {
  console.log('Server started. In dev, open: http://localhost:5000/')
});
