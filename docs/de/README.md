# ioBroker.nubert-sub – Anleitung (Deutsch)

[English README](../../README.md)

Steuert einen **Nubert X-Sub** Subwoofer aus ioBroker per Bluetooth LE: an/Standby, Pegel, Tiefpass, Phase.
Hersteller: [Nubert electronic GmbH](https://www.nubert.de/).
**Inoffiziell**, nicht von Nubert. Nutzung auf eigene Gefahr.

## 1. Voraussetzungen

- Linux mit **BlueZ** und Bluetooth-LE-Adapter (eingebaut oder USB-Stick), max. ca. 10 m vom Sub
- ioBroker mit js-controller ≥ 6, Node.js ≥ 22

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

## 2. Adapter installieren

Im ioBroker-Admin: **Adapter** → nach „nubert-sub“ suchen → installieren, danach eine Instanz anlegen.
(Solange der Adapter neu ist, steht er im Repository „latest“.)

## 3. Einrichten

1. Sub am Strom, **X-Remote-App getrennt** (am Handy schließen).
2. Instanz-Einstellungen öffnen, **Sub suchen (10 s)** drücken.
   Die Adresse des nächstgelegenen Nubert-Geräts wird eingetragen und automatisch gespeichert.
3. Oder Adresse von Hand eintragen. Finden mit `bluetoothctl` → `scan le` → Zeile *nubert X-Sub*.

Weitere Einstellungen: Bluetooth-Adapter (leer = Standard, z. B. `hci1` für einen zweiten Stick),
Wartezeit für das Status-Rücklesen, Leerlaufzeit bis zum Trennen.

## 4. Status und Fehlermeldungen

- **Instanzstatus** („Verbunden mit Gerät oder Dienst“): grün, solange der Sub erreichbar ist,
  rot nach Start oder Befehl, wenn keine Verbindung zustande kam (5 Versuche).
- Datenpunkt **`error`**: Text des letzten Fehlers, beim nächsten Erfolg wieder leer.
- **Log**: `error` = Sub oder Bluetooth-Adapter nicht erreichbar, `warn` = einzelner Befehl fehlgeschlagen,
  `info` = Start, Suchergebnis, Verbindung brauchte mehrere Versuche, `debug` = alle gesendeten/empfangenen Bytes.
- Es gibt keine automatische Wiederholung im Hintergrund; der nächste Befehl oder `refresh` versucht es erneut.

## 5. Fehlerbehebung

| Meldung / Verhalten | Ursache / Lösung |
|---|---|
| *sub not reachable (… attempts; …)* | X-Remote-App schließen (solange sie verbunden ist, ist der Sub unsichtbar), Strom und Abstand prüfen. |
| *Sub suchen*: nichts gefunden | Sub ohne Strom, App verbunden oder zu weit weg. |
| *Bluetooth adapter … not available* | Kein Controller: siehe Schritt 1, oder falscher Name bei „Bluetooth-Adapter“. |
| Kernel-Log `command 0x200c tx timeout`, Stick setzt sich zurück | Bekanntes Problem von Realtek-RTL8761B-Sticks. Der Adapter versucht es erneut; ein Stick mit anderem Chip (Intel, CSR, Broadcom) behebt es. |
| Schalten dauert mehrere Sekunden | Erster Verbindungsversuch von BlueZ abgebrochen (`le-connection-abort-by-local`); neuer Versuch nach 1 s. Details im Debug-Log. |
