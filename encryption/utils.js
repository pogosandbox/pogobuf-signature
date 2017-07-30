'use strict';

const pcrypt = require('./pcrypt/pcrypt');
const http = require('http');
const https = require('https');
const errors = require('./errors');
const Long = require('long');
const urlmodule = require('url');

const Utils = function() {};

/*
 * Enable this if you're offseting to a hashing server
 */
Utils.prototype.pokeHashUrl = null;
Utils.prototype.pokeHashKey = null;

/*
 * Should we be using a hashing server to complete the requests
 */
Utils.prototype.useHashingServer = function(url, key) {
    this.pokeHashUrl = url;
    this.pokeHashKey = key;
};

/**
 * accepts an input buffer and returns the corresponding encrypted output
 * @param {Buffer} input - raw bytes to encrypt (typically encoded from a protobuf object)
 * @param {Number} msSinceStart - the time since your request started, must match what you're sending in the signture
 * @param {encryptCallback} cb - function to be called when encryption is completed
 */
Utils.prototype.encrypt = function(input, msSinceStart, cb) {
    if (isNaN(+msSinceStart)) {
        cb('Must provide a valid timestamp');
    } else {
        cb(null, pcrypt.encrypt(input, msSinceStart));
    }
};

/*
 * Converts the location into a buffer
 */
Utils.prototype.locationToBuffer = function(lat, lng, accuracy) {
    const payload = new Buffer(24);
    payload.writeDoubleBE(lat, 0);
    payload.writeDoubleBE(lng, 8);
    payload.writeDoubleBE(accuracy || 0, 16);
    return payload;
};

function doubleToLong(value) {
    var view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    return new Long(view.getInt32(4), view.getInt32(0), false).toString();
}

/**
 * hashing function used to generate the full hash, returns raw ready to be put into signature
 * @param {Buffer} authTicket - protobuf encoded auth_ticket to use for hashing
 * @param {number} latitude - latitude
 * @param {number} longitude - longitude
 * @param {number} accuracy - accuracy
 * @param {long} timestamp - Timestamp since start
 * @param {ByteArray} sessionData - Array of requests in byte format
 * @param {request[]} requests - requests to hash
 * @returns {Promise}
 */
Utils.prototype.hashWithServer = function(authTicket, latitude, longitude, accuracy, timestamp, sessionData, requests) {
    if (arguments.length !== 7) {
        throw new Error(`Missing parameter, expected 7 got ${arguments.length}`);
    }

    let requestData = JSON.stringify({
        Timestamp: timestamp,
        Latitude64: 'LatValue',
        Longitude64: 'LngValue',
        Accuracy64: 'AccuracyValue',
        AuthTicket: authTicket.toString('base64'),
        SessionData: sessionData.toString('base64'),
        Requests: requests,
    });

    // dirty hack to be able to send int64 as number in JSON
    requestData = requestData.replace('"LatValue"', doubleToLong(latitude));
    requestData = requestData.replace('"LngValue"', doubleToLong(longitude));
    requestData = requestData.replace('"AccuracyValue"', doubleToLong(accuracy));

    return new Promise((resolve, fail) => {
        const url = urlmodule.parse(this.pokeHashUrl);
        const httpmodule = url.protocol === 'https' ? https : http;

        const req = httpmodule.request({
            host: url.hostname,
            port: url.port,
            method: 'POST',
            path: url.path,
            headers: {
                'X-AuthToken': this.pokeHashKey,
                'content-type': 'application/json',
                'User-Agent': 'pogobuf-signature',
            }
        }, res => {
            let data = '';
            res.setEncoding('utf-8');
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                this.rateInfos = {
                    authtoken: res.headers['x-authtoken'],
                    maxrequestcount: res.headers['x-maxrequestcount'],
                    ratelimitseconds: res.headers['x-ratelimitseconds'],
                    rateperiodend: res.headers['x-rateperiodend'],
                    raterequestsremaining: res.headers['x-raterequestsremaining'],
                    expiration: res.headers['x-authtokenexpiration'],
                };
                switch (res.statusCode) {
                    case 200:
                        try {
                            const body = data.replace(/(-?\d{16,})/g, '"$1"');
                            const result = JSON.parse(body);
                            if (!result && !result.locationHash) throw new Error();
                            resolve({
                                location1: result.locationAuthHash,
                                location2: result.locationHash,
                                request_hash: result.requestHashes,
                            });
                        } catch (e) {
                            fail(new errors.HashServerError('Error parsing data', res.statusCode, data));
                        }
                        break;

                    case 400:
                        fail(new errors.HashServerError('Bad request to hashing server', res.statusCode, data, false));
                        break;

                    case 429:
                        fail(new errors.HashServerError('Request limited', res.statusCode, data));
                        break;

                    case 401:
                        fail(new errors.HashServerError('Invalid key sent to hashing server',
                            res.statusCode, data, false));
                        break;

                    default:
                        fail(new errors.HashServerError(`Unknown failure ${res.statusCode}`, res.statusCode, data));
                        break;
                }
            });
        });
        req.on('error', e => { fail(new errors.HashServerError('Unknown failure', 0, e)); });
        req.write(requestData);
        req.end();
    });
};

module.exports = Utils;