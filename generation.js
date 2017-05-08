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
    this.lastLocationFixTimeStamp = new Date().getTime() - randomInt(1000, 2000);
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

Generator.prototype.updateLocFixes = function(when) {
    when = when || new Date().getTime();
    const moving = (this.client.playerLatitude !== this.lastPos.latitude)
                    || (this.client.playerLongitude !== this.lastPos.longitude);

    this.lastPos = { latitude: this.client.playerLatitude, longitude: this.client.playerLongitude };
    if (this.lastLocationFix == null || moving || Math.random() > 0.85) {
        const values = [5, 5, 5, 5, 10, 10, 10, 30, 30, 50, 65];
        values.unshift(Math.floor(Math.random() * (80 - 66)) + 66);
        this.client.playerLocationAccuracy = values[Math.floor(values.length * Math.random())];

        const junk = Math.random() < 0.03;
        const loc = {
            provider: 'fused',
            latitude: junk ? 360.0 : this.client.playerLatitude,
            longitude: junk ? 360.0 : this.client.playerLongitude,
            altitude: junk ? 0.0 : (this.client.playerAltitude || randomTriangular(300, 400, 350)),
            provider_status: 3,
            location_type: 1,
            floor: 0,
            course: -1,
            speed: -1,
        };
        if (Math.random() < 0.95) {
            loc.course = randomTriangular(0, 359.9, this.course);
            loc.speed = randomTriangular(0.2, 4.25, 1);
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

        this.lastLocationFix = loc;
        this.locationFixes.push(loc);
        this.lastLocationFixTimeStamp = when;
    }
};

Generator.prototype.generate = function(envelope) {
    const infos = {};

    // be sure getmapobject coords are consistent with last location update
    if (this.lastLocationFix.latitude !== this.client.playerLatitude
        && this.lastLocationFix.longitude !== this.client.playerLongitude) {
        // update
        var sinceLatest = new Date().getTime() - this.lastLocationFixTimeStamp;
        this.updateLocFixes(new Date().getTime() - Math.floor(sinceLatest / 2));
    }

    if (this.locationFixes.length > 0) {
        infos.location_fix = this.locationFixes;
        this.locationFixes = [];
    } else {
        infos.location_fix = [this.lastLocationFix];
    }

    // be sure data is consistent with last location fix
    envelope.accuracy = this.lastLocationFix.horizontal_accuracy;
    envelope.ms_since_last_locationfix = new Date().getTime() - this.lastLocationFixTimeStamp;

    infos.device_info = {
        device_id: this.deviceId,
        device_brand: 'Apple',
        device_model: 'iPhone',
        device_model_boot: 'iPhone8,1',
        hardware_manufacturer: 'Apple',
        hardware_model: 'N71AP',
        firmware_brand: 'iOS',
        firmware_type: '10.2.1',
    };

    infos.activity_status = {
        stationary: true,
    };

    infos.sensor_info = [{
        timestamp_snapshot: (this.lastLocationFixTimeStamp - this.start) + randomInt(-800, 800),
        linear_acceleration_x: randomTriangular(-1.7, 1.2, 0),
        linear_acceleration_y: randomTriangular(-1.4, 1.9, 0),
        linear_acceleration_z: randomTriangular(-1.4, 0.9, 0),
        magnetic_field_x: randomTriangular(-54, 50, 0),
        magnetic_field_y: randomTriangular(-51, 57, -4.8),
        magnetic_field_z: randomTriangular(-56, 43, -30),
        magnetic_field_accuracy: [-1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2][randomInt(0, 7)],
        attitude_pitch: randomTriangular(-1.5, 1.5, 0.4),
        attitude_yaw: randomTriangular(-3.1, 3.1, 0.198),
        attitude_roll: randomTriangular(-2.8, 3.04, 0),
        rotation_rate_x: randomTriangular(-4.7, 3.9, 0),
        rotation_rate_y: randomTriangular(-4.7, 4.3, 0),
        rotation_rate_z: randomTriangular(-4.7, 6.5, 0),
        gravity_x: randomTriangular(-1, 1, 0),
        gravity_y: randomTriangular(-1, 1, -0.2),
        gravity_z: randomTriangular(-1, 0.7, -0.7),
        status: 3,
    }];

    return infos;
};

Generator.prototype.register = function(client, deviceId) {
    this.client = client;
    if (!deviceId) {
        deviceId = '';
        for (let i = 0; i < 32; i++) {
            deviceId += '0123456789abcdef'[Math.floor(Math.random() * 16)];
        }
    }
    this.deviceId = deviceId;

    this.start = new Date().getTime() - randomInt(4500, 5500);
    this.lastPos = { latitude: client.playerLatitude, longitude: client.playerLongitude };

    if (this.timer) {
        clearInterval(this.timer);
    }
    this.timer = setInterval(this.updateLocFixes.bind(this), 900);
    this.updateLocFixes();

    client.setOption('signatureInfo', this.generate.bind(this));
};

exports.Generator = Generator;
