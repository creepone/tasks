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
        Queries the database for the device with properties specified in o.
    */
    getDevice: function(o)
    {
        return _getCollection("devices")
            .then(function (devices) {
                var deferred = Q.defer();
                devices.findOne(o, deferred.makeNodeResolver());
                return deferred.promise;
            });
    },

    /*
     Queries the database for the patch with properties specified in o.
     */
    getPatch: function(o)
    {
        return _getCollection("patches")
            .then(function (patches) {
                var deferred = Q.defer();
                patches.findOne(o, deferred.makeNodeResolver());
                return deferred.promise;
            });
    },

    /*
     Queries the database for the patches using the condition specified in o.
     */
    findPatches: function(o)
    {
        return _getCollection("patches")
            .then(function (patches) {
                var deferred = Q.defer();
                patches.find(o, deferred.makeNodeResolver());
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
	},

    /*
     Inserts the given patch into the database.
     */
    insertPatch: function(o, callback)
    {
        return _getCollection("patches")
            .then(function (patches) {
                var deferred = Q.defer();
                patches.insert(o, { w: 1 }, deferred.makeNodeResolver());
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