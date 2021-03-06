import * as redis from 'redis';
export interface IDoneHandler {
    (success?: boolean): any;
}
export interface IProcessHandler {
    (data: any | string, done?: IDoneHandler): any;
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
     * 数据类型 The default value is 'json'
     */
    dataType?: 'json' | 'string';
    /**
     * 键值前缀
     */
    prefix?: string;
    /**
     * 读取到空队列的空闲时间，单位：秒 The default value is 1
     */
    sleep?: number;
    /**
     * 队列有效期，单位：秒 The default value is 60 * 60
     */
    expire?: number;
    /**
     * 是否打印调试信息 The default value is false
     */
    debug?: boolean;
}
/**
 * @file xqueue
 *
 * Emitter at Redis queue
 * @author
 *   zswang (http://weibo.com/zswang)
 * @version 0.1.22
 * @date 2018-10-09
 */
export interface IEmitReturn {
    command: string;
    encoding: string;
    result: number;
}
export interface IDescribeReturn {
    listener: {
        [key: string]: string;
    };
}
export declare class Emitter {
//     private options;
    /**
     * 处理队列
     */
//     private emitQueue;
//     private emitting;
//     private redisClient;
    constructor(options: IEmitterOptions);
    /**
     * 派发事件
     *
     * @param type 事件类型
     * @param data 数据
     */
    emit(type: string, data: any): Promise<IEmitReturn[]>;
    /**
     * 接收事件
     *
     * @param type 事件类型
     * @param encoding 处理类型
     * @param fn 回调函数
     */
    on(type: string, encoding: string, fn: IProcessHandler): IProcessInstance;
    /**
     * 断开数据库连接
     * @param flush
     */
    end(flush?: boolean): void;
    describe(type: string): Promise<IDescribeReturn>;
}
