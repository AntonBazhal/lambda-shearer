'use strict';

function ascending(array) {
  return array.sort((first, second) => first - second);
}

module.exports = function print(report) {
  console.log('RESULTS:');

  ascending(Object.keys(report)).forEach(step => {
    console.log('%dMB:', step);
    console.log('\tMIN: %dms', report[step].min);
    console.log('\tMAX: %dms', report[step].max);
    console.log('\tAVG: %dms', report[step].avg);

    const percentiles = Object.keys(report[step].percentiles);

    ascending(percentiles).forEach(p => {
      console.log(`\tP${p}: %dms`, report[step].percentiles[p]);
    });
  });

  console.log();
};
