//  ***********************************************
//  ***********************************************
//  USBSerial Interface
// 
//  Author: George Cave @ Interaction Magic
//  Date: February 2022
// 
//  ***********************************************
//  
//  Description TBD
// 
//  ***********************************************
// 
//  Usage:
// 
//  TBD
// 
//  Public methods:
// 
//  TBD
// 
//  Public properties:
//
//  TBD
// 
//  ***********************************************

class Serial{

	// Constants for communication with device
	_port;
	_reader;
	_inputDone;
	_outputDone;
	_outputStream;

	// Store state of connection
	is_connected = false;

	// Time of last write to stream
	_last_write = 0;

	// Default options are below
	default_opts = {
		// Callbacks for events
		web_serial_error_callback: function(msg){
			alert(msg);
		},
		read_callback: function(msg){
			console.log(`Received: ${msg}`);
		},
		write_callback: function(msg){
			console.log(`Sent: ${msg}`);
		},
		error_callback: function(msg){
			console.log(`Error: ${msg}`);
		},

		// Serial baudrate
		baudrate: 115200,

		// Filter for different types of dongle, e.g:
		// filter = { usbVendorId: 0x2341 },
		// Can check this easily in Chrome at about://device-log
		filter: null,

		// Minimum interval between messages. Adjust as needed for balance of speed and confirmation rate
		minimum_write_interval: 100,

		// Line ending to denote splits between send/receive messages
		send_line_ending: '\r\n',
		receive_line_ending: '\r\n',

		// Do we check if serial is possible in browser immediately?
		check_for_serial: true,
	};
	opts = {};


	// Constructor requires only a single callback for handling incoming messages
	constructor(opts){

		this.opts = {...this.default_opts, ...opts};

		if(this.opts.check_for_serial && (!('serial' in navigator))){
			this.opts.web_serial_error_callback("Web Serial API is not supported on this device (or you are not using https://). Make sure you're running Chrome or Edge and have enabled the #enable-experimental-web-platform-features flag in chrome://flags or edge://flags");
		}
	}
	
	// Serial connect function
	async connect(){

		if(!('serial' in navigator)){
			this.opts.web_serial_error_callback("Web Serial API is not supported on this device (or you are not using https://). Make sure you're running Chrome or Edge and have enabled the #enable-experimental-web-platform-features flag in chrome://flags or edge://flags");
		}

		try{
			// Request port from user and open i1
			// Will fail with empty filter, hence the check
			if(this.opts.filter !== null){
				this._port = await navigator.serial.requestPort({ filters: [this.opts.filter]});
			}else{
				this._port = await navigator.serial.requestPort();
			}
			await this._port.open({ baudRate: this.opts.baudrate });
		
			// Stream reader for incoming data
			this._reader = this._port.readable
				.pipeThrough(new TextDecoderStream())
				.pipeThrough(new TransformStream(new LineBreakTransformer(this.opts.receive_line_ending)))
				.getReader();
			this._readLoop();
		
			const encoder = new TextEncoderStream();
			this._outputDone = encoder.readable.pipeTo(this._port.writable);
			this._outputStream = encoder.writable;

			this.is_connected = true;
			return true;

		}catch(e){
			if(this.is_connected){
				return true;
			}else{
				this.is_connected = false;
				return false;
			}
		}
	} 

	// Read loop for incoming data
	async _readLoop(){
		try{
			while (true){
				const { value, done } = await this._reader.read();
				if(value){
					if(value.trim().length > 0){
						// Check if message actually has some content
						this.opts.read_callback(value);
					}
				}
				if(done){
					this._reader.releaseLock();
					break;
				}
			}
		}catch(e){
			// Stream failed, probably because connection closed (got unplugged?)
			this.opts.error_callback(e);
			this.is_connected = false;
			return false;
		}finally {
			this._reader.releaseLock();
		}
	}

	// Write function to send lines to stream
	async write(line){
		if(this._outputDone){
			// Add small delay buffer to space out message writing
			if(Date.now() > this._last_write+this.opts.minimum_write_interval){
				const writer = this._outputStream.getWriter();

				writer.write(line + this.opts.send_line_ending);
				writer.releaseLock();

				this.opts.write_callback(line);

				this._last_write = Date.now();
				return line;
			}else{
				return new Promise(resolve => 
					setTimeout(() => resolve(this.write(line)), this.opts.minimum_write_interval)
				);
			}
		}
	}

}

// Quick helper class to transform incoming content by splitting based on line breaks
class LineBreakTransformer {

	_split_chars = '\r\n';

	constructor(split_chars) {
	  this.container = '';

	  if(split_chars !== undefined){
		  this._split_chars = split_chars;
	  }
	}
 
	transform(chunk, controller) {
	  this.container += chunk;
	  const lines = this.container.split(this._split_chars);
	  this.container = lines.pop();
	  lines.forEach(line => controller.enqueue(line));
	}
 
	flush(controller) {
	  controller.enqueue(this.container);
	}
}