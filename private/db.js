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
     Queries the database for the task with properties specified in o.
     */
    getTask: function(o)
    {
        return _getCollection("tasks")
            .then(function (tasks) {
                var deferred = Q.defer();
                tasks.findOne(o, deferred.makeNodeResolver());
                return deferred.promise;
            });
    },

    /*
     Queries the database for the devices using the condition specified in o.
     */
    findDevices: function(o, settings)
    {
        var res = _getCollection("devices")
            .then(function (devices) {
                var deferred = Q.defer();
                devices.find(o, deferred.makeNodeResolver());
                return deferred.promise;
            });

        return _applyCursorSettings(res, settings);
    },

    /*
     Queries the database for the patches using the condition specified in o.
     */
    findPatches: function(o, settings)
    {
        var res = _getCollection("patches")
            .then(function (patches) {
                var deferred = Q.defer();
                patches.find(o, deferred.makeNodeResolver());
                return deferred.promise;
            });

        return _applyCursorSettings(res, settings);

    },

    /*
     Queries the database for the tasks using the condition specified in o.
     */
    findTasks: function(o, settings)
    {
        var res = _getCollection("tasks")
            .then(function (tasks) {
                var deferred = Q.defer();
                tasks.find(o, deferred.makeNodeResolver());
                return deferred.promise;
            });

        return _applyCursorSettings(res, settings);
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
	insertDevice: function(o)
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
    insertPatch: function(o)
    {
        return _getCollection("patches")
            .then(function (patches) {
                var deferred = Q.defer();
                patches.insert(o, { w: 1 }, deferred.makeNodeResolver());
                return deferred.promise;
            });
    },

    /*
     Inserts the given task into the database.
     */
    insertTask: function(o)
    {
        return _getCollection("tasks")
            .then(function (tasks) {
                var deferred = Q.defer();
                tasks.insert(o, { w: 1 }, deferred.makeNodeResolver());
                return deferred.promise;
            });
    },

    /*
     Updates the given device in the database.
     */
    updateDevice: function(device, o)
    {
        return _getCollection("devices")
            .then(function(devices) {
                var deferred = Q.defer();
                devices.findAndModify(device, [], o, { w: 1 }, deferred.makeNodeResolver());
                return deferred.promise;
            });
    },

    /*
     Updates the given task in the database.
     */
    updateTask: function(task, o)
    {
        return _getCollection("tasks")
            .then(function(tasks) {
                var deferred = Q.defer();
                tasks.findAndModify(task, [], o, { w: 1 }, deferred.makeNodeResolver());
                return deferred.promise;
            });
    },
    
    /*
     Updates the given patch in the database.
     */
    updatePatch: function(patch, o)
    {
        return _getCollection("patches")
            .then(function(patches) {
                var deferred = Q.defer();
                patches.findAndModify(patch, [], o, { w: 1 }, deferred.makeNodeResolver());
                return deferred.promise;
            });
    },

    /*
     Deletes the given task in the database.
     */
    deleteTask: function(o)
    {
        return _getCollection("tasks")
            .then(function (tasks) {
                var deferred = Q.defer();
                tasks.remove(o, { w: 1 }, deferred.makeNodeResolver());
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
    else
        mongodb.Db.connect(process.env.MONGOHQ_URL || 'mongodb://localhost/local', function (err, db) {
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

function _applyCursorSettings(promise, settings)
{
    if (settings && settings.sort)
        promise = promise.then(_sortCursor.bind(null, settings.sort));

    if (settings && settings.lazy === false)
        promise = promise.then(_iterateCursor);

    return promise;
}

function _sortCursor(sortFields, cursor)
{
    var deferred = Q.defer();

    if (sortFields.length == 0)
        return cursor;
    else if (sortFields.length == 1)
        sortFields.push("asc");

    sortFields.push(deferred.makeNodeResolver());
    cursor.sort.apply(cursor, sortFields);
    return deferred.promise;
}

function _iterateCursor(cursor)
{
    var deferred = Q.defer();
    cursor.toArray(deferred.makeNodeResolver());
    return deferred.promise;
}