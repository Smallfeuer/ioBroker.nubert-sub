# ioBroker.nubert-sub

Control a **Nubert X-Sub** subwoofer from ioBroker via Bluetooth LE.

> **Unofficial project.** Not affiliated with, endorsed or supported by Nubert electronic GmbH.
> "Nubert" and "X-Sub" are trademarks of their respective owner and are used here only to describe
> which device this adapter works with. Use at your own risk.

## Features

| State | Type | Description |
|---|---|---|
| `power` | boolean, rw | on (`true`) / standby (`false`) |
| `level` | number, rw | level in dB, −15 … +6 |
| `lowpass` | number, rw | low-pass frequency in Hz, 35 … 140 (5 Hz steps) |
| `phase180` | boolean, rw | phase 0° / 180° |
| `roomEq` | boolean, ro | room EQ active |
| `refresh` | button | read status now |
| `firmware`, `lastReply`, `error` | string, ro | diagnostics |
| `raw` | string, rw | send raw hex bytes (experts only) |
| `info.connection` | boolean, ro | BLE connection currently open |

The sub accepts **only one BLE connection**. The adapter therefore connects on demand and
disconnects a few seconds after the last activity, so the vendor app can still be used.

Status is read at start-up, right after switching on, and once after the last command
(default 60 s). There is no periodic polling.

## Requirements

- Linux with **BlueZ** (`bluetoothd` running) and a Bluetooth LE adapter
- The ioBroker user must be allowed to talk to BlueZ over D-Bus
  (default on Debian/Ubuntu; otherwise add the user to the `bluetooth` group)
- Node.js ≥ 20

## Configuration

- **Bluetooth address** of the sub (shown e.g. by `bluetoothctl scan le` as "nubert X-Sub")
- Bluetooth adapter (empty = default)
- Delay of the status read-back after the last command
- Idle time until disconnect

## Notes

- While the vendor app is connected, the sub is invisible to the adapter.
- On first use the device is searched once and then marked as *trusted* in BlueZ,
  later connections need no search.
- Some Realtek adapters (RTL8761B) occasionally fail with `command 0x200c tx timeout`
  and reset themselves. The adapter retries; a different adapter chip avoids this.

## Protocol

Protocol details were determined for interoperability purposes. See also the independent
projects [nubertctl](https://github.com/trougnouf/nubertctl) and
[nubert-bluetooth](https://www.npmjs.com/package/nubert-bluetooth).

## Changelog

### 0.1.1
- Faster connect retries (BlueZ `le-connection-abort-by-local`)

### 0.1.0
- Initial version

## License

MIT License, see [LICENSE](LICENSE).
