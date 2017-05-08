const encryption = require('./encryption');
const pcrypt = require('./encryption/pcrypt/pcrypt');
const signature = require('./generation');
const versions = require('./versions');

module.exports = {
    signature: signature,
    encryption: encryption,
    versions: versions,
    pcrypt: pcrypt,
};
