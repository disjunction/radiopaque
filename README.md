[![build status](https://api.travis-ci.org/disjunction/radiopaque.png)](https://travis-ci.org/disjunction/radiopaque)

Radiopoaque is a dependency-free combination of event dispatcher, event scheduler and a scheduling queue
in one object without persistence. It is inspired by fluent interface of radio.js

It compromises single responsibility principle,
but provides a very simple and fast implementation, optimized for v8.

Radiopaque was initially developed as helper for "dispace" - online multiplayer JS game.

## Examples

### Event Dispatcher

```javascript
function mySubscriber(data) {
    console.log(data.x, data.y);
}

var r = new Radiopaque();

r.channel('mouseMove').subscribe(mySubscriber);

var mouseMoveChannel = r.channel('mouseMove');
for (var i = 0; i < 10; i++) {
    mouseMoveChannel.broadcast({
        x: 5, y: 120
    });
}

mouseMoveChannel.unsubscribe(mySubscriber);
```

### Prepared events

Prepared events let you avoid creating a new object for each event,
decreasing the heapUsed, but increasing the CPU load.
It cannot be used if the same event is fired during processing of a template
(e.g. if mouseMove firing another mouseMove inside of mySubscriber)

The **prepare()** method takes a filler closure as a parameter,
which fills the template event with arbitrary arguments. A second optional parameter specifies the initial template. By default it's just `= {}`

```javascript
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
```

### Audiences

Audiences allow groupping of subscribers, thus simplifying unsubscribe.
The following example shows how an object subscribes and unsubscribes itself.

```javascript
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
```
### Subscribe Object

Because subscribing methods to events with corresponding name
is such a typical task, there is a helper simplifying the subscription.
Note, the listeres are automatically bound to the object.
Here is an alternative way of subscribing for the example obove:

```javascript
this.audience = r.audience(this);
this.audience.subscribeObject(this, ['first', 'second']);
```

Here **subscribeObject()** assumes that the listeners are called **onFirst** and **onSecond**.

### Event Scheduling

Sometimes you want to defer firing an event. In common case **setTimeout** would suffice, but if you want to get full control over the scheduled events  or use your own time , then you can use **broadcastAt** and **broadcastIn** events.

Sometimes, you want to mix event firing and arbitrary code execution. To schedule just any function, use **pushAt** and **pushIn** functions.

```javascript
var channel = (new Radiopaque()).channel('someEvent');
channel.subscribe(function(data) {
    console.log(data);
});

// set initial time
channel.timeAt(100500);

// schedule broadcasting of someEvent in 100 time points
channel.broadcastIn(100, "hello world");

// schedule some code to be fired
channel.pushIn(40, function() {
    console.log('some code fired');
})

channel.run(); // nothing happens

// advance current time point 50 time points ahead
channel.timeIn(50);

channel.run(); // "some code fired", but not the event yet

// advance current time point 50 time points ahead
channel.timeIn(50);

channel.run(); // "hello world" gets fired!!!
```

This concept was developed to make the event driven model 100% predictable in box2d phisical simulation, where it is recommended to quantify the timesteps. So the events are following the same quantification and are fired e.g. in exactly 10 simulation steps.

Radiopaque object uses one variable to hold current time point, and it affects all of the channels. This should be the desired behavior in most of the cases. Yet, if you find it inconvenient, you may just use multiple radiopaque objects.

### Scheduling Queue

Radiopaque also provides a usual scheduling queue. It is used for event scheduling, but you're free to use it for your needs.


```javascript
var r = new Radiopaque();
r.timeAt(10000);

r.pushIn(10, "message1")
 .pushIn(20, "message2")
 .pushIn(25, "message3");

r.timeIn(5).timeIn(5);
console.log(r.fetch()); // returns "message1"

r.timeIn(30);
console.log(r.fetchAll()); // returns ["message2", "message3"]
```

My intention was to make a job queue, which can be processed between the simulation steps without an impact on FPS. So even if by a conincidence there are multiple jobs scheduled for a given moment, it is still possible to fetch and process just a couple of them, and do the rest on the next simulation step.
