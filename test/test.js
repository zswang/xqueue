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

  let instance = emitter.on(type, encoding, () => {})
  it('listener exists', done => {
    redisClient.exists(`xqueue:emitter:listener:${type}`, (err, result) => {
      assert.equal(result, 1)
      done(err)
    })
  })

  it('listener encoding exists', done => {
    redisClient.sismember(
      `xqueue:emitter:listener:${type}`,
      encoding,
      (err, result) => {
        assert.equal(result, 1)
        done(err)
      }
    )
  })

  it('listener encoding ttl', done => {
    redisClient.ttl(
      `xqueue:emitter:encoding:${type}:${encoding}:ttl`,
      (err, result) => {
        assert.equal(result > 3000, true)
        done(err)
      }
    )
  })

  it('instance.stop()', () => {
    instance.stop()
    instance.stop()
    assert.equal(instance.freed, true)
  })

  it('end', () => {
    emitter.end()
  })
})

describe('emit', () => {
  let redisClient = redis.createClient(process.env.REDIS_CONNECT_TEST)
  let emitter = new xqueue.Emitter({
    redisClient: process.env.REDIS_CONNECT_TEST,
    debug: true,
  })
  let type = 'test'
  let encoding = 'log'

  it('list exists', done => {
    Promise.all([
      emitter.emit(type, {
        msg: 'hello1',
      }),
      emitter.emit(type, {
        msg: 'hello2',
      }),
      emitter.emit(type, {
        msg: 'hello3',
      }),
    ]).then(() => {
      redisClient.lrange(
        `xqueue:emitter:encoding:${type}:${encoding}`,
        0,
        -1,
        (err, result) => {
          assert.equal(
            JSON.stringify(result),
            '["{\\"msg\\":\\"hello1\\"}","{\\"msg\\":\\"hello2\\"}","{\\"msg\\":\\"hello3\\"}"]'
          )
          done(err)
        }
      )
    })
  })

  it('on hello1', done => {
    let instance = emitter.on(type, encoding, reply => {
      assert.equal(reply.msg, 'hello1')
      instance.stop()
      done(null)
    })
  })
  it('on hello2', done => {
    let instance = emitter.on(type, encoding, reply => {
      assert.equal(reply.msg, 'hello2')
      instance.stop()
      done(null)
    })
  })
  it('on hello3', done => {
    let instance = emitter.on(type, encoding, reply => {
      assert.equal(reply.msg, 'hello3')
      instance.stop()
      done(null)
    })
  })
  it('end', () => {
    emitter.end()
  })
})

describe('dataType is string', () => {
  let redisClient = redis.createClient(process.env.REDIS_CONNECT_TEST)

  let emitter = new xqueue.Emitter({
    redisClient: redisClient,
    dataType: 'string',
  })
  let type = 'test_buffer'
  let encoding = 'log'

  it('listener exists', done => {
    let instance = emitter.on(type, encoding, reply => {
      assert.equal(reply, 'hello3')
      done(null)
    })
    emitter.emit(type, 'hello3')
  })
})

describe('coverage', () => {
  it('smembers error', done => {
    let redisClient = {
      smembers(key, callback) {
        callback('smembers error')
      },
    }

    new xqueue.Emitter({
      redisClient: redisClient,
    })
      .emit('error', 'error')
      .catch(err => {
        assert.equal(err, 'smembers error')
      })

    new xqueue.Emitter({
      redisClient: redisClient,
      debug: true,
    })
      .emit('error', 'error')
      .catch(err => {
        assert.equal(err, 'smembers error')
        done(null)
      })
  })

  it('exists error', done => {
    let redisClient = {
      smembers(key, callback) {
        callback(null, ['process'])
      },
      exists(key, callback) {
        callback('exists error')
      },
    }

    new xqueue.Emitter({
      redisClient: redisClient,
    })
      .emit('error', 'error')
      .catch(err => {
        assert.equal(err, 'exists error')
      })

    new xqueue.Emitter({
      redisClient: redisClient,
      debug: true,
    })
      .emit('error', 'error')
      .catch(err => {
        assert.equal(err, 'exists error')
        done(null)
      })
  })

  it('exists result is 0', done => {
    let redisClient = {
      smembers(key, callback) {
        callback(null, ['process'])
      },
      exists(key, callback) {
        callback(null, 0)
      },
      srem(key, field, callback) {
        assert.equal(key, 'xqueue:emitter:listener:error')
        assert.equal(field, 'process')
        callback(null)
      },
    }

    new xqueue.Emitter({
      redisClient: redisClient,
      debug: true,
    })
      .emit('error', 'error')
      .then(() => {
        done(null)
      })
  })

  it('srem error', done => {
    let redisClient = {
      smembers(key, callback) {
        callback(null, ['process'])
      },
      exists(key, callback) {
        callback(null, 0)
      },
      srem(key, field, callback) {
        callback('srem error')
      },
    }

    new xqueue.Emitter({
      redisClient: redisClient,
    })
      .emit('error', 'error')
      .catch(err => {
        assert.equal(err, 'srem error')
      })

    new xqueue.Emitter({
      redisClient: redisClient,
      debug: true,
    })
      .emit('error', 'error')
      .catch(err => {
        assert.equal(err, 'srem error')
        done(null)
      })
  })

  it('rpush error', done => {
    let redisClient = {
      smembers(key, callback) {
        callback(null, ['process'])
      },
      exists(key, callback) {
        callback(null, 1)
      },
      rpush(key, value, callback) {
        callback('rpush error')
      },
    }

    new xqueue.Emitter({
      redisClient: redisClient,
    })
      .emit('error', 'value')
      .catch(err => {
        assert.equal(err, 'rpush error')
      })

    new xqueue.Emitter({
      redisClient: redisClient,
      debug: true,
    })
      .emit('error', 'error')
      .catch(err => {
        assert.equal(err, 'rpush error')
        done(null)
      })
  })

  it('lpop error', done => {
    let redisClient = {
      setex(key, expire, callback) {
        assert.equal(expire, 3600)
      },
      sadd(key, field) {
        assert.equal('xqueue:emitter:listener:error', key)
        assert.equal('process', field)
      },
      lpop(key, callback) {
        callback('lpop error')
      },
    }

    new xqueue.Emitter({
      redisClient: redisClient,
      debug: true,
    }).on('error', 'process', () => {})

    new xqueue.Emitter({
      redisClient: redisClient,
    }).on('error', 'process', () => {})

    setTimeout(done, 1000)
  })
})
