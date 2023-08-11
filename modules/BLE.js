//  ***************************************************************
//  ***************************************************************
//  WebBluetooth wrapper for BLE UART comms with Nordic devices
// 
//  Author: George Cave @ Interaction Magic
//  Date: August 2023
// 
//  ***************************************************************
//  
//  Enables connection to a BT device, especially a Adafruit ItsyBitsy nRF52840 Express with Nordic TX/RX comms.
//  Sample Arduino code in repo here: https://github.com/gcsalzburg/web-bluetooth-demo 
// 
//  ***************************************************************
// 
//  Usage:
//  All options are optional, but setting a namePrefix is highly recommended
//
//  const BT = new BLEComms({
//    namePrefix: "Interaction Magic",  // Filter for devices with this name
//    services: ['uart', 'battery'],    // Set to match services your device will broadcast
//  	onReceive: (msg) => {
//			console.log(msg)
//  	},
//  	onSend: (msg) => {
//			console.log(msg)
//  	},
//  	onDisconnect: () => {
//  		console.log("Disconnected")
//  	},
//  	onStatusChange: (msg) => {
//  		console.log(`Status: ${msg}`)
//  	},
//    onBatteryChange: (msg) => {
//  		console.log(`Battery: ${msg}`)
//  	}, 
//  });
// 
//  Public methods:
// 
//    connect()	
//    disconnect()
//    send("msg_here")
//    sendBytes([255,0,235])
//    getBattery()
//    isConnected()   // Returns true/false for status
//    getDeviceName() // Returns BLE device is connected to, or false if not connected 
// 
//  ***************************************************************

export default class{

	// UUIDs for the services on nRF5x
	// NUS = Nordic UART Service
	// https://devzone.nordicsemi.com/f/nordic-q-a/10567/what-is-nus-nordic-uart-service
	bleNUSServiceUUID  = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
	bleNUSCharRxUUID   = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
	bleNUSCharTxUUID   = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
	
	// Variables to handle services, servers etc...
	bleDevice
	bleServer
	rxCharacteristic
	txCharacteristic
	batteryCharacteristic
	
	// Options object for this connection
	options = {
		onReceive: (msg) => { console.log(`Received: ${msg}`) },
		onSend: (msg) => { console.log(`Sending: ${msg}`) },
		onError: (msg) => console.warn(`Error: ${msg}`),

		onBatteryChange: (event) => { console.log(`Battery: ${event.target.value.getUint8(0)}%`) },
		onDisconnect: () => {},
		onStatusChange: (msg) => { console.log(msg) },

		services: ['uart'],
		
		// WebBluetooth error message
		webBluetoothUnavailable: 'WebBluetooth API is not available in this browser.',

		msg_send_chunk_size: 20 // Message send chunk size
	}

	// Storage for messages to send in queue
	_msg_send_queue = []

	// Constructor, to merge in the options
	constructor(options){
		this.options = {...this.options, ...options}
	}

	connect = async () => {

		// Check if BT is possible in this browser
		if (!navigator.bluetooth) {
			this.options.onStatusChange(this.options.webBluetoothUnavailable)
			return
		}
		this.options.onStatusChange('Requesting Bluetooth Device...')

		try{

			// Configure options for bluetooth device request
			const requestOpts = {
				optionalServices: []
			}
			if(this.options.filters){
				requestOpts.filters = [this.options.filters]
			}else{
				requestOpts.acceptAllDevices = true
			}
			if(this.options.services.includes('uart')) requestOpts.optionalServices.push(this.bleNUSServiceUUID)
			if(this.options.services.includes('battery')) requestOpts.optionalServices.push('battery_service')

			console.log(requestOpts)
			// Now request access to a bluetooth device
			this.bleDevice = await navigator.bluetooth.requestDevice(requestOpts)

			this.options.onStatusChange('Found ' + this.bleDevice.name)
			this.options.onStatusChange('Connecting to GATT Server...')

			this.bleDevice.addEventListener('gattserverdisconnected', this.options.onDisconnect)
			this.bleServer = await this.bleDevice.gatt.connect()

			// Request UART characteristics and add change handlers
			if(this.options.services.includes('uart')){
				this.rxCharacteristic = await this._getCharacteristic(this.bleNUSServiceUUID, this.bleNUSCharRxUUID)
				this.txCharacteristic = await this._getCharacteristic(this.bleNUSServiceUUID, this.bleNUSCharTxUUID)
				await this.txCharacteristic.startNotifications()
				this.txCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
					// Handle a received message from UART
					const decoder = new TextDecoder()
					this.options.onReceive(decoder.decode(event.target.value))
				})
			}

