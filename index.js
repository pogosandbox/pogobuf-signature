const encryption = require('node-pogo-signature');
const signature = require('./pogobuf.signature');

module.exports = {
    signature: signature,
    encryption: encryption,
};