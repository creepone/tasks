var _ = require('underscore'),
	mongodb = require('mongodb');

_.extend(exports, {
	/*
		Queries the database for the user with properties specified in o.
	*/
	findUser: function(o, callback)
	{
		_ensureCollection("users", function (err, users) {
			if (err)
				return callback(err);

			users.findOne(o, callback);
		});
	},

	/*
		Inserts the given user into the database.
	*/
	insertUser: function(o, callback)
	{
		_ensureCollection("users", function (err, users) {
			if (err)
				return callback(err);

			users.insert(o, { w: 1 }, callback);
		});
	},

	/*
		Inserts the given device into the database.
	*/
	insertDevice: function(o, callback)
	{
		_ensureCollection("devices", function (err, devices) {
			if (err)
				return callback(err);

			devices.insert(o, { w: 1 }, callback);
		});
	}
});

var _db;
function _ensureDb(callback)
{
	if (_db)
		return callback(null, _db);
	
	mongodb.Db.connect(process.env.MONGOHQ_URL || 'mongodb://localhost', function(err, db) {
		if (err) 
			return callback(err);
		_db = db;
		callback(null, db);
	});
}

function _ensureCollection(collectionName, callback)
{
	_ensureDb(function (err, db) {
		if (err)
			return callback(err);
			
		db.collection(collectionName, function (err, collection) {
			if (err)
				return callback(err);
			
			callback(null, collection);
		})
	})
}