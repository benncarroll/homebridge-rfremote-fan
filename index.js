var exec = require("child_process").exec;
var request = require("request");

var Service;
var Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory(
    "homebridge-rfremote-fan",
    "RF-Remote Fan",
    FanLightAccessory
  );
};

function FanLightAccessory(log, config) {
  this.log = log;

  this.host = config.host;
  this.name = config.name;
  this.id = config.id;
  this.light_name = config.light_name || this.name + " Light";

  this.state = {
    power: false,
    speed: 25
  };
}

FanLightAccessory.prototype.getRelays = function(value, callback) {
  
  request(
    {
      url: "http://" + this.host + "/rfremotefan/api/v1.0/status",
      method: "GET",
      json: true,
      body: value
    },
    function(error, response, body) {
      if (error) {
        callback(error);
      } else if (response.statusCode == 200) {
        callback(null, body.on);
      } else {
        callback(
          new Error(
            "HTTP response " + response.statusCode + ": " + JSON.stringify(body)
          )
        );
      }
    }
  );
};

FanLightAccessory.prototype.updateRelays = function(value, callback) {
  this.log("update relays: " + JSON.stringify(value));

  request(
    {
      url: "http://" + this.host + "/rfremotefan/api/v1.0/update",
      method: "GET",
      json: true,
      body: value
    },
    function(error, response, body) {
      if (error) {
        callback(error);
      } else if (response.statusCode == 200) {
        callback(null, value);
      } else {
        callback(
          new Error(
            "HTTP response " + response.statusCode + ": " + JSON.stringify(body)
          )
        );
      }
    }
  );
};

FanLightAccessory.prototype.getFanState = function(callback) {
  info = {
    id: this.id
  };
  this.getRelays(info, (error, data) => {
    if (error) {
      callback(error);
    } else {
      var state = {};
      speed = data["speed"];
      if (speed == 3) {
        state.power = true;
        state.speed = 100;
      } else if (speed == 2) {
        state.power = true;
        state.speed = 50;
      } else if (speed == 1) {
        state.power = true;
        state.speed = 25;
      } else {
        state.power = false;
        state.speed = 25;
      }
      // state.temperature = data.temperature;
      this.log("speed ---" + state.speed);
      this.state = state;
      callback(null, state);
    }
  });
};

FanLightAccessory.prototype.setFanState = function(state, callback) {
  var relay;
  if (!state.power) {
    relay = 0;
  } else if (state.speed > 50) {
    relay = 3;
  } else if (state.speed > 25) {
    relay = 2;
  } else if (state.speed > 0) {
    relay = 1;
  } else {
    relay = 0;
  }

  this.log("active relay " + relay);

  var update1 = {};
  update1["id"] = this.id;
  update1["speed"] = relay;

  this.updateRelays(update1, error => {
    if (error) {
      callback(error);
      return;
    } else {
      callback();
    }
  });
};

FanLightAccessory.prototype.identify = function(callback) {
  this.log("Identify requested!");
  callback();
};

FanLightAccessory.prototype.getServices = function() {
  // Fan
  this.fanService = new Service.Fan();
  this.fanService
    .getCharacteristic(Characteristic.On)
    .on("get", this.getFanOn.bind(this))
    .on("set", this.setFanOn.bind(this));

  this.fanService
    .getCharacteristic(Characteristic.RotationSpeed)
    .setProps({
      minValue: 0,
      maxValue: 100,
      minStep: 25
    })
    .on("get", this.getFanSpeed.bind(this))
    .on("set", this.setFanSpeed.bind(this));

  // Light
  this.lightService = new Service.Lightbulb(this.light_name);
  this.lightService
    .getCharacteristic(Characteristic.On)
    .on("get", this.getLightOn.bind(this))
    .on("set", this.setLightOn.bind(this));

  return [this.fanService, this.lightService];
};

FanLightAccessory.prototype.getFanOn = function(callback) {
  this.getFanState(function(error, state) {
    callback(null, state.power);
  });
};

FanLightAccessory.prototype.setFanOn = function(value, callback) {
  //if (this.state.power != value) {
  this.log("setting power to " + value);
  this.state["power"] = value;
  this.setFanState(this.state, callback);
  callback();
};

FanLightAccessory.prototype.getFanSpeed = function(callback) {
  this.log("get speed");
  this.getFanState(function(error, state) {
    callback(null, state["speed"]);
  });
};

FanLightAccessory.prototype.setFanSpeed = function(value, callback) {
  this.log("setting speed to " + value);
  this.state["speed"] = value;
  this.setFanState(this.state, callback);
  callback();
};

FanLightAccessory.prototype.getLightOn = function(callback) {
  this.log.info("Check light");
  this.getRelays(
    {
      id: this.id,
      light: true
    },
    callback
  );
};

FanLightAccessory.prototype.setLightOn = function(newValue, callback) {
  this.log.info("Light on: " + newValue);
  this.updateRelays(
    {
      id: this.id,
      light: newValue
    },
    callback
  );
};
