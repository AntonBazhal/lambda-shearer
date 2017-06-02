'use strict';

const AWS = require('aws-sdk');
const BPromise = require('bluebird');

const INVOCATION_DELAY = 500;
const REPORT_REGEX = /REPORT RequestId: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+Duration: ([0-9.]+) ms\s+Billed Duration: ([0-9]+) ms\s+Memory Size: (\d+) MB\s+Max Memory Used: (\d+) MB\s+$/; // eslint-disable-line max-len

class Runner {
  constructor(options = {}) {
    this.functionName = options.functionName;
    this.payload = options.payload;
    this.repeats = options.repeats;
    this.steps = options.steps;

    this.lambdaClient = new AWS.Lambda({ region: options.region });
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

  _invokeLambda(payload) {
    return this.lambdaClient
      .invoke({
        FunctionName: this.functionName,
        Payload: JSON.stringify(payload),
        LogType: 'Tail'
      })
      .promise()
      .then(response => {
        const log = Buffer.from(response.LogResult, 'base64').toString('utf8');
        const parsedLog = REPORT_REGEX.exec(log);

        return parsedLog
          ? Math.round(Number(parsedLog[2]))
          : null;
      });
  }

  static _toMilliseconds(time) {
    const nanoseconds = (time[0] * 1000000000) + time[1];
    return Math.round(nanoseconds / 1000000);
  }

  static _getAverage(durations) {
    const average = durations.reduce((acc, duration) => acc + duration, 0) / durations.length;
    return Math.round(average);
  }

  static _parseCycleResult(cycleResult) {
    const meaningfullResults = cycleResult.slice(1); // first result is usually influenced by cold start

    return {
      min: Math.min(...meaningfullResults),
      max: Math.max(...meaningfullResults),
      avg: Runner._getAverage(meaningfullResults)
    };
  }

  _cycle(count, acc) {
    if (count <= 0) {
      return BPromise.resolve(acc);
    }

    if (!acc) {
      acc = []; // eslint-disable-line no-param-reassign
    }

    const self = this;
    return BPromise
      .delay(INVOCATION_DELAY)
      .then(() => {
        return typeof self.payload === 'function'
          ? self.payload(acc.length + 1)
          : self.payload;
      })
      .then(jsonPayload => {
        return self._invokeLambda(jsonPayload)
          .then(invocationDuration => {
            acc.push(invocationDuration);

            console.log('Invocation time: %dms', invocationDuration);
            return self._cycle(count - 1, acc);
          });
      });
  }

  static _sortSteps(steps) {
    return steps.sort((first, second) => first - second);
  }

  static _printResults(report) {
    console.log('RESULTS:');
    Runner._sortSteps(Object.keys(report)).forEach(step => {
      console.log('%dMB:', step);
      console.log('\tMIN: %dms', report[step].min);
      console.log('\tMAX: %dms', report[step].max);
      console.log('\tAVG: %dms', report[step].avg);
    });
    console.log();
    return report;
  }

  run() {
    const self = this;
    return self._getAllocatedMemory()
      .then(originalMemorySize => {
        console.log('Original memory size: %dMB\n', originalMemorySize);

        const sortedSteps = Runner._sortSteps(self.steps);
        return BPromise.reduce(sortedSteps, (report, memoryStep) => {
          console.log('Running function with %dMB allocated', memoryStep);
          return self._setAllocatedMemory(memoryStep)
            .then(() => {
              return self._cycle(self.repeats)
                .then(cycleResult => {
                  const parsedResult = Runner._parseCycleResult(cycleResult);

                  report[memoryStep] = parsedResult; // eslint-disable-line no-param-reassign
                  console.log('Average: %dms\n', parsedResult.avg);

                  return report;
                });
            });
        }, {})
        .finally(() => {
          console.log('Cleaning up...\n');
          return self._setAllocatedMemory(originalMemorySize);
        });
      })
      .then(Runner._printResults);
  }
}

module.exports = Runner;
