/*jslint node: true, jasmine: true */
"use strict";

var Radiopaque = require('../src/radiopaque'),
    _describe = function(){};

describe("Radiopaque", function() {
    it("can be created", function() {
        var o = new Radiopaque();
    });

    describe("events", function() {
        it("support basic event dispatching", function(done) {
            var callback = function(data) {
                expect(data).toBe('hello world');
                done();
            };
            var callbackBad = function(data) {
                throw new Error('should not be fired');
            };

            var r = new Radiopaque();
            var c1 = r.channel('xxx');
            c1.subscribe(callback).subscribe(callbackBad);

            var c2 = r.channel('xxx');
            c2.unsubscribe(callbackBad);
            c2.broadcast('hello world');
        });

        it('empty payload works', function(done) {
            var callback = function(data) {
                expect(data).toBe(undefined);
                done();
            };
            var r = new Radiopaque();
            r.channel('xyz').subscribe(callback).broadcast();
        });


        it('supports audiences', function(done) {
            var aud1 = {a: 1},
                aud2 = {b: 2};

            var callbackGood = function(data) {
                done();
            };
            var callbackBad = function(data) {
                throw new Error("should not be fired");
            };

            var r = new Radiopaque();
            var c1 = r.audience(aud1).channel("xxx");
            c1.subscribe(callbackBad);

            // this will be ignored
            c1.audience("some other").channel("yyy").subscribe(callbackBad);

            var c2 = r.audience(aud2).channel("xxx");
            c2.subscribe(callbackGood);

            r.audience("unknown audience").unsubscribeAll();

            r.audience(aud1).unsubscribeAll();

            c2.broadcast("hello world");

            // make sure double unsubscribe is not causeing troubles
            r.audience(aud1).unsubscribeAll();
        });

        it("prepared broadcasts", function(done) {
            var r = new Radiopaque(),
                c = r.channel('application');

            function callback1(event) {
                expect(event).toEqual({
                    gender: "m",
                    age: 17,
                    name: "Vasiliy"
                });
            }

            function callback2(event) {
                expect(event).toEqual({
                    gender: "f",
                    age: 15,
                    name: "Maria"
                });
                done();
            }

            c.subscribe(callback1);

            var event = c.prepare(function(template, args){
                template.name = args[0];
                template.gender = args[1];
                template.age = args[2];
            });

            event.execute("Vasiliy", "m", 17);

            c.unsubscribe(callback1)
             .subscribe(callback2);

            event.executeIn(5, "Maria", "f", 15);

            c.timeIn(6).run();
        });

        it("check: subscribeObject()", function(done) {
            function MyClass(r) {
                this.onFirst = function(data) {
                    done();
                };

                r.subscribeObject(this, ['first']);
            }
            var r = new Radiopaque(),
                o = new MyClass(r);
            r.channel('first').broadcast();
        });
    });

    describe("scheduling queue", function() {
        it("basic pushAt and fetchAt", function() {
            var r = new Radiopaque();
            r.pushAt(10, "banana");
            expect(r.fetchAt(15)).toBe("banana");
        });

        it('returns messages in the right order', function(){
            var r = new Radiopaque();
            r.pushAt(5, "apple");
            r.pushAt(7, "banana");
            r.pushAt(1, "orange");
            r.pushAt(3, "tomato");

            expect(r.fetchAt(10)).toBe("orange");
            expect(r.fetchAt(10)).toBe("tomato");
            expect(r.fetchAt(10)).toBe("apple");
            expect(r.fetchAt(10)).toBe("banana");
        });

        it('returns null when empty or no matches', function(){
            var r = new Radiopaque();
            r.pushAt(5, "apple");
            r.pushAt(7, "banana");

            expect(r.fetchAt(1)).toBeNull();
            expect(r.fetchAt(10)).not.toBeNull();
            expect(r.fetchAt(10)).not.toBeNull();
            expect(r.fetchAt(10)).toBeNull();
        });

        it('check: fetchAllAt() and fetchAll()', function(){
            var r = new Radiopaque();
            r.pushAt(5, "apple");
            r.pushAt(7, "banana");
            r.pushAt(1, "orange");
            r.pushAt(3, "tomato");

            expect(r.fetchAllAt(4)).toEqual(
                ["orange", "tomato"]
            );

            expect(r.timeAt(10).fetchAll()).toEqual(
                ["apple", "banana"]
            );
        });
    });

    describe('event scheduling', function() {
        it('basic broadcastAt/In and run', function() {
            var r = new Radiopaque(),
                test = "?";

            r.timeAt(100500);

            r.channel("apple").broadcastIn(5);
            r.channel("banana").broadcastAt(100510);

            r.channel("banana").subscribe(function() {
                test = "yello";
            });
            r.channel("apple").subscribe(function() {
                test = "red";
            });

            r.timeIn(3).run();
            expect(test).toBe("?");
            r.timeIn(3).run();
            expect(test).toBe("red");
            r.timeIn(3).run();
            expect(test).toBe("red");
            r.timeIn(3).run();
            expect(test).toBe("yello");
        });
    });

    describe('function scheduling', function() {
        it('basic broadcastAt/In and run', function() {
            var r = new Radiopaque(),
                test = "?";

            r.timeAt(100500);

            r.pushAt(100510, function() {
                test = "yello";
            });
            r.pushIn(5, function() {
                test = "red";
            });

            r.timeIn(3).run();
            expect(test).toBe("?");
            r.timeIn(3).run();
            expect(test).toBe("red");
            r.timeIn(3).run();
            expect(test).toBe("red");
            r.timeIn(3).run();
            expect(test).toBe("yello");
        });
    });
});
