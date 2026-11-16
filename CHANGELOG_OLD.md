# Older changes

## 0.3.0
- `info.connection` now means "sub reachable": instance status stays green between commands
- New state `bleConnected` for the short BLE link
- Failed connects (5 attempts) are logged as error and turn the instance status red
- Search saves the found address automatically

## 0.2.0
- Button "Search sub" in the instance settings
- Setup guide (EN/DE) for Raspberry Pi, Debian/Ubuntu, Proxmox, Docker
- Adapter keeps running without configured address (needed for the search)

## 0.1.1
- Faster connect retries (BlueZ `le-connection-abort-by-local`)

## 0.1.0
- Initial version
