'use strict';

/*
 * ioBroker.nubert-sub
 * Controls a Nubert X-Sub subwoofer via Bluetooth LE (BlueZ / D-Bus).
 *
 * The sub accepts only one BLE connection at a time, so the adapter connects
 * on demand and disconnects shortly afterwards (the vendor app can connect then).
 * Status is read at start-up, after switching on and once some time after the
 * last command. There is no periodic polling.
 */

const utils = require('@iobroker/adapter-core');
const { createBluetooth } = require('node-ble');
const { Variant } = require('dbus-next');
const P = require('./lib/protocol');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const CONNECT_ATTEMPTS = 5;
const WAKE_DELAY = 4000; // the sub needs a moment after power-on before it reports values

const STATES = {
    power: { type: 'boolean', role: 'switch.power', read: true, write: true, name: { en: 'Power (on / standby)', de: 'Ein (an / Standby)' } },
    level: { type: 'number', role: 'level', read: true, write: true, unit: 'dB', min: P.LEVEL_MIN, max: P.LEVEL_MAX, step: 1, name: { en: 'Level', de: 'Pegel' } },
    lowpass: { type: 'number', role: 'level', read: true, write: true, unit: 'Hz', min: P.LOWPASS_MIN, max: P.LOWPASS_MAX, step: 5, name: { en: 'Low-pass frequency', de: 'Tiefpass-Frequenz' } },
    phase180: { type: 'boolean', role: 'switch', read: true, write: true, name: { en: 'Phase 180°', de: 'Phase 180°' } },
    roomEq: { type: 'boolean', role: 'indicator', read: true, write: false, name: { en: 'Room EQ active', de: 'Raum-EQ aktiv' } },
    refresh: { type: 'boolean', role: 'button', read: false, write: true, name: { en: 'Read status now', de: 'Status jetzt lesen' } },
    raw: { type: 'string', role: 'text', read: true, write: true, name: { en: 'Raw command (hex, experts only)', de: 'Rohbefehl (Hex, nur für Experten)' } },
    firmware: { type: 'string', role: 'info.firmware', read: true, write: false, name: { en: 'Firmware', de: 'Firmware' } },
    lastReply: { type: 'string', role: 'text', read: true, write: false, name: { en: 'Last reply (hex)', de: 'Letzte Antwort (Hex)' } },
    error: { type: 'string', role: 'text', read: true, write: false, name: { en: 'Last error', de: 'Letzter Fehler' } },
};

