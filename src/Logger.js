//  ***********************************************
//  ***********************************************
//  Logger
// 
//  Author: George Cave @ Interaction Magic
//  Date: March 2022
// 
//  ***********************************************
//  
//  Simple logger for adding formatted messages to a log box
// 
//  ***********************************************
// 
//  Usage:
// 
//  const logger = new Logger({
//    container: document.querySelector(".log-container"), // Container for the log
//    filters_container: document.querySelector(".filters"),
//    filters: ['error']  // Filters to apply from the start
//  });
//  logger.log("Logging begun");
//
//
//  Example HTML:
//
//  <div class="log-container">
//	   <div class="log"></div>
//    <nav class="filters">
//      <a href="#" class="filter-btn" data-filter="status">📡</a>
//      <a href="#" class="filter-btn" data-filter="errors">⚠️</a>	
//    </nav>
//  </div>
//
// 
//  Public methods:
// 
//  Log a message
//  All options are optional, except the message itself:
//
//  const msg = logger.log("Msg here", {
//    time: new Date(),   // Time to record log entry for
//    char: '>',          // Separator character
//    colour: '#ff0000',  // Colour styling for text
//    hover: 'Msg info',  // Hover title text for msg
//    class: 'status',    // Class to add to log, e.g. for filtering
//    data: {             // Data to add to log entry's DOM dataset
//      "info": "special"
//    }
//  });
//
//

//  ***********************************************

class Logger{

	_default_opts = {
		filters: []
	};

	_default_msg_opts = {
		char: '>'
	};

	constructor(opts){
		this.opts = {...this._default_opts, ...opts};

		if(!this.opts.container){
			console.warn("No container for log specified");
		}

		// Add starting filters
		for(let f of this.opts.filters){
			this.opts.container.classList.add(`show-${f}`);
			if(this.opts.filters_container){
				this.opts.filters_container.classList.add(`show-${f}`);
			}	
		}

		// Add toggles for filters
		if(this.opts.filters_container){
			this.opts.filters_container.querySelectorAll(".filter-btn").forEach(btn => {
				btn.addEventListener("click", (e) => {
					e.preventDefault();
					if(btn.dataset.filter){
						
						const scroll_after = this._is_scrolled_bottom();
						const filter_class = `show-${btn.dataset.filter}`;

						this.opts.container.classList.toggle(filter_class);
						this.opts.filters_container.classList.toggle(filter_class, this.opts.container.classList.contains(filter_class));
						
						if(scroll_after){
							this._scroll_to_bottom();
						}
					}
				});
			});
		}
	}


	// Add new message
	// Pass a colour to quickly style the whole message
	// Or pass in msg text already styled
	log(msg, opts){

		// Merge opts with defaults
		this._default_msg_opts.time = new Date();
		opts = {...this._default_msg_opts, ...opts};

		// Generate new message
		const new_msg = document.createElement('p');

		// Which char to show as
		const char = opts.char ?? this.opts.char;

		// Format message
		new_msg.innerHTML = `
			<span class="time" title="${opts.time.toTimeString()}">
				${opts.time.toTimeString().substr(0,8)}
			</span>
			<span class="char">
				${char}
			</span>
			<span class="msg" style="${(opts.colour) ? 'color:'+opts.colour : ''}" title="${opts.hover ?? ''}">
				${msg}
			</span>`;

		// Set class of the <p>
		if(opts.class)	new_msg.classList.add(opts.class);

		// Add data properties to the log entry
		for(const d in opts.data){
			new_msg.dataset[d] = opts.data[d];
		}

		// See if we are already at the bottom, better for UI if user is looking at something higher up
		const will_scroll = this._is_scrolled_bottom();
	
		// Add message
		this.opts.container.append(new_msg);

		// Scroll to bottom
		if(will_scroll){
			this._scroll_to_bottom();
		}

		return new_msg;
	}

	_is_scrolled_bottom(){
		// 50 = small scroll buffer
		return (this.opts.container.offsetHeight + this.opts.container.scrollTop >= (this.opts.container.scrollHeight-50));
	}

	_scroll_to_bottom(){
		// Scroll to bottom
		this.opts.container.scrollTop = this.opts.container.scrollHeight;
	}
}