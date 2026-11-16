'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../lib/protocol');

test('power on/off with length byte', () => {
    assert.deepEqual(P.encode('power', true), [0x1f, 0x01, 0x00]);
    assert.deepEqual(P.encode('power', false), [0x1f, 0x01, 0x01]);
    assert.deepEqual(P.encode('power', 'true'), [0x1f, 0x01, 0x00]);
});

test('level in dB, clamped to -15..+6', () => {
    assert.deepEqual(P.encode('level', -9), [0x0b, 0x01, 6]);
    assert.deepEqual(P.encode('level', 0), [0x0b, 0x01, 15]);
    assert.deepEqual(P.encode('level', 20), [0x0b, 0x01, 21]);
    assert.deepEqual(P.encode('level', -40), [0x0b, 0x01, 0]);
});

test('lowpass in 5 Hz steps, clamped to 35..140', () => {
    assert.deepEqual(P.encode('lowpass', 35), [0x29, 0x01, 0]);
    assert.deepEqual(P.encode('lowpass', 80), [0x29, 0x01, 9]);
    assert.deepEqual(P.encode('lowpass', 140), [0x29, 0x01, 21]);
    assert.deepEqual(P.encode('lowpass', 500), [0x29, 0x01, 21]);
});

test('phase and raw', () => {
    assert.deepEqual(P.encode('phase180', true), [0xa5, 0x01, 0x01]);
    assert.deepEqual(P.encode('phase180', false), [0xa5, 0x01, 0x00]);
    assert.deepEqual(P.encode('raw', '1f 01 00'), [0x1f, 0x01, 0x00]);
    assert.throws(() => P.encode('raw', 'zz'));
    assert.throws(() => P.encode('roomEq', true));
    assert.throws(() => P.encode('level', 'abc'));
});

test('parse status replies', () => {
    assert.deepEqual(P.parse([0x1e, 0x01, 0x00]).states, { power: true });
    assert.deepEqual(P.parse([0x1e, 0x01, 0x01]).states, { power: false });
    assert.deepEqual(P.parse([0x0a, 0x01, 0x06]).states, { level: -9 });
    assert.deepEqual(P.parse([0x28, 0x01, 0x09]).states, { lowpass: 80 });
    assert.deepEqual(P.parse([0xa4, 0x01, 0x01]).states, { phase180: true });
    assert.deepEqual(P.parse([0xe4, 0x01, 0x00]).states, { roomEq: false });
    assert.deepEqual(P.parse([0x82, 0x04, 0x00, 0x02, 0x00, 0x07]).states, {});
    assert.deepEqual(P.parse([0x1e]).states, {});
});

test('parse firmware', () => {
    const r = P.parse([0x02, 0x05, 0x01, ...Buffer.from('1.23')]);
    assert.deepEqual(r.firmware, { index: 1, text: '1.23' });
});

test('hex formatting', () => {
    assert.equal(P.hex([0x1f, 0x01, 0x00]), '1f 01 00');
});
