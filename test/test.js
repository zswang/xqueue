const redis = require('redis')
const fs = require('fs')
const assert = require('should')
const xqueue = require('../')

describe('base', () => {
  let redisClient = redis.createClient(process.env.REDIS_CONNECT_TEST)
  let emitter = new xqueue.Emitter({
    redisClient: redisClient,
  })
  let type = 'test'
  let encoding = 'log'

  let instance = emitter.on(type, encoding, () => { })
  it('listener exists', (done) => {
    redisClient.exists(`xqueue:emitter:listener:${type}`, (err, result) => {
      assert.equal(result, 1)
      done(err)
    })
  })

  it('listener encoding exists', (done) => {
    redisClient.sismember(`xqueue:emitter:listener:${type}`, encoding, (err, result) => {
      assert.equal(result, 1)
      done(err)
    })
  })

  it('listener encoding ttl', (done) => {
    redisClient.ttl(`xqueue:emitter:encoding:${type}:${encoding}:ttl`, (err, result) => {
      assert.equal(result > 3000, true)
      done(err)
    })
  })

  it('instance.stop()', () => {
    instance.stop()
    instance.stop()
    assert.equal(instance.freed, true)
  })
})

describe('emit', () => {
  let redisClient = redis.createClient(process.env.REDIS_CONNECT_TEST)

  let emitter = new xqueue.Emitter({
    redisConnect: process.env.REDIS_CONNECT_TEST,
    debug: true,
  })
  let type = 'test'
  let encoding = 'log'

  it('list exists', (done) => {
    Promise.all([
      emitter.emit(type, {
        msg: 'hello1'
      }),
      emitter.emit(type, {
        msg: 'hello2'
      }),
      emitter.emit(type, {
        msg: 'hello3'
      })
    ]).then(() => {
      redisClient.lrange(`xqueue:emitter:encoding:${type}:${encoding}`, 0, -1, (err, result) => {
        assert.equal(JSON.stringify(result), '["{\\"msg\\":\\"hello1\\"}","{\\"msg\\":\\"hello2\\"}","{\\"msg\\":\\"hello3\\"}"]')
        done(err)
      })
    })
  })

  it('on hello1', (done) => {
    let instance = emitter.on(type, encoding, (reply) => {
      assert.equal(reply.msg, 'hello1')
      instance.stop()
      done(null)
    })
  })
  it('on hello2', (done) => {
    let instance = emitter.on(type, encoding, (reply) => {
      assert.equal(reply.msg, 'hello2')
      instance.stop()
      done(null)
    })
  })
  it('on hello3', (done) => {
    let instance = emitter.on(type, encoding, (reply) => {
      assert.equal(reply.msg, 'hello3')
      instance.stop()
      done(null)
    })
  })
})

describe('dataType is string', () => {
  let redisClient = redis.createClient(process.env.REDIS_CONNECT_TEST)

  let emitter = new xqueue.Emitter({
    redisClient: redisClient,
    dataType: 'string'
  })
  let type = 'test_buffer'
  let encoding = 'log'

  it('listener exists', (done) => {
    let instance = emitter.on(type, encoding, (reply) => {
      assert.equal(reply, 'hello3')
      done(null)
    })
    emitter.emit(type, 'hello3')
  })
})