			// Request battery characteristics and add change handlers
			if(this.options.services.includes('battery')){
				this.batteryCharacteristic = await this._getCharacteristic('battery_service', 'battery_level')
				await this.batteryCharacteristic.startNotifications()
				this.batteryCharacteristic.addEventListener('characteristicvaluechanged', this.options.onBatteryChange)
			}

			this.options.onStatusChange(`Connected to: ${this.bleDevice.name}`)

			return this.bleDevice.name

		}catch(error){
			this.options.onError(error)
			if(this.bleDevice && this.bleDevice.gatt.connected){
				this.bleDevice.gatt.disconnect()
			}
			return false
		}
	}

	// Will disconnect from a connected device
	disconnect = () => {	
		if (!this.bleDevice) {
			this.options.onError('No Bluetooth Device connected')
			return
		}
		this.options.onStatusChange('Disconnecting from Bluetooth Device...')
		if (this.bleDevice.gatt.connected) {
			this.bleDevice.gatt.disconnect()
			this.options.onStatusChange('Bluetooth Device connected: ' + this.bleDevice.gatt.connected)
		}else{
			this.options.onStatusChange('Bluetooth Device is already disconnected')
		}
	}

	getBattery = () => {
		return this.batteryCharacteristic.readValue()
	}

	// Returns the name of a connected device
	getDeviceName = () => {
		return this.isConnected() ? this.bleDevice.name : false
	}

	// Returns true/false if connected to BT device
	isConnected = () => {
		return (this.bleDevice && this.bleDevice.gatt.connected)
	}

	// Send a new message via UART
	// @msg : String to send 
	send = (msg) => {
		if(this.bleDevice && this.bleDevice.gatt.connected) {
			this.options.onSend(msg)
			const encoder = new TextEncoder()
			this._sendNextChunk(encoder.encode(msg))
		}
	}

	// Send a new message via UART
	// @byte_Array : Uint8Array() array of bytes to send
	sendBytes = (byteArray) => {
		if(this.bleDevice && this.bleDevice.gatt.connected) {
			this.options.onSend(byteArray);
			this._sendNextChunk(byteArray);
		}
	}


	_getCharacteristic = async (service_uuid, characterstic_uuid) => {

		this.options.onStatusChange(`Locating service: ${service_uuid}`)
		let service = await this.bleServer.getPrimaryService(service_uuid)
		this.options.onStatusChange(`Found service: ${service_uuid}`)
		
		this.options.onStatusChange(`Locating characteristic: ${characterstic_uuid}`)
		let characteristic = await service.getCharacteristic(characterstic_uuid)
		this.options.onStatusChange(`Found characteristic: ${characterstic_uuid}`)

		return characteristic
	}

	// We do two things here:
	//  1) Call this recursively in chunks equal to msg_send_chunk_size to avoid sending too much data at once
	//  2) Queue messages which fail and send afterwards,
	//     as otherwise we get an Exception "GATT operation already in progress" when calling too fast
	//
	// See more: https://github.com/WebBluetoothCG/web-bluetooth/issues/188
	//
	// Pass in array of char codes to write to the BT device
	_sendNextChunk = async (value_array) => {

		let chunk = value_array.slice(0, this.options.msg_send_chunk_size);

		try{
			// This promise will fail if we are currently writing to BT characteristic
			await this.rxCharacteristic.writeValue(chunk);
			if(value_array.length > this.options.msg_send_chunk_size){
				this._sendNextChunk(value_array.slice(this.options.msg_send_chunk_size))
			}else if(this._msg_send_queue.length > 0){
				this._sendNextChunk(this._msg_send_queue.shift())
			}
		}catch{
			this._msg_send_queue.push(value_array)
		}

	}
}