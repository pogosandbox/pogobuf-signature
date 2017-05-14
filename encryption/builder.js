'use strict';

const protobuf = require('protobufjs');
const Utils = require('./utils');
const crypto = require('crypto');
const Long = require('long');
const path = require('path');

let ProtoSignature = protobuf.loadProtoFile(path.join(__dirname, 'proto', 'Signature.proto')).build().Signature;

/**
 * the signature builder
 * @constructor
 * @param {Object} [options] - a set of options and defaults to send to the signature builder
 * @param {number} [options[].initTime] - time in ms to use as the app's startup time
 * @param {Buffer} [options[].unk22] - a 32-byte Buffer to use as `unk22`
 * @param {String} [options[].version] - The version to run on, defaults to 0.45
 */
const Builder = function(options) {
    if (!options) options = {};
    this.initTime = options.initTime || new Date().getTime();
    this.time_since_start = options.time_since_start || null;
    this.time = options.time || null;
    this.version = options.version || '0.45';
    this.forcedUk25 = options.uk25 || null;
    if (options.protos) {
        ProtoSignature = options.protos.Networking.Envelopes.Signature;
    }

    this.utils = new Utils();

    this.fields = {
        session_hash: options.session_hash || options.unk22 || crypto.randomBytes(16)
    };
};

/**
 * sets the location to be used in signature building
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @param {number} [accuracy=0] - accuracy
 */
Builder.prototype.setLocation = function(lat, lng, accuracy) {
    this.lat = lat;
    this.lng = lng;
    this.accuracy = accuracy || 0;
};

/**
 * sets the auth_ticket to be used in signature building
 * @param {Buffer|Object} authTicket - protobufjs constructor OR raw buffer containing bytes (must pass true for `isEncoded` when passing a Buffer)
 * @param {boolean} [isEncoded=false] - set to true if the authTicket is a protobuf encoded Buffer
 */
Builder.prototype.setAuthTicket = function(authTicket, isEncoded) {
    if (isEncoded) {
        this.authTicket = authTicket;
    } else if (authTicket.encode) {
        this.authTicket = authTicket.encode().toBuffer();
    }
};

/**
 * merges a set of key-values into the internally stored fields for the signature
 * @param {Object} fields - key-value mapping for siganture fields
 */
Builder.prototype.setFields = function(fields) {
    for (const field in fields) {
        this.fields[field] = fields[field];
    }
};

/*
 * Enables hashing server rather than native
 */
Builder.prototype.useHashingServer = function(url, key) {
    this.utils.useHashingServer(url, key);
};

/**
 * builds an unencrypted signature returned as a protobuf object or Buffer
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @returns {Promise}
 */
Builder.prototype.buildSignature = function(requests) {
    if (!Array.isArray(requests)) {
        requests = [requests];
    }

    const byteRequests = [];
    for (const request of requests) {
        if (request.encode) {
            byteRequests.push(request.encode().toBuffer().toString('base64'));
        } else {
            byteRequests.push(request.toString('base64'));
        }
    }

    const msSinceStart = this.time_since_start || (new Date().getTime() - this.initTime);
    const timestamp = this.time || new Date().getTime();

    // Do the hashing, get the response back and build the signature
    return this.utils.hashWithServer(this.authTicket, this.lat, this.lng, this.accuracy,
                                     timestamp, this.fields.session_hash, byteRequests)
    .then(response => {
        this.rateInfos = this.utils.rateInfos;
        const signatureData = {
            location_hash1: response.location1,
            location_hash2: response.location2,
            timestamp: timestamp,
            timestamp_since_start: msSinceStart,
            unknown25: this.getUk25()
        };

        for (const field in this.fields) {
            signatureData[field] = this.fields[field];
        }

        const signature = new ProtoSignature(signatureData);

        const requestHashes = [];
        if (response.request_hash) {
            if (!Array.isArray(response.request_hash)) {
                response.request_hash = [response.request_hash];
            }

            for (const element of response.request_hash) {
                requestHashes.push(Long.fromString(String(element), true, 10));
            }
        }

        signature.request_hash = requestHashes;
        return signature;
    });
};

/**
 * builds a signature given requests, and encrypts it afterwards
 * @global
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @param {encryptCallback} cb - function to be called when encryption is completed
 */
Builder.prototype.encrypt = function(requests, cb) {
    this.buildSignature(requests)
    .then(response => {
        this.utils.encrypt(response.encode().toBuffer(), +response.timestamp_since_start, cb);
    })
    .catch(e => {
        cb(e, null);
    });
};

Builder.prototype.getUk25 = function() {
    // if forced uk25 was passed in option, use it
    // we suppose unsigned negative long is a string is passed
    if (this.forcedUk25) {
        if (Long.isLong(this.forcedUk25)) return this.forcedUk25;
        else return Long.fromString(this.forcedUk25, false);
    }

    // if (this.version.startsWith('0.45')) return longjs.fromString('-816976800928766045', false);
    // else if (this.version.startsWith('0.51')) return longjs.fromString('-8832040574896607694', false);
    // else if (this.version.startsWith('0.53')) return longjs.fromString('-76506539888958491', false);
    // else if (this.version.startsWith('0.55')) return longjs.fromString('-9156899491064153954', false);
    // else if (this.version.startsWith('0.57')) return longjs.fromString('-816976800928766045', false);
    // else if (this.version.startsWith('0.59')) return longjs.fromString('-3226782243204485589', false);
    // else throw new Error('Unhandled config version: ' + this.version);

    // 0.63
    if (this.version.startsWith('0.63')) return Long.fromString('5348175887752539474', false);
    // 0.61
    else return Long.fromString('1296456256998993698', false);
};

module.exports = Builder;
