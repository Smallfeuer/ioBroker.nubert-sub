'use strict';

/**
 * Nubert X-Sub BLE protocol (X1 family).
 *
 * All commands are written "without response" to one GATT characteristic,
 * replies arrive as notifications on the same characteristic: <cmd> 01 <value>.
 */

const CHARACTERISTIC = 'dc968ed5-ed46-43d9-8562-ae5984e55e40';

const PASSWORD_REQ = [0x82, 0x00]; // handshake step 1 (the sub stays silent without it)
const INDICATION_ON = [0x4d, 0x01, 0x01]; // handshake step 2
const FIRMWARE_REQ = [0x02, 0x00];
const STATUS_REQ = [0x40, 0x07, 0x1e, 0x0a, 0x0e, 0x28, 0xa4, 0x34, 0xe4];

const LEVEL_MIN = -15;
const LEVEL_MAX = 6;
const LOWPASS_MIN = 35;
const LOWPASS_MAX = 140;

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function toBool(v) {
    if (typeof v === 'string') {
        return ['true', '1', 'on', 'an'].includes(v.trim().toLowerCase());
    }
    return !!v;
}

function toNumber(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) {
        throw new Error(`not a number: ${v}`);
    }
    return n;
}

/**
 * Build the command bytes for a writable state.
 *
 * @param {string} key state name (power, level, lowpass, phase180, raw)
 * @param {any} value state value
 * @returns {number[]} bytes to write
 */
function encode(key, value) {
    switch (key) {
        case 'power':
            return [0x1f, 0x01, toBool(value) ? 0x00 : 0x01];
        case 'level': {
            const db = clamp(Math.round(toNumber(value)), LEVEL_MIN, LEVEL_MAX);
            return [0x0b, 0x01, db - LEVEL_MIN];
        }
        case 'lowpass': {
            const hz = clamp(toNumber(value), LOWPASS_MIN, LOWPASS_MAX);
            return [0x29, 0x01, Math.round((hz - LOWPASS_MIN) / 5)];
        }
        case 'phase180':
            return [0xa5, 0x01, toBool(value) ? 0x01 : 0x00];
        case 'raw': {
            const hex = String(value || '').replace(/[\s:]/g, '');
            if (!hex || hex.length % 2 || /[^0-9a-f]/i.test(hex)) {
                throw new Error(`invalid hex string: ${value}`);
            }
            return [...Buffer.from(hex, 'hex')];
        }
        default:
            throw new Error(`state is not writable: ${key}`);
    }
}

/**
 * Decode one notification.
 *
 * @param {Buffer|number[]} data notification payload
 * @returns {{states: Record<string, any>, firmware?: {index: number, text: string}}} decoded values
 */
function parse(data) {
    const b = Buffer.from(data);
    const result = { states: {} };
    if (b.length < 3) {
        return result;
    }
    const cmd = b[0];
    const val = b[2];
    switch (cmd) {
        case 0x02:
            if (b.length >= 4) {
                result.firmware = { index: val, text: b.subarray(3).toString('latin1').replace(/\0/g, '').trim() };
            }
            break;
        case 0x1e:
            result.states.power = val === 0;
            break;
        case 0x0a:
            result.states.level = val + LEVEL_MIN;
            break;
        case 0x28:
            result.states.lowpass = LOWPASS_MIN + 5 * val;
            break;
        case 0xa4:
            result.states.phase180 = val === 1;
            break;
        case 0xe4:
            result.states.roomEq = val === 1;
            break;
    }
    return result;
}

function hex(data) {
    return Buffer.from(data).toString('hex').replace(/(..)(?!$)/g, '$1 ');
}

module.exports = {
    CHARACTERISTIC,
    PASSWORD_REQ,
    INDICATION_ON,
    FIRMWARE_REQ,
    STATUS_REQ,
    LEVEL_MIN,
    LEVEL_MAX,
    LOWPASS_MIN,
    LOWPASS_MAX,
    encode,
    parse,
    hex,
};
