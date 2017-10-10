'use strict';

const Utils = require('./utils');
const crypto = require('crypto');
const Long = require('long');

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
        this.ProtoSignature = options.protos.Networking.Envelopes.Signature;
    } else {
        throw new Error('Passing protos object is now mandatory.');
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
    } else {
        this.authTicket = authTicket.constructor.encode(authTicket).finish();
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
        if (request.constructor.encode) {
            byteRequests.push(request.constructor.encode(request).finish().toString('base64'));
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

            const signature = this.ProtoSignature.fromObject(signatureData);

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
            const buffer = this.ProtoSignature.encode(response).finish();
            this.utils.encrypt(buffer, +response.timestamp_since_start, cb);
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

    if (this.version.startsWith('0.69')) return Long.fromString('5395925083854747393', false);
    else if (this.version.startsWith('0.73')) return Long.fromString('-960786418476827155', false, 10);
    else if (this.version.startsWith('0.75')) return Long.fromString('-960786418476827155', false, 10);
    else if (this.version.startsWith('0.77')) return Long.fromString('-6553495230586135539', false, 10);
    
    throw new Error('Unsupported encryption for version ' + this.version);
};

module.exports = Builder;
