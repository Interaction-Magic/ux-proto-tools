//  ***************************************************************
//  ***************************************************************
//  USBSerial Interface
// 
//  Author: George Cave @ Interaction Magic
//  Date: August 2023
// 
//  ***************************************************************
//  
//  Send / receive WebSerial commands, e.g. to an Arduino
// 
//  ***************************************************************
// 
//  Usage:

		// Filter for different types of dongle, e.g: {usbVendorId:0x2341}
		// Can check this easily in Chrome at about://device-log
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
//  ***************************************************************

export default class{

	// Constants for communication with device
	port
	reader
	inputDone
	outputDone
	outputStream

	// Store state of connection
	isConnected = false

	// Time of last write to stream
	lastWrite = 0

	// Default options are below
	options = {
		onReceive: (msg) => console.log(`Received: ${msg}`),
		onSend: (msg) => console.log(`Sending: ${msg}`),
		onStatusChange: (msg) => { console.log(msg) },
		onError: (msg) => console.warn(`Error: ${msg}`),

		// Device connection options
		baudrate: 115200,

		// Minimum interval between messages. Adjust as needed for balance of speed and confirmation rate
		minimumWriteInterval: 100,

		// Line ending to denote splits between send/receive messages
		sendLineEnding: '\r\n',
		receiveLineEnding: '\r\n',
	}

	// Constructor, to merge in options
	constructor(options){
		this.options = {...this.options, ...options}
	}
	
	// Serial connect function
	async connect(){

		if(!navigator.serial){
			this.options.onError('WebSerial API is not available in this browser')
			return false
		}
		this.options.onStatusChange('Requesting serial port...')

		try{
			// Request port from user and open it
			if(this.options.filters){
				this.port = await navigator.serial.requestPort({ filters: this.options.filters})
			}else{
				this.port = await navigator.serial.requestPort()
			}
			await this.port.open({
				baudRate: this.options.baudrate
			})
		
			// Stream reader for incoming data
			this.reader = this.port.readable
				.pipeThrough(new TextDecoderStream())
				.pipeThrough(new TransformStream(new LineBreakTransformer(this.options.receiveLineEnding)))
				.getReader()
			this._readLoop()
		
			const encoder = new TextEncoderStream()
			this.outputDone = encoder.readable.pipeTo(this.port.writable)
			this.outputStream = encoder.writable

			this.options.onStatusChange(`Connected to port, speed = ${this.options.baudrate}`)
			
			this.isConnected = true
			return this.port.getInfo()

		}catch(e){
			console.log(e)
			this.options.onError('Could not open port')
			return this.isConnected
		}
	} 

	// Read loop for incoming data
	async _readLoop(){
		try{
			while (true){
				const { value, done } = await this.reader.read()
				if(value){
					if(value.trim().length > 0){
						// Check if message actually has some content
						this.options.onReceive(value)
					}
				}
				if(done){
					this.reader.releaseLock()
					break
				}
			}
		}catch(e){
			// Stream failed, probably because connection closed (got unplugged?)
			this.options.onError(e)
			this.isConnected = false
			return false
		}finally {
			this.reader.releaseLock()
		}
	}

	// Write function to send lines to stream
	async send(line){
		if(this.outputDone){
			// Add small delay buffer to space out message writing
			if(Date.now() > this.lastWrite+this.options.minimumWriteInterval){
				const writer = this.outputStream.getWriter()

				writer.write(line + this.options.sendLineEnding)
				writer.releaseLock()

				this.options.onSend(line)

				this.lastWrite = Date.now()
				return line
			}else{
				return new Promise(resolve => 
					setTimeout(() => resolve(this.send(line)), this.options.minimumWriteInterval)
				);
			}
		}
	}

}

// Quick helper class to transform incoming content by splitting based on line breaks
class LineBreakTransformer {

	_split_chars = '\r\n'

	constructor(split_chars) {
	  this.container = ''

	  if(split_chars !== undefined){
		  this._split_chars = split_chars
	  }
	}
 
	transform(chunk, controller) {
	  this.container += chunk
	  const lines = this.container.split(this._split_chars)
	  this.container = lines.pop()
	  lines.forEach(line => controller.enqueue(line))
	}
 
	flush(controller) {
	  controller.enqueue(this.container)
	}
}