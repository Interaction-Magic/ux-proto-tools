//  ***********************************************
//  ***********************************************
//  BTConnector
// 
//  Author: George Cave @ Interaction Magic
//  Date: March 2022
// 
//  ***********************************************
//  
//  Enables connection to a BT device, especially a Adafruit ItsyBitsy nRF52840 Express with Nordic TX/RX comms.
//  Sample Arduino code in repo here: https://github.com/gcsalzburg/web-bluetooth-demo 
// 
//  ***********************************************
// 
//  Usage:
//  All options are optional, but setting a namePrefix is highly recommended
//
//  const BT = new BTConnector({
//    namePrefix: "Interaction Magic",  // Filter for devices with this name
//    services: ['uart', 'battery'],    // Set to match services your device will broadcast
//  	onReceive: (msg) => {
//			console.log(msg);
//  	},
//  	onSend: (msg) => {
//			console.log(msg);
//  	},
//  	onDisconnect: () => {
//  		console.log("Disconnected");
//  	},
//  	onStatusChange: (msg) => {
//  		console.log(`Status: ${msg}`);
//  	},
//    onBatteryChange: (msg) => {
//  		console.log(`Battery: ${msg}`);
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
//  ***********************************************

class BTConnector{

	// UUIDs for the services on nRF5x
	// NUS = Nordic UART Service
	// https://devzone.nordicsemi.com/f/nordic-q-a/10567/what-is-nus-nordic-uart-service
	ble_NUS_Service_UUID  = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
	ble_NUS_CharRX_UUID   = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
	ble_NUS_CharTX_UUID   = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
	
	// Variables to handle services, servers etc...
	bleDevice;
	bleServer;
	rxCharacteristic;
	txCharacteristic;
	batteryCharacteristic;
	
	// Options object for this connection
	_options = {
		namePrefix: "Interaction Magic",
		onBatteryChange: (event) => { console.log(`Battery: ${event.target.value.getUint8(0)}%`); },
		onReceive: (msg) => { console.log(`Received: ${msg}`); },
		onSend: (msg) => { console.log(`Sent: ${msg}`); },
		onDisconnect: () => {},
		onStatusChange: (msg) => { console.log(msg); },

		services: ['uart', 'battery'],

		msg_send_chunk_size: 20 // Message send chunk size
	};

	// Storage for messages to send in queue
	_msg_send_queue = [];

	// Constructor, to merge in the options
	constructor(options){
		this._options = {...this._options, ...options};
	}

	connect = async () => {

		// Check if BT is possible in this browser
		if (!navigator.bluetooth) {
			this._options.onStatusChange(`WebBluetooth API is not available.\r\nPlease make sure the Web Bluetooth flag is enabled.`);
			return;
		}
		this._options.onStatusChange('Requesting Bluetooth Device...');

		try{

			this.bleDevice = await navigator.bluetooth.requestDevice({
				filters: [{
					namePrefix: [this._options.namePrefix]
				}],
				optionalServices: [this.ble_NUS_Service_UUID, 'battery_service'],
				// acceptAllDevices: true // <-- Uncomment this to view all BT devices
			});

			this._statusChange('Found ' + this.bleDevice.name);
			this._statusChange('Connecting to GATT Server...');

			this.bleDevice.addEventListener('gattserverdisconnected', this._options.onDisconnect);
			this.bleServer = await this.bleDevice.gatt.connect();

			// Request UART characteristics and add change handlers
			if(this._options.services.includes('uart')){
				this.rxCharacteristic = await this._getCharacteristic(this.ble_NUS_Service_UUID, this.ble_NUS_CharRX_UUID);
				this.txCharacteristic = await this._getCharacteristic(this.ble_NUS_Service_UUID, this.ble_NUS_CharTX_UUID);
				await this.txCharacteristic.startNotifications();
				this.txCharacteristic.addEventListener('characteristicvaluechanged', this._receive);
			}

			// Request battery characteristics and add change handlers
			if(this._options.services.includes('battery')){
				this.batteryCharacteristic = await this._getCharacteristic('battery_service', 'battery_level');
				await this.batteryCharacteristic.startNotifications();
				this.batteryCharacteristic.addEventListener('characteristicvaluechanged', this._options.onBatteryChange);
			}

			this._statusChange(`Connected to: ${this.bleDevice.name}`);

			return this.bleDevice.name;

		}catch(error){
			this._statusChange(`Error: ${error}`);
			if(this.bleDevice && this.bleDevice.gatt.connected){
				this.bleDevice.gatt.disconnect();
			}
			return false;
		}
	};

