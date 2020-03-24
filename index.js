var Q = require("q");

var MonetDB = require("monetdb")();


module.exports = function MonetDBPool(poolOptions, connOptions) {
    var self = this;

    var _connections = [];

    if(typeof(poolOptions) != "object" || typeof(connOptions) != "object") {
        throw new Error("Need two options objects to construct a MonetDBPool object");
    }
    if(!poolOptions.nrConnections || parseInt(poolOptions.nrConnections) <= 0) {
        throw new Error("Need a valid nrConnections argument");
    }

    for(var i=0; i<parseInt(poolOptions.nrConnections); ++i) {
        _connections.push(new MonetDB(connOptions));
    }

    _connections.forEach(function(conn) {
        conn._runningQueries = 0;
        conn._reserved = false;
        conn.free = function() { conn._reserved = false; }
    });

    self.nextConnection = function(reserve) {
        var available = _connections
            .filter(function(d) { return !d._reserved; })
            .map(function(d) { return d._runningQueries; });

        if(!available.length) {
            return null;
        }

        var minRunning = Math.min.apply(null, available);
        for(var i=0; i<_connections.length; ++i) {
            var conn = _connections[i];
            if(!conn._reserved && conn._runningQueries == minRunning) {
                if(reserve) _connections[i]._reserved = true;
                return _connections[i];
            }
        }
    };

    ["connect", "close"].forEach(function(d) {
        self[d] = function() {
            var args = arguments;
            return Q.all(
                _connections.map(function (conn) {
                    return conn[d].apply(conn[d], args);
                })
            );
        };
    });

    ["query", "querystream", "prepare"].forEach(function(d) {
        self[d] = function() {
            var args = arguments;
            var nextConn = self.nextConnection();
            if(!nextConn) {
                var deferred = Q.defer();
                deferred.reject(new Error("No available connection"));
                return deferred.promise;
            }
            ++nextConn._runningQueries;
            var conn = nextConn[d].apply(nextConn[d], args);
			conn.release = function (){
				--nextConn._runningQueries;			
			}
			//if streaming, we decrease the runningQueries number on the end event
			if (conn.on){
				conn.on('end', function() {
					conn.release();
				});
			//if promise, we decrease the runningQueries number on the resolve
			} else {
			    conn = conn.fin(function() {					
					--nextConn._runningQueries;					
				});
			}
			
			return conn;
            /*Legacy
            return nextConn[d].apply(nextConn[d], args).fin(function() {
                --nextConn._runningQueries;
            });*/
        };
    });

    // destroy is separated from the above two functions generators because it does not return a promise
    self.destroy = function(msg) {
        _connections.forEach(function(d) {
            d.destroy(msg);
        });
    };

    //function to set the load of the pool
	self.getRunningQueries = function() {
		var available = _connections
						.filter(function(d) { return !d._reserved; })
						.map(function(d) { return d._runningQueries; });
		return available;				
	};
    if(poolOptions.testing) {
        self.getConnections = function() {
            return _connections;
        }
    }
};
