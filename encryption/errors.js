const util = require('util');

module.exports.HashServerError = function HashServerError(message, status, data, retry = true) {
    Error.captureStackTrace(this, this.constructor);
    this.name = 'SignatureError: ' + this.constructor.name;
    this.message = message;
    this.status = status;
    this.data = data;
    this.retry = retry;
};
util.inherits(module.exports.HashServerError, Error);
