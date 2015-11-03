# MonetDB Pool NodeJS

[![Build Status](https://travis-ci.org/MonetDB/monetdb-pool-nodejs.svg)](https://travis-ci.org/MonetDB/monetdb-pool-nodejs)
[![Coverage Status](https://coveralls.io/repos/MonetDB/monetdb-pool-nodejs/badge.svg?branch=master&service=github)](https://coveralls.io/github/MonetDB/monetdb-pool-nodejs?branch=master)
[![Dependency Status](https://david-dm.org/MonetDB/monetdb-pool-nodejs.svg)](https://david-dm.org/MonetDB/monetdb-pool-nodejs)

Node module that maintains a connection pool with MonetDB connections.

## Example usage
```javascript
var MDBPool = require("monetdb-pool"); // MDBPool now is a constructor

var poolOptions = {
    nrConnections: 8
};

// For all possible database options, see https://github.com/MonetDB/monetdb-nodejs#options
var dbOptions = {
    dbname: "mydb"
};

var pool = new MDBPool(poolOptions, dbOptions);

// Execute 1000 queries, which will be divided over all of the connections in the pool
for(var i=0; i<1000; ++i) {
    pool.query("SELECT * FROM yourtable").then(function(result) {
        // Do something with your result here
    }, function(err) {
        // Handle error here
    });
}

// close the pool after finishing all queries.
pool.close();
```





## MDBPool object

#### MDBPool(poolOptions, dbOptions)
Constructs a MonetDB connection pool.

| Argument                  | Type          | Required       | Description     |
| :------------------------ | :------------ | :------------- | :-------------- |
| poolOptions               | object        | yes            | Object containing options for this pool.
| poolOptions.nrConnections | integer       | yes            | Number of connections to maintain inside this pool.
| poolOptions.testing       | boolean       | no             | Only used for testing purposes. If set to true, sets some additional methods on the pool object. Defaults to false.
| dbOptions                 | object        | yes            | Object containing database options for this pool. See https://github.com/MonetDB/monetdb-nodejs#options for the options you can use here.


#### MDBPool.connect()
Calls the connect method on all initialized [MonetDBConnection objects](https://github.com/MonetDB/monetdb-nodejs#mdbconnection).

Returns a promise that resolves when all connections are successfully connected.

#### MDBPool.query(query, \[params\], \[prettyResult\])
Calls [MonetDBConnection.query](https://github.com/MonetDB/monetdb-nodejs#mdbconnection_query) on the 
[next available connection in the pool](#nextConnection).

Returns the promise that is returned by [MonetDBConnection.query](https://github.com/MonetDB/monetdb-nodejs#mdbconnection_query).

#### MDBPool.prepare(query, \[prettyResult\])
Calls [MonetDBConnection.prepare](https://github.com/MonetDB/monetdb-nodejs#mdbconnection_prepare) on the 
[next available connection in the pool](#nextConnection).

Returns the promise that is returned by [MonetDBConnection.prepare](https://github.com/MonetDB/monetdb-nodejs#mdbconnection_prepare).

#### MDBPool.nextConnection(\[reserve\])
Gives you a raw [MonetDBConnection object](https://github.com/MonetDB/monetdb-nodejs#mdbconnection) from the connection pool.
A non-reserved connection with the least outstanding queries will be returned.

| Argument                  | Type          | Required       | Description     |
| :------------------------ | :------------ | :------------- | :-------------- |
| reserve                   | boolean       | no             | If set to true, the returned connection will be reserved for usage in your code, meaning this connection will not be used anymore by the connection pool until you call the free() function on it. Note that at the moment you obtain a MonetDBConnection object, it might still be working on other queries so queries that you issue will have to wait in the queue for completion of these earlier queries. If set to false, or omitted, the connection pool will keep on using this connection.

Returns a [MonetDBConnection object](https://github.com/MonetDB/monetdb-nodejs#mdbconnection) with the additional method free(), which should be used when you are done with the connection (only if you reserved the connection).
When there are no available (unreserved) connections, this method will return null.

**Warning: When you query MonetDBConnection objects directly, the connection pool will not know about these queries.
This might result in unfair query loads for the connection object you are using.
Hence we advice to keep this kind of usage to a minimum.**

#### MDBPool.close()
Calls the close method on all initialized [MonetDBConnection objects](https://github.com/MonetDB/monetdb-nodejs#mdbconnection).

Returns a promise that resolves when all connections are successfully closed.
