const request = require('request');

const toIosVersion = function(version) {
    let iosVersion = '1.' + ((+version - 3000) / 100).toFixed(0);
    iosVersion += '.' + (+version % 100);
    return iosVersion;
};
module.exports.toIosVersion = toIosVersion;

module.exports.getHashingEndpoint = function(server, version) {
    return new Promise((resolve, reject) => {
        request.get(server + 'api/hash/versions', (error, response) => {
            if (error) return reject(error);

            const versions = JSON.parse(response.body);
            if (!versions) throw new Error('Invalid initial response from hashing server');

            const iosVersion = toIosVersion(version);
            const hashingVersion = versions[iosVersion];

            if (!hashingVersion) {
                return reject('Unsupported version for hashserver: ' + version + '/' + iosVersion);
            } else {
                return resolve(hashingVersion);
            }
        });
    });
};
