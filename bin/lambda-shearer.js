#!/usr/bin/env node

'use strict';

const exit = require('exit');
const path = require('path');
const Progress = require('progress');
const yargs = require('yargs');

const print = require('../lib/print');
const Runner = require('../lib/Runner');

const argv = yargs
  .describe('lambda', 'lambda function name or ARN')
  .describe('payload', 'path to a file that contains JSON payload or function that produces one (is invoked with one argument: index)')
  .describe('region', 'AWS region')
  .describe('max-sockets', 'number of sockets to use in HTTPS connection pool')
  .describe('repeats', 'number of lambda function invocations for each memory setting')
  .describe('concurrency', 'number of concurrent invocations to use')
  .describe('delay', 'delay before each invoke')
  .describe('verbose', 'print verbose output')
  .describe('steps', 'comma-separated list of memory settings, in MB, for your lambda function to be tested with')
  .describe('warmup', 'perform warmup call before actual benchmark')
  .demand(['lambda', 'payload', 'steps'])
  .alias('lambda', 'l')
  .alias('payload', 'p')
  .alias('region', 'r')
  .alias('max-sockets', 'm')
  .alias('concurrency', 'c')
  .alias('delay', 'd')
  .alias('repeats', 'n')
  .alias('steps', 's')
  .alias('verbose', 'v')
  .alias('warmup', 'w')
  .default('max-sockets', Runner.MAX_SOCKETS)
  .default('repeats', 10)
  .default('verbose', false)
  .default('warmup', true)
  .default('delay', 0)
  .default('concurrency', 1)
  .argv;

const runnerOptions = {
  functionName: argv.lambda,
  payload: require(path.resolve(argv.payload)), // eslint-disable-line global-require, import/no-dynamic-require
  region: argv.region,
  steps: String(argv.steps).split(',').map(Number),
  repeats: Number(argv.repeats),
  concurrency: Number(argv.concurrency),
  delay: Number(argv.delay),
  verbose: Boolean(argv.verbose),
  warmup: Boolean(argv.warmup),
  maxSockets: Number(argv.maxSockets)
};

const runner = new Runner(runnerOptions);

if (runnerOptions.verbose) {
  runner.on('warmup', () => {
    console.log('Warming up function');
  });

  runner.on('invoke', invocationDuration => {
    console.log('Invocation time: %dms', invocationDuration);
  });

  runner.on('start', originalMemorySize => {
    console.log('Original memory size: %dMB\n', originalMemorySize);
  });

  runner.on('result', result => {
    console.log('Average: %dms\n', result.avg);
  });

  runner.on('step', memorySize => {
    console.log(`Running function with ${memorySize} MB allocated`);
  });

  runner.on('finish', () => {
    console.log('Cleaning up...\n');
  });
} else {
  let progressBar;

  runner.on('step', memorySize => {
    const prefix = `Running function ${runnerOptions.repeats} times with ${memorySize} MB allocated`;
    const format = `${prefix} [ :bar ] :percent :rate req/s (:elapseds elapsed, :etas ETA)`;
    progressBar = new Progress(format, {
      head: '✂️',
      width: 30,
      total: runnerOptions.repeats
    });
  });

  runner.on('invoke', () => progressBar.tick());
}

runner.run()
  .then(results => {
    print(results);
  })
  .catch(err => {
    console.error(err);
    exit(-1);
  });
