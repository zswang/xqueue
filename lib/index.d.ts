import * as redis from 'redis';
export interface IProcessHandler {
    (data: object | string): any;
}
export interface IProcessInstance {
    readonly freed: boolean;
    stop: {
        ();
    };
}
export interface IEmitterOptions {
    /**
     * Redis 客户端，长连接用
     */
    redisClient: string | redis.RedisClient;
    /**
     * 数据类型
     */
    dataType: 'json' | 'string';
    /**
     * 键值前缀
     */
    prefix?: string;
    /**
     * 读取到空队列的空闲时间，单位：毫秒
     */
    sleep?: number;
    /**
     * 队列有效期，单位：秒
     */
    expire?: number;
    /**
     * 是否打印调试信息
     */
    debug?: boolean;
}
/**
 * @file xqueue
 *
 * Emitter at Redis queue
 * @author
 *   zswang (http://weibo.com/zswang)
 * @version 0.1.0
 * @date 2018-03-22
 */
export declare class Emitter {
    options: IEmitterOptions;
    buffer: {
        type: string;
        data: object;
        resolve: Function;
        reject: Function;
    }[];
    emitting: boolean;
    redisClient: redis.RedisClient;
    constructor(options: IEmitterOptions);
    /**
     * 派发事件
     *
     * @param type 事件类型
     * @param data 数据
     */
    emit(type: string, data: object): Promise<any>;
    /**
     * 接收事件
     *
     * @param type 事件类型
     * @param encoding 处理类型
     * @param fn 回调函数
     */
    on(type: string, encoding: string, fn: IProcessHandler): IProcessInstance;
    end(flush?: boolean): void;
}
