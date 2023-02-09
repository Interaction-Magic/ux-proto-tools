//  ***********************************************
//  ***********************************************
//  MQTT Connector
// 
//  Author: George Cave @ Interaction Magic
//  Date: February 2023
// 
//  ***********************************************
//  
//  Simple browser-based connection to/from MQTT broker
//  Wrapper for the Paho MQTT library with some niceities to make it easy to setup multiple instances
//  Includes using Hello & Ping functionality built in
//
//  https://www.eclipse.org/paho/index.php?page=clients/js/index.php
// 
//  ***********************************************
// 
//  Usage:
//
//  Add this line at end of body:
//  <script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.1.0/paho-mqtt.min.js"
//    integrity="sha512-Y5n0fbohPllOQ21fTwM/h9sQQ/1a1h5KhweGhu2zwD8lAoJnTgVa7NIrFa1bRDIMQHixtyuRV2ubIx+qWbGdDA=="
//    crossorigin="anonymous" referrerpolicy="no-referrer"></script>
// 
//  Initialise as shown:
//
//  const MQTT = new WebMQTT({
//    server:       'server.s2.eu.hivemq.cloud',	// MQTT server
//    username:     'username',							// MQTT username
//    password:     '*****',								// MQTT password
//    port: 		  8884,									// MQTT port
//
//    client_id: 		this._generateID('web'),		// Manually set a clientID for this connection
//    client_prefix: '',									// Or set a prefix. Randomer number will be appended
//
//    topic_prefix: 'interactionmagic/proto1',    	// Global topic prefix, ⚠️ no trailing slash!
//
//    subscribe_to: ['topic1', 'topic2'],				// List of topics to auto-subscribe to
//    connect_straight_away: true,						// Set false to create object without connecting
//  
//    log: (msg, opts = {}) => {}, 						// Common handler for log messages
//  
//    onConnect: (client_id) => {}, 					// Replace these handlers with your own if needed
//    onConnectFailure: (msg) => {},
//    onDisconnect: (msg) => {},
//    onReceive: (msg_data) => {},
//    onSubscribe: (topic) => {},
//    onSend: (topic, msg) => {},
//    onMessageDelivered: (msg) => {},
//    onPing: (device) => {},
//    
//    status_topic: 'status',								// Topic for status messages, set false to disable
//    status_init_topic: 'hello',						// Set false to disable
//    status_ping_topic: 'ping',							// Set false to disable
//    status_ping_interval: 1000,						// Adjust ping interval
//    subscribe_to_pings: true,							// Turn off ping subscription
//  })
//
//  Public methods:
// 
//  send(topic, msg) -> send a new message
// 
//  ***********************************************

class WebMQTT{

	// Default options are below
	_default_opts = {
		server: 			'',
		username: 		'',
		password: 		'',
		port: 			8884,
		client_prefix: '',
		topic_prefix: 	'', // No trailing slash!

		subscribe_to: [],
		connect_straight_away: true,

		status_topic: 'status',
		status_init_topic: 'hello',
		status_ping_topic: 'ping',
		status_ping_interval: 1000,

		subscribe_to_pings: true,

		log: (msg, type = 'MQTT') => {console.log(`${type}: ${msg}`)},

		onConnect: (client_id) => {this.log(`Connected as ${client_id}!`, 'connection')},
		onConnectFailure: (msg) => {this.log(`Failed to connect: `, 'connection')},
		onDisconnect: (msg) => {this.log(`MQTT Connection lost. Error msg: ${msg}`, 'error')},
		onReceive: (msg_data) => {this.log(`Received: ${msg_data.topic} = ${msg_data.payload}`, 'msg')},
		onSubscribe: (topic) => {this.log(`Subscribed to: ${topic}`, 'topic')},
		onSend: (topic, msg) => {this.log(`Sent: ${msg} to ${topic}`, 'msg')},
		onMessageDelivered: (msg) => {this.log(`Delivered: ${msg.payloadString} to ${msg.destinationName}`, 'msg')},
		onPing: (device) => {this.log(`Ping from: ${device}`, 'ping')}
	}


