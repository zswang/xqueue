# xqueue

Emitter at Redis queue

[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][coverage-image]][coverage-url]

## xqueue:emitter:listener:${type}

* emit(type, data)

```redis
SMEMBERS xqueue:emitter:listener:${type}
RPUSHX xqueue:emitter:encoding:${type}:${encoding}
SREM xqueue:emitter:encoding:${type}:${encoding}
```

* on(type, encoding, fn)

```redis
RPUSH xqueue:emitter:encoding:${type}:${encoding} :nil
EXPIRE xqueue:emitter:encoding:${type}:${encoding} ${expire}
SADD xqueue:emitter:listener:${type} ${encoding}

while (true) {
  LPOP xqueue:emitter:encoding:${type}:${encoding}
  sleep()
}
```


## License

MIT © [zswang](http://weibo.com/zswang)

[npm-url]: https://badge.fury.io/js/xqueue
[npm-image]: https://badge.fury.io/js/xqueue.svg
[travis-url]: https://travis-ci.org/zswang/xqueue
[travis-image]: https://travis-ci.org/zswang/xqueue.svg?branch=master
[coverage-url]: https://coveralls.io/github/zswang/xqueue?branch=master
[coverage-image]: https://coveralls.io/repos/zswang/xqueue/badge.svg?branch=master&service=github