/*jslint node: true */
"use strict";

var Radiopaque = require("../src/radiopaque");

function example1() {
    function mySubscriber(data) {
        console.log(data.x, data.y);
    }

    var r = new Radiopaque();

    r.channel('mouseMove').subscribe(mySubscriber);

    var mouseMoveChannel = r.channel('mouseMove');
    for (var i = 0; i < 10; i++) {
        mouseMoveChannel.broadcast({
            x: Math.random() * 100,
            y: Math.random() * 100
        });
    }

    mouseMoveChannel.unsubscribe(mySubscriber);
}

function example2() {
    var r = new Radiopaque();
    r.channel('mouseMove').subscribe(function(data) {
        console.log(data.x, data.y);
    });

    var prepared = r.channel('mouseMove').prepare(function(template, args) {
        template.x = args[0];
        template.y = args[1];
    }, {x: null, y: null, z: 120});

    for (var i = 0; i < 10; i++) {
        prepared.execute(Math.random() * 100, Math.random() * 100);
    }
}

function example3() {
    var r = new Radiopaque();

    function MyClass(r) {
        this.onFirst = function(data) {
            console.log('first called');
        };

        this.onSecond = function(data) {
            console.log('second called');
        };

        this.unsubscribe = function() {
            this.audience.unsubscribeAll();
        };

        this.audience = r.audience(this);
        this.audience.channel('first').subscribe(this.onFirst.bind(this));
        this.audience.channel('second').subscribe(this.onSecond.bind(this));
    }

    var obj = new MyClass(r);
    r.channel('first').broadcast();
    r.channel('second').broadcast();
    obj.unsubscribe();
}

function example4() {
    var channel = (new Radiopaque()).channel('someEvent');
    channel.subscribe(function(data) {
        console.log(data);
    });

    // set initial time
    channel.timeAt(100500);

    // schedule broadcasting of someEvent in 100 time points
    channel.broadcastIn(100, "hello world");
    channel.pushIn(40, function() {
        console.log('some code fired');
    });

    channel.run(); // nothing happens

    // advance current time point 50 time points ahead
    channel.timeIn(50);

    channel.run(); // "some code fired", but not the event yet

    // advance current time point 50 time points ahead
    channel.timeIn(50);

    channel.run(); // "hello world" gets fired!!!
}

function example5() {
    var r = new Radiopaque();
    r.timeAt(10000);

    r.pushIn(10, "message1");
    r.pushIn(20, "message2");
    r.pushIn(25, "message3");

    r.timeIn(5).timeIn(5);
    console.log(r.fetch()); // returns "message1"

    r.timeIn(30);
    console.log(r.fetchAll()); // returns ["message2", "message3"]
}