	constructor(opts) {

		// Merge opts with defaults
		this.opts = {...this._default_opts, ...opts}

		// Shorter reference to log() command
		this.log = this.opts.log

		// Correctly set client_id based on user preferences
		if(!this.opts.client_id){
			if(this.opts.client_prefix){
				this.opts.client_id = this._generateID(this.opts.client_prefix)
			}else{
				this.opts.client_id = this._generateID('web')
			}
		}

		// Create new Paho Client
		this.client = new Paho.Client(this.opts.server, this.opts.port, this.opts.client_id);

		// /////////////////////////
		// Setup handlers

		this.client.onConnectionLost = (responseObject) => {
			if (responseObject.errorCode !== 0) {

				// Stop pinging
				if(this._isStatusEnabled('ping')){
					clearInterval(this.pingInterval)
					this.pingInterval = null
				}

				this.opts.onDisconnect(responseObject.errorMessage)
			}
		}

		this.client.onMessageDelivered = (msg) => {
			this.opts.onMessageDelivered(msg)
		}

		this.client.onMessageArrived = (msg) => {
			const topic = msg.destinationName.substring(this.opts.topic_prefix.length+1);

			if(this._isStatusEnabled('ping') && (topic == `${this.opts.status_topic}/${this.opts.status_ping_topic}`)){
				this.opts.onPing(msg.payloadString)
			}else{
				this.opts.onReceive({
					topic: topic,
					payload: msg.payloadString,
	
					topic_full: msg.destinationName,
					msg_raw: msg
				})
			}
		}

		// Now connect
		if(this.opts.connect_straight_away){
			this.connect();
		}
	}

	connect(){
		this.client.connect({
			onSuccess:	() => {
				this.opts.onConnect(this.opts.client_id);

				// Automatically subscribe to topics after connecting

				if(this.opts.status_topic){
					if(this._isStatusEnabled('init')){
						// Subscribe to init/hello channel
						this.subscribe(`${this.opts.status_topic}/${this.opts.status_init_topic}`)
					}
					if(this._isStatusEnabled('ping') && this.opts.subscribe_to_pings){
						// Subscribe to ping channel
						this.subscribe(`${this.opts.status_topic}/${this.opts.status_ping_topic}`)
					}
				}
				if(this.opts.subscribe_to){
					// Subscribe to topics initially set in options 
					for(let topic of this.opts.subscribe_to){
						this.subscribe(topic)
					}
				}

				// Automatically send a hello status message if needed
				if(this._isStatusEnabled('init')){
					this.send(`${this.opts.status_topic}/${this.opts.status_init_topic}`, this.opts.client_id)
				}

				// Automatically send pings if needed
				if(this._isStatusEnabled('ping')){
					this.pingInterval = setInterval(() => this.ping(), this.opts.status_ping_interval)
				}
			},
			onFailure: (response) => {
				this.onConnectFailure(response.errorMessage)
			},
			userName: 	this.opts.username,
			password: 	this.opts.password,
			useSSL: 		true,
			reconnect: 	true
		});
	}

	// Subscribe to a topic
	subscribe(topic){
		this.client.subscribe(this._buildTopic(topic))
		this.opts.onSubscribe(this._buildTopic(topic))
	}

	// Send an MQTT message 
	send(topic, msg){
		const message = new Paho.Message(msg)
		message.destinationName = this._buildTopic(topic)
		this.opts.onSend(message.destinationName, msg)
		this.client.send(message)
	}

	// Sends a ping status message
	ping(){
		this.send(`${this.opts.status_topic}/${this.opts.status_ping_topic}`, this.opts.client_id)
	}

	// Prefix the topic correctly
	_buildTopic(topic){
		return `${this.opts.topic_prefix}${this.opts.topic_prefix.length > 0 ? '/' : ''}${topic}`;
	}

	// Generate a pseudo-random client ID for this device to connect with
	_generateID(prefix){
		return `${prefix}-${Math.round(Math.random()*100000)}`
	}

	// Check if status messages are enabled for a given type, e.g. 'init' or 'ping'
	_isStatusEnabled(type){
		return this.opts.status_topic && this.opts[`status_${type}_topic`]
	}
}
