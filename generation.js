function random(min, max) {
    return min + Math.random() * (max - min);
}

function randomInt(min, max) {
    return Math.floor(random(min, max));
}

function randomTriangular(lower, upper, mode) {
    var c = (mode - lower) / (upper - lower);
    var u = Math.random();

    if (u <= c) {
        return lower + Math.sqrt(u * (upper - lower) * (mode - lower));
    } else {
        return upper - Math.sqrt((1 - u) * (upper - lower) * (upper - mode));
    }
}

const Generator = function(options) {
    if (!options) options = {};

    this.timer = null;
    this.start = 0; // time from start, get updated at register();
    this.course = (Math.random() * 360).toFixed(1); // last course, used to calculate next one
    this.lastLocationFixTimeStamp = (new Date()).getTime() - randomInt(1000, 2000);
    this.lastLocationFix = null;
    this.locationFixes = []; // location fixes get generated all the taime and added as batch when api called
    this.lastPos = { latitude: 0.0, longitude: 0.0 };
};

Generator.prototype.clean = function() {
    if (this.timer) {
        clearInterval(this.timer);
        this.timer = undefined;
    }
    this.client = undefined;
    this.lastLocationFix = undefined;
    this.locationFixes = [];
};

Generator.prototype.getLocFix = function(when, latitude, longitude, altitude) {
    const values = [5, 5, 5, 5, 10, 10, 10, 30, 30, 50, 65];
    values.unshift(Math.floor(Math.random() * (80 - 66)) + 66);
    this.client.playerLocationAccuracy = values[Math.floor(values.length * Math.random())];

    const junk = Math.random() < 0.03;
    const loc = {
        provider: 'fused',
        latitude: junk ? 360.0 : latitude,
        longitude: junk ? 360.0 : longitude,
        altitude: junk ? 0.0 : (altitude || randomTriangular(300, 400, 350)),
        provider_status: 3,
        location_type: 1,
        floor: 0,
        course: -1,
        speed: -1,
    };
    if (Math.random() < 0.85) {
        loc.course = randomTriangular(0, 359.9, this.course);
        loc.speed = randomTriangular(0.25, 9.7, 8.2);
        this.course = loc.course;
    }
    if (this.client.playerLocationAccuracy >= 65) {
        loc.vertical_accuracy = randomTriangular(35, 100, 65);
    } else if (this.client.playerLocationAccuracy > 10) {
        loc.vertical_accuracy = [24, 32, 48, 48, 64, 64, 96, 128][randomInt(0, 8)];
    } else {
        loc.vertical_accuracy = [3, 4, 6, 6, 8, 12, 24][randomInt(0, 8)];
    }
    loc.horizontal_accuracy = this.client.playerLocationAccuracy;
    loc.timestamp_snapshot = when - this.start + randomInt(-100, 100);

    return loc;
};

Generator.prototype.updateLocFixes = function(when) {
    when = +when || (new Date()).getTime();
    const moving = (this.client.playerLatitude !== this.lastPos.latitude)
                    || (this.client.playerLongitude !== this.lastPos.longitude);

    this.lastPos = { latitude: this.client.playerLatitude, longitude: this.client.playerLongitude };
    if (this.lastLocationFix == null || moving || Math.random() > 0.85) {
        const loc = this.getLocFix(
            when,
            this.client.playerLatitude,
            this.client.playerLongitude,
            this.client.playerAltitude
        );
        this.lastLocationFix = loc;
        this.locationFixes.push(loc);
        this.lastLocationFixTimeStamp = when;
    }
};

