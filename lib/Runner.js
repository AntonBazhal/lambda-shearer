'use strict';

const { performance } = require('perf_hooks');
const EventEmitter = require('events');

const AWS = require('aws-sdk');
const BPromise = require('bluebird');
const percentile = require('percentile');
const https = require('https');

const MAX_SOCKETS = 512;
const REPORT_REGEX = /REPORT RequestId: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+Duration: ([0-9.]+) ms\s+Billed Duration: ([0-9]+) ms\s+Memory Size: (\d+) MB\s+Max Memory Used: (\d+) MB\s+$/; // eslint-disable-line max-len
const PERCENTILES = [50, 66, 75, 80, 90, 95, 98, 99];

class Runner extends EventEmitter {
  constructor(options = {}) {
    super();

    Object.assign(this, options);

    this._setMaxSockets(this.maxSockets || MAX_SOCKETS);
    this.lambdaClient = new AWS.Lambda({ region: options.region });
  }

  _setMaxSockets(maxSockets) {
    const agent = new https.Agent({ keepAlive: true, maxSockets });
    AWS.config.update({ httpOptions: { agent } });
  }

  _getAllocatedMemory() {
    return this.lambdaClient
      .getFunctionConfiguration({
        FunctionName: this.functionName
      })
      .promise()
      .then(result => result.MemorySize);
  }

  _setAllocatedMemory(memorySize) {
    return this.lambdaClient
      .updateFunctionConfiguration({
        FunctionName: this.functionName,
        MemorySize: memorySize
      })
      .promise();
  }

  _invokeLambda(i) {
    return BPromise.resolve()
      .then(() => {
        if (typeof this.payload === 'function') {
          return this.payload(i);
        }

        return this.payload;
      })
      .then(payload => {
        const { timer } = this;
        const before = performance.now();

        return this.lambdaClient
          .invoke({
            FunctionName: this.functionName,
            Payload: JSON.stringify(payload),
            LogType: 'Tail'
          })
          .promise()
          .then(response => {
            if (timer === 'wall') {
              return performance.now() - before;
            }

            const log = Buffer.from(response.LogResult, 'base64').toString('utf8');
            const parsedLog = REPORT_REGEX.exec(log);

            return parsedLog
              ? Number(parsedLog[2])
              : null;
          });
      });
  }

  static _getAverage(durations) {
    return durations.reduce((acc, duration) => acc + duration, 0) / durations.length;
  }

  static _parseCycleResult(cycleResult) {
    const percentiles = PERCENTILES.reduce((memo, i) => {
      return Object.assign(memo, { [i]: percentile(i, cycleResult).toFixed(2) });
    }, {});

    return {
      min: Math.min(...cycleResult).toFixed(2),
      max: Math.max(...cycleResult).toFixed(2),
      avg: Runner._getAverage(cycleResult).toFixed(2),
      percentiles
    };
  }

  _cycle(count) {
    return BPromise.resolve()
      .then(() => {
        if (this.warmup && this.concurrency === 1) {
          this.emit('warmup');

          return this._invokeLambda(0);
        }
        return false;
      })
      .delay(this.warmup ? this.delay : 0)
      .then(() => {
        return BPromise.map(Array.from(Array(count)).keys(), i => {
          return BPromise
            .delay(this.concurrency === 1 ? this.delay : 0)
            .then(() => {
              return this._invokeLambda(i + 1);
            })
            .tap(invocationDuration => {
              this.emit('invoke', invocationDuration);
            });
        }, { concurrency: this.concurrency });
      });
  }

  run() {
    return this._getAllocatedMemory()
      .then(originalMemorySize => {
        this.emit('start', originalMemorySize);

        return BPromise.reduce(this.steps, (report, memoryStep) => {
          return this._setAllocatedMemory(memoryStep)
            .then(() => {
              this.emit('step', memoryStep);

              return this._cycle(this.repeats)
                .then(cycleResult => {
                  const parsedResult = Runner._parseCycleResult(cycleResult);

                  this.emit('result', parsedResult);

                  return Object.assign(report, { [memoryStep]: parsedResult });
                });
            });
        }, {})
        .finally(() => {
          this.emit('finish');
          return this._setAllocatedMemory(originalMemorySize);
        });
      });
  }
}

Runner.MAX_SOCKETS = MAX_SOCKETS;
module.exports = Runner;
