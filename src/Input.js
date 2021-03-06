//  ***********************************************
//  ***********************************************
//  Input
// 
//  Author: George Cave @ Interaction Magic
//  Date: February 2022
// 
//  ***********************************************
//  
//  Interface for handling of a physical button via keyboard, click or otherwise
//  Single, double & long-press functionality
// 
//  ***********************************************
// 
//  Usage:
// 
//  const input = new Input({
//    name: "Button1",        // Human readable name
//    key: "q",               // Keyboard key to check for all press types on
//    double_press_enabled: true, // Enable check for double press
//    dom: null,              // DOM element (e.g. <a>) representing the button
//    discrete_keys: {        // Individual trigger keys e.g. for hardware keyboard emulators
//       single: 'e',
//       double: 'r',
//       long: 't'
//    },
//    fire: (press) => console.log(press)	// Callback for when button is pressed
//  });
// 
//  Public methods:
//
//    down()   -> Call when button is pressed down (e.g. from a Serial device sending commands)
//    up()     -> Call when button gets released (e.g. from a Serial device sending commands)
//    fire()   -> Manually fire the button handler
//    remove_handlers() -> Remove event handlers for this object
//    
//  Methods to enable/disable features
//    enable_long_press()
//    disable_long_press()
//    set_long_press(is_long_press)
//    enable_repeat()
//    disable_repeat()
//    set_repeat_press(is_repeat_press)
//
// 
//  ***********************************************

class Input{


	// Default options are below
	_default_opts = {
		fire: 						(type) => {},	// Handler for when the input is triggered
		
		has_double_press:			true,

		long_press_enabled:		true,
      long_press_threshold: 	500,

		double_press_enabled:	true,
		double_press_threshold: 100,			// gap between end of first click and start of next
		
		pressed_class: 			'pressed',
		discrete_keys_animate: 	true,			// flash a press effect on DOM button for discrete keys?

		repeat_press_enabled:	false,
		repeat_fire_immediate:	true,			// Does the first fire of the repeat begin on keydown
		repeat_override_long:	true,			// Does the repeat key prevent the long press firing 
		repeat_init_delay:		600,			// Delay before repeat timer begins
		repeat_interval:			130			// Interval delay on repeat key
	};

	_click = {
      last_press: 0,
      long_press_fired: false,
		half_double_press_fired: false,
		half_double_press: 0,
		pressed: false
	};

	_removed = false;

	_repeat_timer = null;

	// Requires a reference to div to put the messages in
	constructor(opts){

		// Merge opts with defaults
		this.opts = {...this._default_opts, ...opts};

		// Backwards compatability with old variable name
		if(typeof opts.has_double_press !== 'undefined'){
			this.opts.double_press_enabled = opts.has_double_press;
		}

		// Attach click handling
		this._attach_handlers();

		// Start checking for button presses!
		window.requestAnimationFrame(() => this._press_check_loop());
	}

	// Manually trigger the button push
	fire(type){
		this._handle_press(type);
	}

	// Call when there's a push/release down on the button
	down(){
		if(this.opts.dom){
			this.opts.dom.classList.add(this.opts.pressed_class);
		}
		this._press();
		if(this.opts.repeat_enabled){
			if(this.opts.repeat_fire_immediate){
				// Fire straight away, which normally makes sense for repeat firing
				this._handle_press('single');
			}
			this._repeat_timer = setTimeout(() => {
				this._handle_repeat();
			}, this.opts.repeat_init_delay)
		}
	}
	up(){
		if(this.opts.dom){
			this.opts.dom.classList.remove(this.opts.pressed_class);
		}
		this._release();
		clearTimeout(this._repeat_timer);
	}

	// Enable/disable long press
	enable_long_press(){ this.set_long_press(true); }
	disable_long_press(){ this.set_long_press(false); }
	set_long_press(is_long_press = false){
		this.opts.long_press_enabled = is_long_press;
	}

	// Enable/disable repeat key firing
	enable_repeat(){ this.set_repeat_press(true); }
	disable_repeat(){ this.set_repeat_press(false); }
	set_repeat_press(is_repeat_press = false){
		this.opts.repeat_enabled = is_repeat_press;
	}

	// /////////////////////////////////////////////////////////////////
	// Event handlers

	remove(){
		this._removed = true;

		if(this.opts.dom){
			this.opts.dom.removeEventListener("mousedown", this._onMouseDown);
			this.opts.dom.removeEventListener("mouseout", this._onMouseOut)
			this.opts.dom.removeEventListener("mouseup", this._onMouseUp);
		}
		document.removeEventListener('keydown', this._onKeyDown);
		document.removeEventListener('keyup', this._onKeyUp);
		document.removeEventListener('keydown', this._onKeyDownDiscrete);
	}

