# ioBroker.nubert-sub

Control a **Nubert X-Sub** subwoofer from ioBroker via Bluetooth LE.

> **Unofficial project.** Not affiliated with, endorsed or supported by Nubert electronic GmbH.
> "Nubert" and "X-Sub" are trademarks of their respective owner and are used here only to describe
> which device this adapter works with. Use at your own risk.

**[Deutsche Anleitung weiter unten](#deutsch)**

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

The sub accepts **only one BLE connection**. The adapter connects on demand and disconnects a few
seconds after the last activity, so the X-Remote app can still be used in between.
Status is read at start-up, right after switching on, and once after the last command (default 60 s).
There is no periodic polling.

## Setup guide

### 1. Requirements

- Linux with **BlueZ** and a Bluetooth LE adapter (built-in or USB dongle), within ~10 m of the sub
- ioBroker with js-controller ≥ 5, Node.js ≥ 20

Check on the ioBroker machine:

```bash
bluetoothctl show        # must list a controller with "Powered: yes"
```

| Platform | What to do |
|---|---|
| **Raspberry Pi OS** | Usually nothing. If `bluetoothctl show` says *No default controller available*: `sudo rfkill unblock bluetooth && sudo systemctl enable --now bluetooth` |
| **Debian / Ubuntu** | `sudo apt install bluez && sudo systemctl enable --now bluetooth` |
| **Proxmox VM** | Pass the USB dongle through to the VM: `qm set <vmid> -usb1 host=<vendor>:<product>` (IDs from `lsusb` on the host). Do not use the dongle on the host at the same time. Inside the VM install BlueZ as above. |
| **Docker** *(untested)* | BlueZ runs on the host. Mount the system D-Bus into the container: `-v /run/dbus:/run/dbus:ro` |
| **Proxmox LXC** *(untested)* | Like Docker: BlueZ on the host, bind-mount `/run/dbus` into the container |

If the log shows `org.freedesktop.DBus.Error.AccessDenied`, allow the ioBroker user to use BlueZ:

```bash
sudo usermod -aG bluetooth iobroker
iobroker restart
```

### 2. Install the adapter

Not in the ioBroker repository yet, so install it from GitHub:

- Admin → **Adapters** → GitHub icon (*Install from custom URL*) → tab **Custom** →
  `https://github.com/Smallfeuer/ioBroker.nubert-sub` → Install
- or on the command line: `iobroker url https://github.com/Smallfeuer/ioBroker.nubert-sub`

Then add an instance.

### 3. Configure

1. Make sure the sub is powered and the **X-Remote app is disconnected** (close it on the phone).
2. Open the instance settings and press **Search sub (10 s)**.
   The address of the nearest Nubert device is entered automatically. Press **Save**.
3. Alternatively enter the address by hand. Find it with `bluetoothctl` → `scan le` → line *nubert X-Sub*.

Other settings: Bluetooth adapter (empty = default, e.g. `hci1` for a second dongle),
delay of the status read-back, idle time until disconnect.

### 4. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| *no BLE connection (is the vendor app connected?)* | Close the X-Remote app. While it is connected the sub is invisible. |
| *Search sub*: nothing found | Sub without power, app connected, or too far away. |
| *Bluetooth adapter … not available* | No controller: see step 1, or wrong name in "Bluetooth adapter". |
| Kernel log `command 0x200c tx timeout`, adapter resets | Known issue of Realtek RTL8761B dongles. The adapter retries; a dongle with another chip (Intel, CSR, Broadcom) avoids it. |
| Switching takes several seconds | First connect attempt aborted by BlueZ (`le-connection-abort-by-local`); the adapter retries after 1 s. Enable debug log for details. |

## Protocol

Protocol details were determined for interoperability purposes. See also the independent
projects [nubertctl](https://github.com/trougnouf/nubertctl) and
[nubert-bluetooth](https://www.npmjs.com/package/nubert-bluetooth).

---

## Deutsch

Steuert einen **Nubert X-Sub** Subwoofer aus ioBroker per Bluetooth LE: an/Standby, Pegel, Tiefpass, Phase.
**Inoffiziell**, nicht von Nubert. Nutzung auf eigene Gefahr.

### 1. Voraussetzungen

- Linux mit **BlueZ** und Bluetooth-LE-Adapter (eingebaut oder USB-Stick), max. ca. 10 m vom Sub
- ioBroker mit js-controller ≥ 5, Node.js ≥ 20

Prüfen auf dem ioBroker-Rechner:

```bash
bluetoothctl show        # muss einen Controller mit "Powered: yes" zeigen
```

| System | Was tun |
|---|---|
| **Raspberry Pi OS** | Meist nichts. Bei *No default controller available*: `sudo rfkill unblock bluetooth && sudo systemctl enable --now bluetooth` |
| **Debian / Ubuntu** | `sudo apt install bluez && sudo systemctl enable --now bluetooth` |
| **Proxmox-VM** | USB-Dongle an die VM durchreichen: `qm set <vmid> -usb1 host=<vendor>:<product>` (IDs per `lsusb` am Host). Den Dongle nicht gleichzeitig am Host nutzen. In der VM BlueZ wie oben. |
| **Docker** *(ungetestet)* | BlueZ läuft am Host. System-D-Bus in den Container einbinden: `-v /run/dbus:/run/dbus:ro` |
| **Proxmox-LXC** *(ungetestet)* | Wie Docker: BlueZ am Host, `/run/dbus` in den Container einbinden |

Steht im Log `org.freedesktop.DBus.Error.AccessDenied`:

```bash
sudo usermod -aG bluetooth iobroker
iobroker restart
```

### 2. Adapter installieren

Noch nicht im ioBroker-Katalog, deshalb von GitHub:

- Admin → **Adapter** → GitHub-Symbol (*Installieren aus eigener URL*) → Reiter **Benutzerdefiniert** →
  `https://github.com/Smallfeuer/ioBroker.nubert-sub` → Installieren
- oder per Konsole: `iobroker url https://github.com/Smallfeuer/ioBroker.nubert-sub`

Danach eine Instanz anlegen.

### 3. Einrichten

1. Sub am Strom, **X-Remote-App getrennt** (am Handy schließen).
2. Instanz-Einstellungen öffnen, **Sub suchen (10 s)** drücken.
   Die Adresse des nächstgelegenen Nubert-Geräts wird eingetragen. **Speichern** drücken.
3. Oder Adresse von Hand eintragen. Finden mit `bluetoothctl` → `scan le` → Zeile *nubert X-Sub*.

Weitere Einstellungen: Bluetooth-Adapter (leer = Standard, z. B. `hci1` für einen zweiten Stick),
Wartezeit für das Status-Rücklesen, Leerlaufzeit bis zum Trennen.

### 4. Fehlerbehebung

| Meldung / Verhalten | Ursache / Lösung |
|---|---|
| *no BLE connection (is the vendor app connected?)* | X-Remote-App schließen. Solange sie verbunden ist, ist der Sub unsichtbar. |
| *Sub suchen*: nichts gefunden | Sub ohne Strom, App verbunden oder zu weit weg. |
| *Bluetooth adapter … not available* | Kein Controller: siehe Schritt 1, oder falscher Name bei „Bluetooth-Adapter“. |
| Kernel-Log `command 0x200c tx timeout`, Stick setzt sich zurück | Bekanntes Problem von Realtek-RTL8761B-Sticks. Der Adapter versucht es erneut; ein Stick mit anderem Chip (Intel, CSR, Broadcom) behebt es. |
| Schalten dauert mehrere Sekunden | Erster Verbindungsversuch von BlueZ abgebrochen (`le-connection-abort-by-local`); neuer Versuch nach 1 s. Details im Debug-Log. |

## Changelog

### 0.2.0
- Button "Search sub" in the instance settings
- Setup guide (EN/DE) for Raspberry Pi, Debian/Ubuntu, Proxmox, Docker
- Adapter keeps running without configured address (needed for the search)

### 0.1.1
- Faster connect retries (BlueZ `le-connection-abort-by-local`)

### 0.1.0
- Initial version

## License

MIT License, see [LICENSE](LICENSE).