	// Will disconnect from a connected device
	disconnect = () => {	
		if (!this.bleDevice) {
			this._statusChange('No Bluetooth Device connected...');
			return;
		}
		this._statusChange('Disconnecting from Bluetooth Device...');
		if (this.bleDevice.gatt.connected) {
			this.bleDevice.gatt.disconnect();
			this._statusChange('Bluetooth Device connected: ' + this.bleDevice.gatt.connected);
		}else{
			this._statusChange('Bluetooth Device is already disconnected');
		}
	};

	getBattery = () => {
		return this.batteryCharacteristic.readValue();
	}

	// Returns the name of a connected device
	getDeviceName = () => {
		return this.isConnected() ? this.bleDevice.name : false;
	}

	// Returns true/false if connected to BT device
	isConnected = () => {
		return (this.bleDevice && this.bleDevice.gatt.connected);
	}

	// Send a new message via UART
	// @msg : String to send 
	send = (msg) => {
		if(this.bleDevice && this.bleDevice.gatt.connected) {
			this._options.onSend(msg);
			let value_arr = new Uint8Array(msg.length)
			for (let i = 0; i < msg.length; i++) {
					value_arr[i] = msg[i].charCodeAt(0);
			}
			this._sendNextChunk(value_arr);
		}
	};

	// Send a new message via UART
	// @byte_Array : Uint8Array() array of bytes to send
	sendBytes = (byte_Array) => {
		if(this.bleDevice && this.bleDevice.gatt.connected) {
			this._options.onSend(byte_Array);
			this._sendNextChunk(byte_Array);
		}
	};

	// Handle a received message from UART
	_receive = (event) => {
		let value = event.target.value;

		// Convert raw data bytes to character values and use these to 
		// construct a string.
		let str = "";
		for (let i = 0; i < value.byteLength; i++) {
			if(value.getUint8(i) == 0){
				break;
			}
			str += String.fromCharCode(value.getUint8(i));
		}

		// Pass string to handler
		this._options.onReceive(str);
	};


	_getCharacteristic = async (service_uuid, characterstic_uuid) => {

		this._statusChange(`Locating service ${service_uuid}`);
		let service = await this.bleServer.getPrimaryService(service_uuid);
		this._statusChange(`Found service!`);
		
		this._statusChange(`Locating characteristic ${characterstic_uuid}`);
		let characteristic = await service.getCharacteristic(characterstic_uuid);
		this._statusChange('Found characteristic!');

		return characteristic;
	}

	// We do two things here:
	//  1) Call this recursively in chunks equal to msg_send_chunk_size to avoid sending too much data at once
	//  2) Queue messages which fail and send afterwards,
	//     as otherwise we get an Exception "GATT operation already in progress" when calling too fast
	//
	// Pass in array of char codes to write to the BT device
	_sendNextChunk = async (value_array) => {

		let chunk = value_array.slice(0, this._options.msg_send_chunk_size);

		try{
			// This promise will fail if we are currently writing to BT characteristic
			await this.rxCharacteristic.writeValue(chunk);
			if(value_array.length > this._options.msg_send_chunk_size){
				this._sendNextChunk(value_array.slice(this._options.msg_send_chunk_size));
			}else if(this._msg_send_queue.length > 0){
				this._sendNextChunk(this._msg_send_queue.shift());
			}
		}catch{
			this._msg_send_queue.push(value_array);
		}

	};

	// Fire callback for a status change
	_statusChange(msg){
		this._options.onStatusChange(msg);
	}
}