#!/usr/bin/env node

'use strict';

const exit = require('exit');
const path = require('path');
const yargs = require('yargs');

const Runner = require('./lib/Runner');

function main() {
  const argv = yargs
    .describe('lambda', 'lambda function name or ARN')
    .describe('payload', 'path to a file that contains JSON payload or function that produces one (is invoked with one argument: index)')
    .describe('region', 'AWS region')
    .describe('repeats', 'number of lambda function invocations for each memory setting')
    .describe('steps', 'comma-separated list of memory settings, in MB, for your lambda function to be tested with')
    .demand(['lambda', 'payload', 'steps'])
    .alias('lambda', 'l')
    .alias('payload', 'p')
    .alias('region', 'r')
    .alias('repeats', 'n')
    .alias('steps', 's')
    .default('repeats', 10)
    .argv;

  const runnerOptions = {
    functionName: argv.lambda,
    payload: require(path.resolve(argv.payload)), // eslint-disable-line global-require, import/no-dynamic-require
    region: argv.region,
    steps: String(argv.steps).split(',').map(Number),
    repeats: Number(argv.repeats)
  };

  const runner = new Runner(runnerOptions);
  return runner.run();
}

main().catch(err => {
  console.error(err);
  exit(-1);
});
