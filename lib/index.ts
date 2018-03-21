import * as redis from 'redis'
export interface IProcessHandler {
  (data: object | string)
}
export interface IProcessInstance {
  readonly freed: boolean
  stop: { () }
}
export interface IEmitterOptions {
  /**
   * Redis 短连字符串，短连接用，如："redis://host/?db=0"
   */
  redisConnect?: string
  /**
   * Redis 客户端，长连接用
   */
  redisClient?: redis.RedisClient
  /**
   * 数据类型
   */
  dataType: 'json' | 'string'
  /**
   * 键值前缀
   */
  prefix?: string
  /**
   * 读取到空队列的空闲时间，单位：毫秒
   */
  sleep?: number
  /**
   * 队列有效期，单位：秒
   */
  expire?: number
  /**
   * 是否打印调试信息
   */
  debug?: boolean
}
/**
 * @file xqueue
 *
 * Emitter at Redis queue
 * @author
 *   zswang (http://weibo.com/zswang)
 * @version 0.0.3
 * @date 2018-03-21
 */
export class Emitter {
  options: IEmitterOptions
  buffer: {
    type: string
    data: object
    resolve: Function
    reject: Function
  }[] = []
  emitting: boolean = false
  constructor(options: IEmitterOptions) {
    this.options = {
      ...{
        prefix: 'xqueue:emitter',
        sleep: 1000,
        expire: 60 * 60,
        debug: false,
        dataType: 'json',
      },
      ...options,
    }
  }
  /**
   * 派发事件
   *
   * @param type 事件类型
   * @param data 数据
   */
  emit(type: string, data: object): Promise<any> {
    // 队列发送中
    if (this.emitting) {
      return new Promise((resolve, reject) => {
        this.buffer.push({
          type: type,
          data: data,
          resolve: resolve,
          reject: reject,
        })
      })
    }
    let next = () => {
      this.emitting = false
      let item = this.buffer.shift()
      if (item) {
        this.emit(item.type, item.data)
          .then(reply => {
            item.resolve(reply)
            next()
          })
          .catch(err => {
            item.reject(err)
            next()
          })
      }
    }
    //标记发送中
    this.emitting = true
    return new Promise((resolve, reject) => {
      let redisClient =
        this.options.redisClient ||
        (this.options.redisConnect &&
          redis.createClient(this.options.redisConnect))
      // 获取该类型监听类型列表
      redisClient.smembers(
        `${this.options.prefix}:listener:${type}`,
        (err, results) => {
          if (err) {
            if (this.options.debug) {
              console.error('xqueue/src/index.ts:133', err)
            }
            reject(err)
            next()
            return
          }
          resolve(
            Promise.all(
              results.map(encoding => {
                return new Promise((resolve, reject) => {
                  redisClient.exists(
                    `${this.options.prefix}:encoding:${type}:${encoding}:ttl`,
                    (err, result) => {
                      if (err) {
                        if (this.options.debug) {
                          console.error('xqueue/src/index.ts:148', err)
                        }
                        reject(err)
                        next()
                        return
                      }
                      if (result === 0) {
                        // 移除失效的成员
                        redisClient.srem(
                          `${this.options.prefix}:listener:${type}`,
                          `${encoding}`,
                          err => {
                            if (err) {
                              if (this.options.debug) {
                                console.error('xqueue/src/index.ts:162', err)
                              }
                              reject(err)
                              next()
                              return
                            }
                            resolve(`${encoding}:${result}`)
                          },
                        )
                        return
                      }
                      let content =
                        this.options.dataType === 'json'
                          ? JSON.stringify(data)
                          : String(data)
                      redisClient.rpush(
                        `${this.options.prefix}:encoding:${type}:${encoding}`,
                        content,
                        (err, result) => {
                          if (err) {
                            if (this.options.debug) {
                              console.error('xqueue/src/index.ts:183', err)
                            }
                            reject(err)
                            next()
                            return
                          }
                          resolve(`${encoding}:${result}`)
                        },
                      )
                    },
                  )
                })
              }),
            ).then(() => {
              if (!this.options.redisClient) {
                redisClient.end(true)
              }
              next()
            }),
          )
        },
      )
    })
  }
  /**
   * 接收事件
   *
   * @param type 事件类型
   * @param encoding 处理类型
   * @param fn 回调函数
   */
  on(type: string, encoding: string, fn: IProcessHandler): IProcessInstance {
    let redisClient =
      this.options.redisClient ||
      (this.options.redisConnect &&
        redis.createClient(this.options.redisConnect))
    let lastExpire = Date.now()
    redisClient.setex(
      `${this.options.prefix}:encoding:${type}:${encoding}:ttl`,
      this.options.expire,
      ':nil',
    )
    redisClient.sadd(`${this.options.prefix}:listener:${type}`, `${encoding}`)
    let timer: NodeJS.Timer
    let freed: boolean = false
    let next = () => {
      if (freed) {
        return
      }
      let now = Date.now()
      if (now - lastExpire < this.options.expire * 0.25) {
        redisClient.setex(
          `${this.options.prefix}:encoding:${type}:${encoding}:ttl`,
          this.options.expire,
          ':nil',
        )
        lastExpire = now
      }
      redisClient.lpop(
        `${this.options.prefix}:encoding:${type}:${encoding}`,
        (err, result) => {
          if (err) {
            if (this.options.debug) {
              console.error('xqueue/src/index.ts:250', err)
            }
            timer = setTimeout(next, this.options.sleep * 5)
            return
          }
          if (result === null) {
            timer = setTimeout(next, this.options.sleep)
            return
          }
          if (this.options.debug) {
            console.log('xqueue/src/index.ts:260 lpop', result)
          }
          try {
            let content =
              this.options.dataType === 'json'
                ? JSON.parse(result)
                : String(result)
            fn(content)
          } catch (ex) {
            if (this.options.debug) {
              console.log('xqueue/src/index.ts:270', ex)
            }
          } finally {
            next()
          }
        },
      )
    }
    timer = setTimeout(next, this.options.sleep)
    let instance = {
      get freed(): boolean {
        return freed
      },
      stop: () => {
        if (freed) {
          return
        }
        freed = true
        clearTimeout(timer)
        if (!this.options.redisClient) {
          redisClient.end(true)
        }
      },
    }
    return instance
  }
}
