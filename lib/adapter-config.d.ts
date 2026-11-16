// Types of the instance settings (io-package.json "native"), used by the type check.
export {};

declare global {
    namespace ioBroker {
        interface AdapterConfig {
            mac: string;
            hci: string;
            readbackDelay: number;
            idleDisconnect: number;
            characteristic: string;
        }
    }
}
