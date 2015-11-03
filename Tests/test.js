var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
var Q = require("q");

var should = chai.should();
chai.use(chaiAsPromised);

var MDBPool = require("../index.js");

var poolOptions = function(nrConnections) {
    return {
        nrConnections: nrConnections,
        testing: true
    }
};

var dbOptions = {dbname: "test"};

describe("#Pool creation", function() {
    it("should fail on no arguments", function() {
        (function () {
            new MDBPool()
        }).should.throw(Error);
    });

    it("should fail on empty option objects", function() {
        (function () {
            new MDBPool({}, {})
        }).should.throw(Error);
        (function () {
            new MDBPool({}, {dbname: "test"})
        }).should.throw(Error);
        (function () {
            new MDBPool(poolOptions(8), {})
        }).should.throw(Error);
    });

    it("should fail on invalid nr connections", function() {
        (function () {
            new MDBPool(poolOptions(-1), {dbname: "test"});
        }).should.throw(Error);
    });

    it("should create the right amount of connections", function() {
        var pool1 = new MDBPool(poolOptions(8), dbOptions);
        var pool2 = new MDBPool(poolOptions(1), dbOptions);
        var pool3 = new MDBPool(poolOptions(1000), dbOptions);

        pool1.getConnections().should.be.an("array").with.length(8);
        pool2.getConnections().should.be.an("array").with.length(1);
        pool3.getConnections().should.be.an("array").with.length(1000);
    });
});



describe("#Pool usage", function() {
    var pool = null;

    beforeEach("Create pool", function() {
        pool = new MDBPool(poolOptions(8), dbOptions);
    });

    afterEach("Destroy pool", function() {
        pool.destroy();
        pool = null;
    });

    it("should properly connect", function() {
        return pool.connect();
    });

    it("should properly divide queries", function() {
        pool.connect();
        var i;
        for(i=0; i<8; ++i) {
            pool.query("SELECT 42");
        }

        pool.getConnections().forEach(function(conn) {
            conn._runningQueries.should.equal(1);
        });

        for(i=0; i<8; ++i) {
            pool.query("SELECT 42");
        }
        for(i=0; i<8; ++i) {
            pool.query("SELECT 42");
        }

        pool.getConnections().forEach(function(conn) {
            conn._runningQueries.should.equal(3);
        });
    });

    it("should allow proper connection reservation", function() {
        pool.connect();
        var i;
        var reservedConn = pool.nextConnection(true);
        for(i=0; i<700; ++i) {
            pool.query("SELECT 42");
        }

        pool.getConnections().forEach(function(conn) {
            if(conn._reserved) {
                reservedConn.should.equal(conn);
                reservedConn._runningQueries.should.equal(0);
            }
            else conn._runningQueries.should.equal(100);
        });

        reservedConn.free();

        for(i=0; i<100; ++i) {
            pool.query("SELECT 42");
        }

        pool.getConnections().map(function(d) { return d._runningQueries})
            .should.deep.equal([100, 100, 100, 100, 100, 100, 100, 100]);
    });

    it("should reject requests when all connections are reserved", function() {
        pool.connect();
        var i;
        for(i=0; i<8; ++i) {
            pool.nextConnection(true);
        }
        return pool.query("SELECT 42").should.be.rejected;
    });

    it("should successfully finish queries and decrease query counters", function() {
        this.timeout(10000);
        pool.connect();
        var i;
        var ps = [];
        for(i=0; i<400; ++i) {
            ps.push(
                pool.query("SELECT 42")
                    .should.eventually.have.property("data")
                    .that.deep.equals([[42]])
            );
        }
        for(i=0; i<400; ++i) {
            ps.push(
                pool.query("SELECT name FROM sys.functions WHERE id < ?", [0])
                    .should.eventually.have.property("rows")
                    .that.equals(0)
            );
        }
        for(i=0; i<400; ++i) {
            ps.push(
                pool.prepare("SELECT name FROM sys.functions WHERE id < ?").then(function(prepRes) {
                    return prepRes.exec([0]);
                }).should.eventually.have.property("rows")
                    .that.equals(0)
            );
        }
        return Q.all(ps).then(function() {
            pool.getConnections().map(function(d) { return d._runningQueries; })
                .should.deep.equal([0, 0, 0, 0, 0, 0, 0, 0]);
        });
    });
});


describe("#Pool destruction", function() {
    var pool = null;

    beforeEach("Create pool", function() {
        pool = new MDBPool(poolOptions(4), dbOptions);
    });

    it("should properly finish queries on calling close", function() {
        pool.connect();
        var i;
        var ps = [];
        for(i=0; i<4; ++i) {
            ps.push(pool.query("SELECT 42"));
        }

        pool.close();

        return Q.all(ps).then(function() {
            pool.getConnections().map(function(d) { return d.getState(); })
                .should.deep.equal(["destroyed", "destroyed", "destroyed", "destroyed"]);
        });
    });

    it("should properly fail queries on calling destroy", function() {
        pool.connect();
        var ps = [];
        var i;
        for(i=0; i<4; ++i) {
            ps.push(pool.query("SELECT 42").should.be.rejected);
        }

        pool.destroy();

        return Q.all(ps).then(function() {
            pool.getConnections().map(function(d) { return d.getState(); })
                .should.deep.equal(["destroyed", "destroyed", "destroyed", "destroyed"]);
        });
    });
});
