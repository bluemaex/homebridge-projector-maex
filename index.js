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
          this.log(`Energy usage [${switchId}]: ${energy}, treshold is ${treshold}`)
          return energy > treshold ? 1 : 0
        })
      })
}

ProjectorAccessory.prototype.sendSshCommand = function(command) {  
  return new Promise((resolve, reject) => {
    const stream = ssh(command, this.config.ssh)
    
    stream.on('error',  err => {
      this.log(`Error occured: ${error}`)
      reject(err || new Error(`Error executing ${command}`))
    })

    stream.on('finish', () => {
      this.log(`Executed command "${command}" successfully`)
      resolve()
    })
  })
}

ProjectorAccessory.prototype.getState = function(callback) {
  this.getFritzEnergy().then(state => { callback(null, state) })
      .catch(error => { callback(error || new Error(`Error getting state of ${this.name}`)) })
}

ProjectorAccessory.prototype.setState = function(power, callback) {
  const command = (power == 1) ? this.config.on : this.config.off

  this.getFritzEnergy().then(state => {
    if(power !== state ) {
      this.log(`state of projector is ' + state + ', requested to switch to ' + power`)
      this.sendSshCommand(command).then(() => { callback() })
    } else {
      this.log(`already in state ${state}, ignoring`)
      callback()
    }
  }).catch(error => {
    this.log(error)
    callback(error || new Error(`Error setting ${state} of ${this.name} to value`))
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
