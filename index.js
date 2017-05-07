const encryption = require('node-pogo-signature');
const signature = require('./generation');
const versions = require('./versions');

module.exports = {
    signature: signature,
    encryption: encryption,
    versions: versions,
};