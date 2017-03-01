let encryption = require('node-pogo-signature');
let signature = require('./pogobuf.signature');

module.exports = {
    signature: signature,
    encryption: encryption,
};