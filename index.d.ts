
declare namespace signature {
    export module signature {
        /**
         * Register this signature generation in pogobuf.
         * @param {pogobuf.Client} client pogobuf client object
         * @param {string} deviceId deviceId to use in signature. if none is passed a random one is generated
         */
        function register(client: any, deviceId: string): void;

        /**
         * To be called to clean up ressource. Should be called if you want to delete client or reuse
         * client before reiinit
         */
        function clean(): void;
    }

    export module encryption {
        
        export class Builder {
            /**
             * the signature builder
             * @constructor
             * @param {Object} [options] - a set of options and defaults to send to the signature builder
             * @param {number} [options[].initTime] - time in ms to use as the app's startup time
             * @param {Buffer} [options[].unk22] - a 32-byte Buffer to use as `unk22`
             * @param {String} [options[].version] - The version to run on, defaults to 0.45
             */
            constructor(options?: Object);

            /**
             * sets the location to be used in signature building
             * @param {number} lat - latitude
             * @param {number} lng - longitude
             * @param {number} [accuracy=0] - accuracy
             */
            setLocation(lat: number, lng: number, accuracy?: number): void;

            /**
             * sets the auth_ticket to be used in signature building
             * @param {Buffer|Object} authTicket - protobufjs constructor OR raw buffer containing bytes (must pass true for `isEncoded` when passing a Buffer)
             * @param {boolean} [isEncoded=false] - set to true if the authTicket is a protobuf encoded Buffer
             */
            setAuthTicket(authTicket:Buffer|Object, isEncoded?: boolean): void;

            /**
             * merges a set of key-values into the internally stored fields for the signature
             * @param {Object} fields - key-value mapping for siganture fields
            */
            setFields(fields:Object): void;

            /**
             * Enables hashing server rather than native
             * @param {string} url url of the hashing server endpoint to use
             * @param {string} key hash key to use to authenticate to the hash server
             */
            useHashingServer(url: string, key: string): void;

            /**
             * builds an unencrypted signature returned as a protobuf object or Buffer
             * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
             * @returns {Promise}
             */
            buildSignature(request: Object|Object[]|Buffer|Buffer[]): Promise<any>;
        }

        export module Utils {

        }
    }

    export module versions {
        /**
         * Convert an app version (i.e. 5704) to ios version (1.27.4)
         * @param {string|number} version app version (ex: 5704)
         * @return {string} iosversion ios version (ex: 1.27.4)
         */
        function toIosVersion(version: string|number): string;

        /**
         * Get correct endpoint based on app version
         * @param {string} server - hashing server url 
         * @param {string|number} version app version (ex: 5704)
         * @return {string} hash endpoint to call
         */
        function getHashingEndpoint(server: string, version: string|number): string;
    }
}