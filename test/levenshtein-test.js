const chai = require('chai');
const assert = chai.assert;
const levenshtein = require('../src/levenshtein');

describe('levenshtein', () => {
  describe('getBestMatch', () => {
    const recentStop = {
      stopName: 'recentstopname'
    };
    const stops = [
      { stopName: 'stopnameone' },
      { stopName: 'stopnametwo' },
      { stopName: 'stopnamethree' },
      { stopName: 'boston' },
      { stopName: 'watertown' }
    ];
    const input = [
      null,
      'recentstopname',
      'stopnameone',
      'stopnametwo',
      'bwoston',
      'watertone',
      'whaterton',
      'wharton'
    ];
    const expectedIndex = [
      -1,
      -1,
      0,
      1,
      3,
      4,
      4,
      null
    ];

    function testInputs(i) {
      it(`should return ${expectedIndex[i]} when matching for ${input[i]}`, () => {
        const index = levenshtein.getBestMatch(input[i], recentStop, stops);
        assert.strictEqual(index, expectedIndex[i]);
      });
    }

    for (var i = 0; i < 8; i++) {
      testInputs(i);
    }
  });
});