Generator.prototype.generate = function(envelope) {
    const infos = {};

    // be sure data is consistent with last location fix
    envelope.accuracy = this.lastLocationFix.horizontal_accuracy;
    envelope.ms_since_last_locationfix = (new Date()).getTime() - this.lastLocationFixTimeStamp;

    // unknown for now, so random
    infos.unknown27 = randomInt(1000, 60000);

    // device info (iPhone 6s)
    infos.device_info = {
        device_id: this.deviceId,
        device_brand: 'Apple',
        device_model: 'iPhone',
        device_model_boot: 'iPhone8,1',
        hardware_manufacturer: 'Apple',
        hardware_model: 'N71AP',
        firmware_brand: 'iOS',
        firmware_type: '10.3.3',
    };

    infos.activity_status = {
        stationary: true,
    };

    infos.sensor_info = [{
        timestamp_snapshot: (this.lastLocationFixTimeStamp - this.start) + randomInt(-800, 800),
        linear_acceleration_x: randomTriangular(-1.5, 2.5, 0),
        linear_acceleration_y: randomTriangular(-1.2, 1.4, 0),
        linear_acceleration_z: randomTriangular(-1.4, 0.9, 0),
        magnetic_field_x: randomTriangular(-54, 50, 0),
        magnetic_field_y: randomTriangular(-51, 57, -4.8),
        magnetic_field_z: randomTriangular(-56, 43, -30),
        magnetic_field_accuracy: [-1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2][randomInt(0, 7)],
        attitude_pitch: randomTriangular(-1.5, 1.5, 0.4),
        attitude_yaw: randomTriangular(-1.56, 3.1, 0.1),
        attitude_roll: randomTriangular(-3.1, 3.1, 0),
        rotation_rate_x: randomTriangular(-3.1, 3.6, 0),
        rotation_rate_y: randomTriangular(-3.1, 4.8, 0),
        rotation_rate_z: randomTriangular(-6, 3.5, 0),
        gravity_x: randomTriangular(-1, 1, 0.01),
        gravity_y: randomTriangular(-1, 1, -0.4),
        gravity_z: randomTriangular(-1, 1, -0.4),
        status: 3,
    }];

    infos.location_fix = this.locationFixes;

    return infos;
};

Generator.prototype.generateFromTimer = function(envelope) {
    // be sure getmapobject coords are consistent with last location update
    if (this.lastLocationFix.latitude !== this.client.playerLatitude
        && this.lastLocationFix.longitude !== this.client.playerLongitude) {
        // update
        const sinceLatest = (new Date()).getTime() - this.lastLocationFixTimeStamp;
        this.updateLocFixes((new Date()).getTime() - Math.floor(sinceLatest / 2));
    }

    if (this.locationFixes.length === 0) {
        this.locationFixes = [this.lastLocationFix];
    }

    return this.generate(envelope);
};

Generator.prototype.generateFromGuess = function(envelope) {
    const sinceLatest = (new Date()).getTime() - this.lastLocationFixTimeStamp;
    const seconds = Math.round(sinceLatest / 1000) || 1;

    const step = {
        latitude: (this.client.playerLatitude - this.lastPos.latitude) / seconds,
        longitude: (this.client.playerLongitude - this.lastPos.longitude) / seconds,
    };
    this.locationFixes = [];
    for (let i = 1; i <= seconds; i++) {
        const when = this.lastLocationFixTimeStamp + 1000;
        const pos = {
            latitude: this.lastPos.latitude + i * step.latitude,
            longitude: this.lastPos.longitude + i * step.longitude,
        };
        this.locationFixes.push(this.getLocFix(when, pos.latitude, pos.longitude, 0));
    }
    this.lastLocationFix = this.locationFixes[this.locationFixes.length - 1];

    const infos = this.generate(envelope);

    this.lastLocationFixTimeStamp = (new Date()).getTime();
    this.lastPos = { latitude: this.client.playerLatitude, longitude: this.client.playerLongitude };
    this.locationFixes = [];

    return infos;
};

Generator.prototype.register = function(client, deviceId, useTimer = true) {
    this.client = client;
    if (!deviceId) {
        deviceId = '';
        for (let i = 0; i < 32; i++) {
            deviceId += '0123456789abcdef'[Math.floor(Math.random() * 16)];
        }
    }
    this.deviceId = deviceId;

    this.start = (new Date()).getTime() - randomInt(4500, 5500);
    this.lastPos = { latitude: client.playerLatitude, longitude: client.playerLongitude };

    if (this.timer) {
        clearInterval(this.timer);
    }
    if (useTimer) {
        this.timer = setInterval(this.updateLocFixes.bind(this), 900);
        this.updateLocFixes();

        client.setOption('signatureInfo', this.generateFromTimer.bind(this));
    } else {
        client.setOption('signatureInfo', this.generateFromGuess.bind(this));
    }
};

exports.Generator = Generator;
