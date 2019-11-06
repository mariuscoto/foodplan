var express    = require('express');
var mongoose   = require('mongoose');
var bodyParser = require('body-parser');
var cron       = require('node-cron');
var fs         = require('fs');


// Read config
var config = (JSON.parse(fs.readFileSync('./config.json', 'utf8')));

// Init express app
var app = module.exports = express();

// App config
app.set('views', './views');
app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Run scheduler every Sunday
cron.schedule('* * * * 6', schedulePlates);

// Skip mongoose deprication warning on startup:
// Mongoose: mpromise (mongoose's default promise library) is deprecated, plug
// in your own promise library instead: http://mongoosejs.com/docs/promises.html
mongoose.Promise = global.Promise;
mongoose.connect(config.mongo_url, { useUnifiedTopology: true, useNewUrlParser: true });

// Require DB schemas
var Plate = require('./models/plate');
var Day   = require('./models/day');

// Index page
app.get('/', function(req, res) {

  var _self = {};
  Plate.find().exec(gotPLates);

  function gotPLates(err, plates) {
    _self.plates = plates;

    // Compute the scheduled plates for current week
    var weekday = new Date().getDay();
    var present = getDay(-weekday).toUTCString();
    var future  = getDay(7-weekday).toUTCString();

    var query = {'date': {$gte: present, $lte: future}};
    Day.find(query).exec(gotDays);
  }

  function gotDays(err, days) {
    _self.days        = [];
    _self.ingredients = [];

    if (days.length) {
      // Get details for scheduled plates
      days.forEach(function(day) {
        _self.plates.forEach(function(plate) {
          if (plate._id.toString() == day.plateID) {
            // Convert plate
            plate = plate.toJSON();
            // Save date in plate
            plate.date = day.date;
            // Save plate
            _self.days.push(plate);
            // Save list of ingredients in plate
            var plateIngredients = [];
            plate.ingredients.forEach(function(ing) {
              plateIngredients.push(ing.name);
            });
            // Merge current ingredients with the rest, removing duplicates
            _self.ingredients = _self.ingredients.concat(plateIngredients.filter(function (item) {
                return _self.ingredients.indexOf(item) < 0;
            }));
          }
        });
      });
    }

    res.render('index', {
      'plates'      : _self.plates,
      'days'        : _self.days,
      'ingredients' : _self.ingredients
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

app.get('/run', function(req, res) {
  schedulePlates();
  res.redirect('/');
});

// UTILS
function schedulePlates() {
  _self = {};

  // Compute the day in the past, until be retrieve the meals
  var past = getDay(-config.look_behind);
  var future = getDay(+config.look_forward);

  // Get plates from defined interval
  var query = {'date': {
    $gte: {$add: {past: past.getTimezoneOffset() * 60000}},
    $lte: {$add: {future: future.getTimezoneOffset() * 60000}}
  }};
  Day.find(query).exec(gotDays);

  function gotDays(err, days) {
    if (err) console.log(err);

    // Saves used plates
    _self.used = [];
    // Saves scheduled days
    _self.days = [];
    // Knows if all days are scheduled
    _self.plannedAll = false;

    days.forEach(function(day) {
      _self.used.push(day.plateID);
      _self.days.push(day.date.getTime());

      // Check if last day is scheduled
      // Because we plan only consecutive days, this means all days in the
      // defined interval are planned
      if (day.date.getTime() == future.getTime()) {
        _self.plannedAll = true;
      }
    });

    // Not all meals in defined interval are set, let's plan them
    if (!_self.plannedAll) {
      Plate.find().exec(gotPlates);
    }
  }

  function gotPlates(err, plates) {
    // Make sure days starting today to today+look_forward are planned
    for (var i=0; i<=config.look_forward; i++) {
      // Find a day that is not planned
      if (_self.days.indexOf(getDay(i).getTime()) < 0) {
        // Choose plate
        var plate = getPlate(plates, _self.used);
        // TODO: Add plate to list of used ones
        // Log
        console.log('Planned ' + plate.name + '(' + plate._id + ') for ' + getDay(i));
        // Save day
        new Day({
          'date'    : getDay(i),
          'plateID' : plate
        }).save(savedDay);
      }
    }
  }

  function savedDay(err) {
    if (err) console.log(err);
  }
}

function getPlate(all, used) {
  // Try to get a random plate
  var plate       = null;
  var found       = false;
  var plate_retry = config.plate_retry;

  while (!found && plate_retry !== 0) {
    // Get one random plate
    plate = shuffle(all)[0];
    // Check if already used
    if (used.indexOf(plate._id.toString()) > -1) {
      plate_retry--;
    } else {
      found = true;
    }
  }

  if (!found) {
    // TODO: If random fails, search for plate
    console.log('ERR: Fix me!');
    return null;
  } else {
    return plate;
  }
}

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

function getDay(diff) {
  // Get start of the day
  var today = new Date(new Date().toISOString());
  today = new Date(today.setHours(0,0,0,0));

  // Get new date based on diff
  var newDay = new Date();
  newDay = new Date(newDay.setDate(today.getDate() + diff));
  newDay = new Date(newDay.setHours(0,0,0,0));

  return newDay;
}

// Start server
app.listen(process.env.PORT || 5000, function() {
  console.log('Server started. In dev, open: http://localhost:5000/')
});
