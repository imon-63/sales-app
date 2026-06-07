'use strict';
const { EventEmitter } = require('events');

const notificationEvents = new EventEmitter();
const NOTIFICATION_CREATED_TOPIC = 'NOTIFICATION_CREATED';

function createTopicAsyncIterator(eventName) {
  const pullQueue = [];
  const pushQueue = [];
  let listening = true;
  const pushValue = (value) => {
    if (pullQueue.length > 0) { pullQueue.shift()({ value, done: false }); return; }
    pushQueue.push(value);
  };
  const eventHandler = (value) => { if (listening) pushValue(value); };
  notificationEvents.on(eventName, eventHandler);
  return {
    next() {
      if (!listening) return Promise.resolve({ value: undefined, done: true });
      if (pushQueue.length > 0) return Promise.resolve({ value: pushQueue.shift(), done: false });
      return new Promise(resolve => pullQueue.push(resolve));
    },
    return() { listening = false; notificationEvents.off(eventName, eventHandler); return Promise.resolve({ value: undefined, done: true }); },
    throw(error) { listening = false; notificationEvents.off(eventName, eventHandler); return Promise.reject(error); },
    [Symbol.asyncIterator]() { return this; },
  };
}

module.exports = { notificationEvents, NOTIFICATION_CREATED_TOPIC, createTopicAsyncIterator };
