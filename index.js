var request = require('request');
var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-sonoff-basic-espeasy', 'SonoffBasicESPEasy', SonoffBasicESPEasy);
}

function SonoffBasicESPEasy(log, config) {
    this.log = log;
    this.name = config.name || 'Sonoff Switch';
    this.type = config.type || 'switch';
    this.ip = config.ip;

    this.pulse = config.pulse || false;
    this.action = config.action || 'off';
    this.duration = config.duration || 60;

    if (!this.ip) {
        throw new Error('Your must provide IP address of the switch.');
	}

    switch (this.type) {
        case 'outlet':
            this.service = new Service.Outlet(this.name);
            break;

        default:
            this.service = new Service.Switch(this.name);
            break;
    }

    this.serviceInfo = new Service.AccessoryInformation();

    this.serviceInfo
        .setCharacteristic(Characteristic.Manufacturer, 'Sonoff')
        .setCharacteristic(Characteristic.Model, 'Basic Switch')
        .setCharacteristic(Characteristic.SerialNumber, 'EB1B-ED2E-5EA945508A66');

    this.service
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
}

SonoffBasicESPEasy.prototype = {
    getPowerState: function(callback) {
        var log = this.log;

		if (this.pulse) {
			callback(null, false);
			return;
		}

        request.get({
            url: 'http://' + this.ip + '/control?cmd=status,gpio,12',
            timeout: 120000
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                var json = JSON.parse(body);

                log.debug('State: ' + json.state);
                callback(null, (json.state == 1));
                return;
            }

            log.debug('Error getting power state. (%s)', error);

            callback();
        });
    },

    setPowerState: function(state, callback) {
        var log = this.log;
		var command = '/control?cmd=event,' + ((state) ? 'PowerOn' : 'PowerOff');

		if (this.pulse && state) {
			command = '/control?cmd=Pulse,12,' + ((this.action == 'on') ? 1 : 0) + ',' + (parseInt(this.duration) * 1000);
		}

        request.get({
            url: 'http://' + this.ip + command,
            timeout: 120000
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                if (body == 'OK') {
                    return;
				}

                log.debug('Response Error: %s', body);
                return;
            }

            log.debug('Error setting device control. (%s)', error);
        });

		if (this.pulse) {
			var that = this;
			
			setTimeout(function() {
				that.service.getCharacteristic(Characteristic.On).updateValue(false);
			}, 2000);
		}

        callback();
    },

    identify: function(callback) {
        callback();
    },

    getServices: function() {
        return [this.serviceInfo, this.service];
    }
};
