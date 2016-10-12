const ssh = require('ssh-exec')
const fritz = require('smartfritz-promise')
let Service, Characteristic

module.exports = function(homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic

  homebridge.registerAccessory('homebridge-projector-maex', 'ProjectorMaex', ProjectorAccessory)
}

function ProjectorAccessory(log, config) {
  this.config = config
  this.log = log
  this.name = config.name
}

ProjectorAccessory.prototype.getFritzEnergy = function() {
  const config = this.config.fritz
  const switchId = this.config.switchId
  const treshold = this.config.treshold

  return fritz
    .getSessionID(config.username, config.password, config.options)
      .then((sid) => {
        return fritz.getSwitchPower(sid, switchId, config.options).then((energy) => {
          this.log("Energy state [" + switchId + "]: " + energy, "treshold " + treshold)
          return energy > treshold ? 1 : 0
        })
      })
}

ProjectorAccessory.prototype.getState = function(callback) {
  this.getFritzEnergy().then((state) => {
    this.log('got', state)
    callback(null, state)
  })
  .catch((error) => {
    this.log(error)
    callback(err || new Error('Error getting state of ' + this.name))
  })
}

ProjectorAccessory.prototype.setState = function(power, callback) {
  const command = (power == 1) ? this.config.on : this.config.off
  const stream = ssh(command, this.config.ssh)

  stream.on('error',  (err) => {
    this.log('Error: ' + err)
    callback(err || new Error('Error setting ' + this.name + ' to ' + power))
  })

  stream.on('finish', () => {
    this.log('Set ' + this.name + ' to ' + power)
    callback(null)
  })
}

ProjectorAccessory.prototype.getServices = function() {
  const informationService = new Service.AccessoryInformation()
  informationService
    .setCharacteristic(Characteristic.Manufacturer, 'ProjectorMaex')
    .setCharacteristic(Characteristic.Model, 'this is stupid')
    .setCharacteristic(Characteristic.SerialNumber, 'thanks acer')

  const switchService = new Service.Switch(this.name)
  switchService
    .getCharacteristic(Characteristic.On)
    .on('set', this.setState.bind(this))
    .on('get', this.getState.bind(this))

  return [switchService, informationService]
}
