/*jslint node: true */
"use strict";

var clone = function(obj) {
    var result = {};
    for (var i in obj) {
        result[i] = obj[i];
    }
    return result;
};

function Radiopaque() {
    this.m_channel = null;
    this.m_audience = null;

    // simplifies cloning keeping the pointers
    this.q = {
        dt: 0,
        currentTime: 0,
        latestTime: 0,
    };

    this.messages = [];
    this.audiences = [];
    this.channels = {};
    this.subscribers = {};
    this.audienceSubscribers = {};
}

var _p = Radiopaque.prototype;

////////////////////////////////
///  EVENT DISPATCHING
////////////////////////////////

_p.subscribe = function(callback) {
    if (this.m_channel === null) {
        throw new Error('cannot subscribe without channel modifier');
    }

    if (this.subscribers[this.m_channel] === undefined){
        this.subscribers[this.m_channel] = [];
    }
    this.subscribers[this.m_channel].push(callback);

    if (this.m_audience !== null) {
        if (this.audienceSubscribers[this.m_audience] === undefined) {
            this.audienceSubscribers[this.m_audience] = [];
        }
        var audienceSubscribers = this.audienceSubscribers[this.m_audience];

        if (audienceSubscribers[this.m_channel] === undefined){
            audienceSubscribers[this.m_channel] = [];
        }
        audienceSubscribers[this.m_channel].push(callback);
    }

    return this;
};

_p.broadcast = function(payload) {
    if (this.m_channel === null) {
        throw new Error('cannot broadcast without channel modifier');
    }

    if (this.subscribers[this.m_channel] !== undefined){
        var subscribers = this.subscribers[this.m_channel];
        for (var i = 0, len = subscribers.length; i < len; i++){
            subscribers[i].call(this, payload);
        }
    }
};

_p.e_unsubscribe = function(callback){
    if (this.m_channel === null) {
        throw new Error('cannot subscribe without channel modifier');
    }
    if (this.subscribers[this.m_channel] instanceof Array){
        var subscribers = this.subscribers[this.m_channel],
            index = subscribers.indexOf(callback);
        if (~index) {
            subscribers.splice(index, 1);
        }
    }
};

_p.unsubscribe = function(callback){
    this.e_unsubscribe(callback);
    for (var i in this.audienceSubscribers) {
        var channelSubscribers = this.audienceSubscribers[this.m_channel];
        if (channelSubscribers) {
            var index = channelSubscribers.indexOf(callback);
            if (~index) {
                channelSubscribers.splice(index, 1);
            }
        }
    }
    return this;
};

_p.unsubscribeAll = function() {
    if (this.m_audience === null) {
        throw new Error('cannot unsubscribeAll without audience modifier');
    }

    // remove link to let garbadge collector to clean up the audience
    this.audiences[this.m_audience] = null;

    var audienceSubscribers = this.audienceSubscribers[this.m_audience];
    if (audienceSubscribers) {
        for (var channel in audienceSubscribers) {
            var channelO = this.channel(channel);
            for (var i = 0; i < audienceSubscribers[channel].length; i++) {
                channelO.e_unsubscribe(audienceSubscribers[channel][i]);
            }
        }
        this.audienceSubscribers[this.m_audience] = {};
    }
};

_p.prepare = function(filler, template) {
    return new PreparedBroadcast(this, filler, template);
};

////////////////////////////////
///  OBJECT MAPPER
////////////////////////////////

_p.subscribeObject = function(obj, channels) {
    for (var i = 0; i < channels.length; i++) {
        var channel = channels[i],
            method = "on" + channel[0].toUpperCase() + channel.substring(1);
        if (typeof obj[method] != "function") {
            throw new Error("cannot map channel " + channel + ", missing method " + method);
        }
        this.channel(channel).subscribe(obj[method].bind(obj));
    }
};

////////////////////////////////
///  SCHEDULING QUEUE
////////////////////////////////

_p.q_findIndex = function(time) {
    for (var i = 0; i < this.messages.length; i++) {
        if (this.messages[i][0] > time) {
            return i;
        }
    }
    return null;
};