class NubertSub extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'nubert-sub' });
        this.queue = Promise.resolve();
        this.conn = null;
        this.fw = {};
        this.readbackTimer = null;
        this.idleTimer = null;
        this.stopping = false;
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('message', this.onMessage.bind(this));
    }

    async onReady() {
        await this.setState('info.connection', false, true);
        await this.createObjects();

        const ble = createBluetooth();
        this.bt = ble.bluetooth;
        this.destroyBt = ble.destroy;

        this.mac = String(this.config.mac || '').trim().toUpperCase();
        if (!MAC_RE.test(this.mac)) {
            this.mac = '';
            this.log.warn('No Bluetooth address configured: open the instance settings and press "Search sub"');
            return;
        }
        this.charUuid = String(this.config.characteristic || P.CHARACTERISTIC).trim().toLowerCase();
        this.readbackDelay = Math.max(5, Number(this.config.readbackDelay) || 60) * 1000;
        this.idleDelay = Math.max(2, Number(this.config.idleDisconnect) || 5) * 1000;

        this.subscribeStates('*');
        this.enqueue('start-up', async () => {
            await this.write(P.FIRMWARE_REQ);
            await sleep(1000);
            await this.write(P.STATUS_REQ);
        });
    }

    async createObjects() {
        for (const [id, common] of Object.entries(STATES)) {
            await this.extendObject(id, { type: 'state', common, native: {} });
        }
    }

    // ---------------------------------------------------------------- queue

    /**
     * Run BLE work strictly one after another.
     *
     * @param {string} label for logging
     * @param {() => Promise<void>} fn work to do while connected
     */
    enqueue(label, fn) {
        this.queue = this.queue.then(async () => {
            if (this.stopping) {
                return;
            }
            clearTimeout(this.idleTimer);
            try {
                await this.ensureConnected();
                await fn();
                await this.setStateChangedAsync('error', '', true);
            } catch (e) {
                this.log.warn(`${label}: ${e.message}`);
                await this.setState('error', `${label}: ${e.message}`, true);
                await this.disconnect();
            }
            this.scheduleIdle();
        });
    }

    scheduleIdle() {
        clearTimeout(this.idleTimer);
        if (this.readbackTimer || !this.conn || this.stopping) {
            return; // stay connected until the pending read-back is done
        }
        this.idleTimer = setTimeout(() => {
            this.queue = this.queue.then(() => this.disconnect());
        }, this.idleDelay);
    }

    scheduleReadback() {
        clearTimeout(this.readbackTimer);
        this.readbackTimer = setTimeout(() => {
            this.readbackTimer = null;
            this.enqueue('read-back', () => this.write(P.STATUS_REQ));
        }, this.readbackDelay);
    }

    // ---------------------------------------------------------------- BLE

    async ensureConnected() {
        if (this.conn) {
            const ok = await this.conn.device.isConnected().catch(() => false);
            if (ok) {
                return;
            }
            this.conn = null;
        }
        const adapter = await this.getBtAdapter();
        if (!(await adapter.isPowered())) {
            throw new Error(`Bluetooth adapter ${await adapter.getName().catch(() => '')} is not powered`);
        }
        let last;
        for (let attempt = 1; attempt <= CONNECT_ATTEMPTS && !this.stopping; attempt++) {
            try {
                const device = await this.getDevice(adapter);
                if (await device.isConnected()) {
                    // stale BlueZ connection: the sub does not advertise while one exists
                    this.log.info('Closing stale BlueZ connection');
                    await device.disconnect().catch(() => {});
                    await sleep(2000);
                }
                await device.connect();
                const gatt = await device.gatt();
                const char = await this.findCharacteristic(gatt);
                char.on('valuechanged', buf => this.onNotify(buf));
                await char.startNotifications();
                device.once('disconnect', () => {
                    this.log.debug('BLE disconnected');
                    this.conn = null;
                    this.setState('info.connection', false, true);
                });
                this.conn = { device, char };
                await this.setState('info.connection', true, true);
                if (attempt > 1) {
                    this.log.info(`BLE connected after ${attempt} attempts`);
                }
                this.log.debug(`BLE connected (attempt ${attempt})`);
                await this.write(P.PASSWORD_REQ);
                await sleep(500);
                await this.write(P.INDICATION_ON);
                await sleep(500);
                return;
            } catch (e) {
                last = e;
                // BlueZ often aborts the first attempt right away (le-connection-abort-by-local);
                // a quick retry usually succeeds
                this.log.debug(`Connect attempt ${attempt} failed: ${e.message}`);
                await sleep(attempt < 3 ? 1000 : 3000);
            }
        }
        throw new Error(`no BLE connection (is the vendor app connected?): ${last && last.message}`);
    }

    async getBtAdapter() {
        const hci = String(this.config.hci || '').trim();
        try {
            return hci ? await this.bt.getAdapter(hci) : await this.bt.defaultAdapter();
        } catch (e) {
            throw new Error(`Bluetooth adapter ${hci || '(default)'} not available: ${e.message}`);
        }
    }

    /**
     * Use the device BlueZ already knows; discover only if it is unknown.
     * Marking it trusted keeps it known, so later connects need no discovery.
     *
     * @param {any} adapter node-ble adapter
     */
    async getDevice(adapter) {
        try {
            return await adapter.getDevice(this.mac);
        } catch {
            this.log.info(`${this.mac} not known to BlueZ yet, searching (max. 30 s)`);
        }
        const started = !(await adapter.isDiscovering());
        if (started) {
            await adapter.startDiscovery();
        }
        let device;
        try {
            device = await adapter.waitDevice(this.mac, 30000);
        } finally {
            if (started) {
                await adapter.stopDiscovery().catch(() => {});
            }
        }
        await device.helper.set('Trusted', new Variant('b', true)).catch(e => this.log.debug(`trust: ${e.message}`));
        return device;
    }

    async findCharacteristic(gatt) {
        for (const uuid of await gatt.services()) {
            const service = await gatt.getPrimaryService(uuid);
            if ((await service.characteristics()).includes(this.charUuid)) {
                return service.getCharacteristic(this.charUuid);
            }
        }
        throw new Error(`characteristic ${this.charUuid} not found`);
    }

    async write(bytes) {
        if (!this.conn) {
            throw new Error('not connected');
        }
        const buf = Buffer.from(bytes);
        this.log.debug(`-> ${P.hex(buf)}`);
        const c = this.conn.char;
        if (typeof c.writeValueWithoutResponse === 'function') {
            await c.writeValueWithoutResponse(buf);
        } else {
            await c.writeValue(buf, { type: 'command' });
        }
    }

    async disconnect() {
        clearTimeout(this.idleTimer);
        const conn = this.conn;
        this.conn = null;
        if (!conn) {
            return;
        }
        try {
            conn.char.removeAllListeners('valuechanged');
            await conn.char.stopNotifications().catch(() => {});
            await conn.device.disconnect();
        } catch (e) {
            this.log.debug(`disconnect: ${e.message}`);
        }
        await this.setState('info.connection', false, true);
    }

    onNotify(buf) {
        this.log.debug(`<- ${P.hex(buf)}`);
        this.setState('lastReply', P.hex(buf), true);
        const r = P.parse(buf);
        if (r.firmware && r.firmware.text) {
            this.fw[r.firmware.index] = r.firmware.text;
            const text = Object.keys(this.fw)
                .sort((a, b) => a - b)
                .map(k => this.fw[k])
                .join('/');
            this.setState('firmware', text, true);
        }
        for (const [id, val] of Object.entries(r.states)) {
            this.setState(id, val, true);
        }
    }

    // ---------------------------------------------------------------- search

    /**
     * Search for Nubert devices (BLE discovery).
     *
     * @param {number} seconds discovery time
     * @returns {Promise<{mac: string, name: string, rssi: number|null}[]>} found devices, strongest first
     */
    async scan(seconds) {
        const adapter = await this.getBtAdapter();
        if (!(await adapter.isPowered())) {
            throw new Error('Bluetooth adapter is not powered');
        }
        await adapter.helper.callMethod('SetDiscoveryFilter', { Transport: new Variant('s', 'le') }).catch(() => {});
        const started = !(await adapter.isDiscovering());
        if (started) {
            await adapter.startDiscovery();
        }
        try {
            await sleep(seconds * 1000);
        } finally {
            if (started) {
                await adapter.stopDiscovery().catch(() => {});
            }
        }
        const found = [];
        for (const mac of await adapter.devices()) {
            const dev = await adapter.getDevice(mac).catch(() => null);
            if (!dev) {
                continue;
            }
            const name = await dev.getName().catch(() => dev.getAlias().catch(() => ''));
            if (!P.isNubert(name)) {
                continue;
            }
            const rssi = await dev.helper.prop('RSSI').catch(() => null);
            found.push({ mac: mac.toUpperCase(), name, rssi: typeof rssi === 'number' ? rssi : null });
        }
        found.sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
        return found;
    }

    /**
     * Run fn after all queued BLE work, without a connection to the sub
     * (the sub does not advertise while connected).
     *
     * @param {() => Promise<any>} fn work
     */
    runDisconnected(fn) {
        const p = this.queue.then(async () => {
            await this.disconnect();
            return fn();
        });
        this.queue = p.catch(() => {});
        return p;
    }

    async onMessage(obj) {
        if (!obj || typeof obj !== 'object' || !obj.command) {
            return;
        }
        const reply = res => obj.callback && this.sendTo(obj.from, obj.command, res, obj.callback);
        if (obj.command !== 'scan') {
            reply({ error: `unknown command ${obj.command}` });
            return;
        }
        const de = await this.isGerman();
        try {
            const found = await this.runDisconnected(() => this.scan(10));
            this.log.info(`Search: ${found.length ? found.map(d => `${d.name} ${d.mac}`).join(', ') : 'nothing found'}`);
            if (!found.length) {
                reply({
                    error: de
                        ? 'Kein Nubert-Gerät gefunden. Ist der Sub am Strom und die X-Remote-App getrennt?'
                        : 'No Nubert device found. Is the sub powered and the X-Remote app disconnected?',
                });
                return;
            }
            const list = found.map(d => `${d.name} (${d.mac}${d.rssi !== null ? `, ${d.rssi} dBm` : ''})`).join(', ');
            // admin shows the text from jsonConfig "result.found" with %s replaced by args
            reply({ native: { mac: found[0].mac }, result: 'found', args: [`${found[0].name} ${found[0].mac}`, list] });
        } catch (e) {
            this.log.warn(`Search failed: ${e.message}`);
            reply({ error: e.message });
        }
    }

    async isGerman() {
        const cfg = await this.getForeignObjectAsync('system.config').catch(() => null);
        return !!(cfg && cfg.common && cfg.common.language === 'de');
    }

    // ---------------------------------------------------------------- ioBroker

    onStateChange(id, state) {
        if (!state || state.ack || !this.mac) {
            return;
        }
        const key = id.split('.').pop();
        if (key === 'refresh') {
            this.enqueue('refresh', () => this.write(P.STATUS_REQ));
            return;
        }
        let bytes;
        try {
            bytes = P.encode(key, state.val);
        } catch (e) {
            this.log.warn(`${key}: ${e.message}`);
            return;
        }
        this.log.debug(`command ${key} = ${state.val}`);
        this.scheduleReadback();
        this.enqueue(key, async () => {
            await this.write(bytes);
            if (key === 'power' && bytes[2] === 0x00) {
                await sleep(WAKE_DELAY);
                await this.write(P.STATUS_REQ);
            }
        });
    }

    onUnload(callback) {
        this.stopping = true;
        clearTimeout(this.readbackTimer);
        clearTimeout(this.idleTimer);
        const timeout = sleep(3000);
        Promise.race([this.disconnect(), timeout])
            .catch(() => {})
            .finally(() => {
                try {
                    this.destroyBt && this.destroyBt();
                } catch {
                    // ignore
                }
                callback();
            });
    }
}

if (require.main !== module) {
    module.exports = options => new NubertSub(options);
} else {
    new NubertSub();
}
