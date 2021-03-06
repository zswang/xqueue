"use strict";
/* istanbul ignore next */
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var redis = require("redis");
var Emitter = /** @class */ (function () {
    function Emitter(options) {
        /**
         * 处理队列
         */
        this.emitQueue = [];
        this.emitting = false;
        this.options = __assign({ prefix: 'xqueue:emitter', sleep: 1, expire: 60 * 60, debug: false, dataType: 'json' }, options);
        if (typeof options.redisClient === 'string') {
            this.redisClient = redis.createClient(options.redisClient);
        }
        else {
            this.redisClient = options.redisClient;
        }
    }
    /**
     * 派发事件
     *
     * @param type 事件类型
     * @param data 数据
     */
    Emitter.prototype.emit = function (type, data) {
        var _this = this;
        if (this.options.debug) {
            console.log('xqueue/src/index.ts:110 emit %s - %j', type, data);
        }
        // 队列发送中
        if (this.emitting) {
            return new Promise(function (resolve, reject) {
                _this.emitQueue.push({
                    type: type,
                    data: data,
                    resolve: resolve,
                    reject: reject,
                });
            });
        }
        var next = function () {
            _this.emitting = false;
            var item = _this.emitQueue.shift();
            if (item) {
                _this.emit(item.type, item.data)
                    .then(function (reply) {
                    item.resolve(reply);
                    next();
                })
                    .catch(function (err) {
                    item.reject(err);
                    next();
                });
            }
        };
        //标记发送中
        this.emitting = true;
        return new Promise(function (resolve, reject) {
            // 获取该类型监听类型列表
            _this.redisClient.smembers(_this.options.prefix + ":listener:" + type, function (err, results) {
                if (err) {
                    if (_this.options.debug) {
                        console.error('xqueue/src/index.ts:150', err);
                    }
                    reject(err);
                    next();
                    return;
                }
                resolve(Promise.all(results.map(function (encoding) {
                    return new Promise(function (resolve, reject) {
                        _this.redisClient.exists(_this.options.prefix + ":encoding:" + type + ":" + encoding + ":ttl", function (err, result) {
                            if (err) {
                                if (_this.options.debug) {
                                    console.error('xqueue/src/index.ts:164', err);
                                }
                                reject(err);
                                next();
                                return;
                            }
                            if (result === 0) {
                                // 移除失效的成员
                                _this.redisClient.srem(_this.options.prefix + ":listener:" + type, "" + encoding, function (err) {
                                    if (err) {
                                        if (_this.options.debug) {
                                            console.error('xqueue/src/index.ts:178', err);
                                        }
                                        reject(err);
                                        next();
                                        return;
                                    }
                                    resolve({
                                        command: 'srem',
                                        encoding: encoding,
                                        result: result,
                                    });
                                });
                                return;
                            }
                            var content = _this.options.dataType === 'json'
                                ? JSON.stringify(data)
                                : String(data);
                            _this.redisClient.rpush(_this.options.prefix + ":encoding:" + type + ":" + encoding, content, function (err, result) {
                                if (err) {
                                    if (_this.options.debug) {
                                        console.error('xqueue/src/index.ts:203', err);
                                    }
                                    reject(err);
                                    next();
                                    return;
                                }
                                resolve({
                                    command: 'rpush',
                                    encoding: encoding,
                                    result: result,
                                });
                            });
                        });
                    });
                })).then(function (reply) {
                    next();
                    return reply;
                }));
            });
        });
    };
    /**
     * 接收事件
     *
     * @param type 事件类型
     * @param encoding 处理类型
     * @param fn 回调函数
     */
    Emitter.prototype.on = function (type, encoding, fn) {
        var _this = this;
        var lastExpire = Date.now();
        this.redisClient.setex(this.options.prefix + ":encoding:" + type + ":" + encoding + ":ttl", this.options.expire, ':nil');
        this.redisClient.sadd(this.options.prefix + ":listener:" + type, "" + encoding);
        var timer;
        var freed = false;
        var next = function () {
            if (freed) {
                return;
            }
            var now = Date.now();
            if (now - lastExpire > _this.options.expire * 1000 * 0.75) {
                _this.redisClient.setex(_this.options.prefix + ":encoding:" + type + ":" + encoding + ":ttl", _this.options.expire, ':nil');
                lastExpire = now;
            }
            _this.redisClient.lpop(_this.options.prefix + ":encoding:" + type + ":" + encoding, function (err, result) {
                if (err) {
                    if (_this.options.debug) {
                        console.error('xqueue/src/index.ts:269', err);
                    }
                    timer = setTimeout(next, _this.options.sleep * 1000 * 5);
                    return;
                }
                if (result === null || result === undefined) {
                    timer = setTimeout(next, _this.options.sleep * 1000);
                    return;
                }
                if (_this.options.debug) {
                    console.log('xqueue/src/index.ts:279 lpop %j', result);
                }
                var content;
                try {
                    content =
                        _this.options.dataType === 'json'
                            ? JSON.parse(result)
                            : String(result);
                }
                catch (ex) {
                    setTimeout(next, _this.options.sleep * 1000);
                    if (_this.options.debug) {
                        console.log('xqueue/src/index.ts:290', ex);
                    }
                    return;
                }
                if (fn.length >= 2) {
                    fn(content, function (success) {
                        if (success) {
                            next();
                        }
                        else {
                            setTimeout(next, _this.options.sleep * 1000);
                        }
                    });
                }
                else {
                    fn(content);
                    next();
                }
            });
        };
        timer = setTimeout(next, this.options.sleep * 1000);
        var instance = {
            get freed() {
                return freed;
            },
            stop: function () {
                if (freed) {
                    return;
                }
                freed = true;
                clearTimeout(timer);
            },
        };
        return instance;
    };
    /**
     * 断开数据库连接
     * @param flush
     */
    Emitter.prototype.end = function (flush) {
        if (typeof this.options.redisClient === 'string') {
            this.redisClient.end(flush);
        }
    };
    Emitter.prototype.describe = function (type) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            // 获取该类型监听类型列表
            _this.redisClient.smembers(_this.options.prefix + ":listener:" + type, function (err, results) {
                if (err) {
                    reject(err);
                    if (_this.options.debug) {
                        console.error('xqueue/src/index.ts:345', err);
                    }
                    return;
                }
                resolve(Promise.all(results
                    .map(function (encoding) {
                    return new Promise(function (resolve, reject) {
                        _this.redisClient.ttl(_this.options.prefix + ":encoding:" + type + ":" + encoding + ":ttl", function (err, reply) {
                            if (err) {
                                if (_this.options.debug) {
                                    console.error('xqueue/src/index.ts:359', err);
                                }
                                reject(err);
                                return;
                            }
                            resolve((_a = {},
                                _a[_this.options.prefix + ":encoding:" + type + ":" + encoding + ":ttl"] = reply,
                                _a));
                            var _a;
                        });
                    });
                })
                    .concat(results.map(function (encoding) {
                    return new Promise(function (resolve, reject) {
                        _this.redisClient.llen(_this.options.prefix + ":encoding:" + type + ":" + encoding, function (err, reply) {
                            if (err) {
                                if (_this.options.debug) {
                                    console.error('xqueue/src/index.ts:381', err);
                                }
                                reject(err);
                                return;
                            }
                            resolve((_a = {},
                                _a[_this.options.prefix + ":encoding:" + type + ":" + encoding] = reply,
                                _a));
                            var _a;
                        });
                    });
                }))).then(function (items) {
                    return items.reduce(function (obj, item) {
                        obj = __assign({}, obj, item);
                        return obj;
                    }, {});
                }));
            });
        });
    };
    return Emitter;
}());
exports.Emitter = Emitter;
