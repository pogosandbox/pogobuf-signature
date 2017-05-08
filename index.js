const encryption = require('./encryption');
const signature = require('./generation');
const versions = require('./versions');

module.exports = {
    signature: signature,
    encryption: encryption,
    versions: versions,
};