_p.pushAt = function(time, payload) {
    var message = [time, payload];

    // take advantage of faster push/unshift of V8
    if (time >= this.q.latestTime || !this.messages.length) {
        this.q.latestTime = time;
        this.messages.push(message);
    } else if (this.messages[0][0] > time) {
        this.messages.unshift(message);
    } else {
        var i = this.q_findIndex(time);
        this.messages.splice(i, 0, message); // oh god, i'm soooo slow
    }
    return this;
};

_p.pushIn = function(dt, payload) {
    return this.pushAt(this.q.currentTime + dt, payload);
};

_p.fetchAt = function(time) {
    if (!this.messages.length) return null;
    if (this.messages[0][0] <= time) {
        return this.messages.shift()[1];
    }
    return null;
};

_p.fetch = function(payload) {
    return this.fetchAt(this.q.currentTime);
};

/**
 * can be optimized when etire queue is fetched,
 * but why add complexity?
 *
 * NO BIG SPLICE! see - http://jsperf.com/multiple-shift-vs-single-splice/4
 */
_p.fetchAllAt = function(time) {
    var message,
        result = [];

    while (true) {
        message = this.fetchAt(time);
        if (message === null) {
            break;
        } else {
            result.push(message);
        }
    }
    return result;
};

_p.fetchAll = function(time) {
    return this.fetchAllAt(this.q.currentTime);
};

////////////////////////////////
///  EVENT SCHEDULER
////////////////////////////////

_p.broadcastAt = function(time, payload) {
    if (this.m_channel === null) {
        throw new Error('cannot broadcast without channel modifier');
    }
    this.pushAt(time, [this.m_channel, payload]);
    return this;
};

_p.broadcastIn = function(dt, payload) {
    return this.broadcastAt(this.q.currentTime + dt, payload);
};

_p.run = function() {
    while (true) {
        var message = this.fetch();
        if (!message) {
            break;
        }
        if (typeof message == 'function') {
            message();
        } else {
            this.channel(message[0]).broadcast(message[1]);
        }
    }
};

////////////////////////////////
///  MODIFIERS
////////////////////////////////

_p.channel = function(channel) {
    return this.channelAndAudience(channel, this.m_audience);
};

_p.audience = function(audience) {
    var audienceIndex = this.audiences.indexOf(audience);
    if (this.audiences.indexOf(audience) == -1) {
        this.audiences.push(audience);
        audienceIndex = this.audiences.length - 1;
    }
    return this.channelAndAudience(this.m_channel, audienceIndex);
};

_p.channelAndAudience = function(channel, audience) {
    var key = channel || "";
    if (audience !== undefined) {
        key += ":" + audience;
    }
    if (!this.channels[key]) {
        var o = clone(this);
        o.m_channel = channel;
        o.m_audience = (audience === undefined) ? null : audience;
        this.channels[key] = o;
    }
    return this.channels[key];
};

// non-cloning! setTime is global
_p.timeAt = function(time) {
    this.q.currentTime = time;
    return this;
};

_p.timeIn = function(dt) {
    this.q.dt = dt;
    this.q.currentTime += dt;
    return this;
};

////////////////////////////////
///  PREPARED EVENTS
////////////////////////////////


function PreparedBroadcast(r, filler, template) {
    this.r = r;
    this.filler = filler;
    this.template = template || {};
}

PreparedBroadcast.prototype.execute = function() {
    this.filler(this.template, arguments);
    return this.r.broadcast(this.template);
};

PreparedBroadcast.prototype.executeAt = function() {
    var event = clone(this.template),
        j = 1;
    for (var i in event) {
        event[i] = arguments[j++];
    }
    this.r.broadcastAt(arguments[0], event);
    return this;
};

PreparedBroadcast.prototype.executeIn = function() {
    arguments[0] = this.r.q.currentTime + arguments[0];
    return this.executeAt.apply(this, arguments);
};

/**
 * fluent factory-medthod: require('radiopaque').create().audience('some')...
 * @return {Radiopaque}
 */
Radiopaque.create = function() {
    return new Radiopaque();
};

module.exports = Radiopaque;