	_attach_handlers(){

		// Save references for functions
		// Advice from here: https://riptutorial.com/dom/example/1034/removing-event-listeners

		this._onMouseDown = this._listener_mousedown.bind(this);
		this._onMouseOut = this._listener_mouseout.bind(this);
		this._onMouseUp = this._listener_mouseup.bind(this);
		this._onKeyDown = this._listener_keydown.bind(this);
		this._onKeyUp = this._listener_keyup.bind(this);
		this._onKeyDownDiscrete = this._listener_keydown_discrete.bind(this);

		// Attach handlers to object on screen
		if(this.opts.dom){
			this.opts.dom.addEventListener("mousedown",this._onMouseDown);
			this.opts.dom.addEventListener("mouseout",this._onMouseOut)
			this.opts.dom.addEventListener("mouseup",this._onMouseUp);
		}

		// Attach handlers to main key
		if(this.opts.key){
			document.addEventListener('keydown', this._onKeyDown);
			document.addEventListener('keyup', this._onKeyUp);
		}

		// Setup detection for keyboard inputs for hardware  prototyping
		if(this.opts.discrete_keys){
			document.addEventListener('keydown', this._onKeyDownDiscrete);
		}
	}

	_listener_mousedown(e){
		this.down();
	}
	_listener_mouseout(e){
		this.opts.dom.classList.remove(this.opts.pressed_class);
		this._release(false);
		this.opts.dom.blur();
	}
	_listener_mouseup(e){
		this.up();
		this.opts.dom.blur();
	}
	_listener_keydown(e){
		// Avoid repeat firing by checking if already pressed
		if( (e.key == this.opts.key) && (!this._click.pressed) ){
			this.down();
		}
	}
	_listener_keyup(e){
		if(e.key == this.opts.key){
			this.up();
		}
	}
	_listener_keydown_discrete(e){

		const key = e.key.toLowerCase();
		const keys = this.opts.discrete_keys;

		switch(key){
			case keys.single:
				this._handle_press("single");
				if(this.opts.dom && this.opts.discrete_keys_animate){
					this.opts.dom.classList.add(this.opts.pressed_class);
					setTimeout(() => {this.opts.dom.classList.remove(this.opts.pressed_class);}, 100);
				}
				break;
			
			case keys.double:
				this._handle_press("double");
				if(this.opts.dom && this.opts.discrete_keys_animate){
					this.opts.dom.classList.add(this.opts.pressed_class);
					setTimeout(() => {this.opts.dom.classList.remove(this.opts.pressed_class);}, 100);
					setTimeout(() => {this.opts.dom.classList.add(this.opts.pressed_class);}, 170);
					setTimeout(() => {this.opts.dom.classList.remove(this.opts.pressed_class);}, 270);
				}
				break;
			
			case keys.long:
				this._handle_press("long");
				if(this.opts.dom && this.opts.discrete_keys_animate){
					this.opts.dom.classList.add(this.opts.pressed_class);
					setTimeout(() => {this.opts.dom.classList.remove(this.opts.pressed_class);}, 300);
				}
				break;
		}
	}

	// Handle all button activations
	_handle_press(type){
		this.opts.fire(type);
	}

	// Responds to repeat press firing
	_handle_repeat(){
		this._handle_press('single');
		this._repeat_timer = setTimeout(() => this._handle_repeat(), this.opts.repeat_interval);
	}

	// /////////////////////////////////////////////////////////////////
	// Loop logic for single/double/long press is below

	// Call when the press begins
	_press(){
		this._click.last_press = Date.now();
		this._click.pressed = true;
	}
	
	
	// Called as fast as possible to check for types of press events
	_press_check_loop(){
		// Check if we should give up waiting for a second press of the double press
		// Only do this if we are not currently pressed
		if(!this._click.pressed && this.opts.double_press_enabled){
			if(
				this._click.half_double_press_fired
				&& (Date.now() > (this._click.half_double_press + this.opts.double_press_threshold))
			){
				// Given up, lets just register a normal press!
				this._handle_press("single");
				this._click.half_double_press_fired = false;
			}
		}

		// Check for long pressing if:
		//  + still held down
		//  + threshold exceeded
		//  + have not fired the press event yet
		if(
			this._click.pressed
			&& (Date.now() > this._click.last_press + this.opts.long_press_threshold)
			&& !this._click.long_press_fired && this.opts.long_press_enabled
		){
			// Long press threshold exceeded
			if(!(this.opts.repeat_enabled && this.opts.repeat_override_long)){
				// Fire except when repeat is enabled and we are overriding the long press with it.
				this._handle_press("long");
			}
			this._click.long_press_fired = true;
		}

		// Go again
		if(!this._removed){
			window.requestAnimationFrame(() => this._press_check_loop());
		}
	}

	// Call when the press is released on the input
	_release(do_checks = true){
		this._click.pressed = false;

		if(do_checks){
			if(!this.opts.double_press_enabled){
			
				if(!this._click.long_press_fired && !(this.opts.repeat_enabled && this.opts.repeat_fire_immediate)){
					// Just fire a single press!
					this._handle_press("single");
				}
	
			}else{	
				// If we haven't fired the longpress already
				if(!this._click.long_press_enabled || (this._click.long_press_enabled && !this._click.long_press_fired)){
					if(this._click.half_double_press_fired){
						// Fire a double click
						this._handle_press("double");
						this._click.half_double_press_fired = false;
					}else{
						// Save the first half of the doublepress
						this._click.half_double_press = Date.now();
						this._click.half_double_press_fired = true;
					}
				}
			}
			this._click.long_press_fired = false;
		}

		
	}
}