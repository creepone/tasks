var _ = require("underscore"),
	mongodb = require("mongodb"),
    Q = require("q");

_.extend(exports, {
	/*
		Queries the database for the user with properties specified in o.
	*/
	getUser: function(o)
	{
        return _getCollection("users")
          .then(function (users) {
                var deferred = Q.defer();
                users.findOne(o, deferred.makeNodeResolver());
                return deferred.promise;
            });
	},

	/*
		Inserts the given user into the database.
	*/
	insertUser: function(o)
	{
        return _getCollection("users")
          .then(function (users) {
                var deferred = Q.defer();
                users.insert(o, { w : 1 }, deferred.makeNodeResolver());
                return deferred.promise;
            });
	},

	/*
		Inserts the given device into the database.
	*/
	insertDevice: function(o, callback)
	{
        return _getCollection("devices")
          .then(function (devices) {
                var deferred = Q.defer();
                devices.insert(o, { w: 1 }, deferred.makeNodeResolver());
                return deferred.promise;
            });
	}
});

var _db;
function _getDb()
{
    var deferred = Q.defer();

    if (_db)
        deferred.resolve(_db);

    mongodb.Db.connect(process.env.MONGOHQ_URL || 'mongodb://localhost/local', function(err, db) {
        if (err) return deferred.reject(new Error(err));

        _db = db;
        deferred.resolve(db);
    });

   return deferred.promise;
}

function _getCollection(name)
{
    return _getDb()
      .then(function (db) {
            var deferred = Q.defer();
            db.collection(name, deferred.makeNodeResolver());
            return deferred.promise;
        });
}