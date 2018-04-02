import * as redis from 'redis'

export interface IProcessHandler {
  (data: object | string, done?: Function)
}

export interface IProcessInstance {
  readonly freed: boolean
  stop: { () }
}

export interface IEmitterOptions {
  /**
   * Redis 客户端，长连接用
   */
  redisClient: string | redis.RedisClient
  /**
   * 数据类型 The default value is 'json'
   */
  dataType?: 'json' | 'string'
  /**
   * 键值前缀
   */
  prefix?: string
  /**
   * 读取到空队列的空闲时间，单位：秒 The default value is 1
   */
  sleep?: number
  /**
   * 队列有效期，单位：秒 The default value is 60 * 60
   */
  expire?: number
  /**
   * 是否打印调试信息 The default value is false
   */
  debug?: boolean
}

/*<jdists encoding="ejs" data="../package.json">*/
/**
 * @file <%- name %>
 *
 * <%- description %>
 * @author
     <% (author instanceof Array ? author : [author]).forEach(function (item) { %>
 *   <%- item.name %> (<%- item.url %>)
     <% }); %>
 * @version <%- version %>
     <% var now = new Date() %>
 * @date <%- [
      now.getFullYear(),
      now.getMonth() + 101,
      now.getDate() + 100
    ].join('-').replace(/-1/g, '-') %>
 */
/*</jdists>*/

export interface IEmitReturn {
  command: string
  encoding: string
  result: number
}

export class Emitter {
  options: IEmitterOptions
  /**
   * 处理队列
   */
  emitQueue: {
    type: string
    data: object
    resolve: Function
    reject: Function
  }[] = []
  emitting: boolean = false
  redisClient: redis.RedisClient

  constructor(options: IEmitterOptions) {
    this.options = {
      ...{
        prefix: 'xqueue:emitter',
        sleep: 1,
        expire: 60 * 60,
        debug: false,
        dataType: 'json',
      },
      ...options,
    }
    if (typeof options.redisClient === 'string') {
      this.redisClient = redis.createClient(options.redisClient)
    } else {
      this.redisClient = options.redisClient
    }
  }

  /**
   * 派发事件
   *
   * @param type 事件类型
   * @param data 数据
   */
  emit(type: string, data: object): Promise<IEmitReturn[]> {
    // 队列发送中
    if (this.emitting) {
      return new Promise((resolve, reject) => {
        this.emitQueue.push({
          type: type,
          data: data,
          resolve: resolve,
          reject: reject,
        })
      }) as Promise<IEmitReturn[]>
    }

    let next = () => {
      this.emitting = false
      let item = this.emitQueue.shift()
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
      // 获取该类型监听类型列表
      this.redisClient.smembers(
        `${this.options.prefix}:listener:${type}`,
        (err, results) => {
          if (err) {
            if (this.options.debug) {
              console.error('^linenum', err)
            }
            reject(err)
            next()
            return
          }
          resolve(Promise.all(
            results.map(encoding => {
              return new Promise((resolve, reject) => {
                this.redisClient.exists(
                  `${this.options.prefix}:encoding:${type}:${encoding}:ttl`,
                  (err, result) => {
                    if (err) {
                      if (this.options.debug) {
                        console.error('^linenum', err)
                      }
                      reject(err)
                      next()
                      return
                    }
                    if (result === 0) {
                      // 移除失效的成员
                      this.redisClient.srem(
                        `${this.options.prefix}:listener:${type}`,
                        `${encoding}`,
                        err => {
                          if (err) {
                            if (this.options.debug) {
                              console.error('^linenum', err)
                            }
                            reject(err)
                            next()
                            return
                          }
                          resolve({
                            command: 'srem',
                            encoding: encoding,
                            result: result,
                          })
                        }
                      )
                      return
                    }
                    let content =
                      this.options.dataType === 'json'
                        ? JSON.stringify(data)
                        : String(data)
                    this.redisClient.rpush(
                      `${this.options.prefix}:encoding:${type}:${encoding}`,
                      content,
                      (err, result) => {
                        if (err) {
                          if (this.options.debug) {
                            console.error('^linenum', err)
                          }
                          reject(err)
                          next()
                          return
                        }
                        resolve({
                          command: 'rpush',
                          encoding: encoding,
                          result: result,
                        })
                      }
                    )
                  }
                )
              })
            })
          ).then(reply => {
            next()
            return reply
          }) as Promise<IEmitReturn[]>)
        }
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
    let lastExpire = Date.now()
    this.redisClient.setex(
      `${this.options.prefix}:encoding:${type}:${encoding}:ttl`,
      this.options.expire,
      ':nil'
    )
    this.redisClient.sadd(
      `${this.options.prefix}:listener:${type}`,
      `${encoding}`
    )
    let timer: NodeJS.Timer
    let freed: boolean = false

    let next = () => {
      if (freed) {
        return
      }
      let now = Date.now()
      if (now - lastExpire > this.options.expire * 1000 * 0.75) {
        this.redisClient.setex(
          `${this.options.prefix}:encoding:${type}:${encoding}:ttl`,
          this.options.expire,
          ':nil'
        )
        lastExpire = now
      }

      this.redisClient.lpop(
        `${this.options.prefix}:encoding:${type}:${encoding}`,
        (err, result) => {
          if (err) {
            if (this.options.debug) {
              console.error('^linenum', err)
            }
            timer = setTimeout(next, this.options.sleep * 1000 * 5)
            return
          }
          if (result === null || result === undefined) {
            timer = setTimeout(next, this.options.sleep * 1000)
            return
          }
          if (this.options.debug) {
            console.log('^linenum lpop', result)
          }
          let content
          try {
            content =
              this.options.dataType === 'json'
                ? JSON.parse(result)
                : String(result)
          } catch (ex) {
            setTimeout(next, this.options.sleep * 1000)
            if (this.options.debug) {
              console.log('^linenum', ex)
            }
            return
          }
          if (fn.length >= 2) {
            fn(content, next)
          } else {
            fn(content)
            next()
          }
        }
      )
    }

    timer = setTimeout(next, this.options.sleep * 1000)
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
      },
    }
    return instance
  }

  /**
   * 断开数据库连接
   * @param flush 
   */
  end(flush?: boolean) {
    if (typeof this.options.redisClient === 'string') {
      this.redisClient.end(flush)
    }
  }
}
