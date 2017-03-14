
let toIosVersion = function(version) {
    let iosVersion = '1.' + ((+version - 3000) / 100).toFixed(0);
    iosVersion += '.' + (+version % 100);
    return iosVersion;
}
module.exports.toIosVersion = iosVersion;

module.exports.getHashingEndpoint = function(server, version, callback) {
    return request.get(server + 'api/hash/versions').then(response => {
        const versions = JSON.parse(response.body);
        if (!versions) throw new Error('Invalid initial response from hashing server');

        let iosVersion = toIosVersion(version);

        self.hashingVersion = versions[iosVersion];

        if (!self.hashingVersion) {
            throw new Error('Unsupported version for hashserver: ' + self.options.version + '/' + iosVersion);
        }

        return true;
    });
}