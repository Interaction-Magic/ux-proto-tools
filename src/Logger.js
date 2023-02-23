//  ***********************************************
//  ***********************************************
//  Logger
// 
//  Author: George Cave @ Interaction Magic
//  Date: February 2023
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
//    filters: ['error'],  // Filters to apply from the start
//    time_mode: 'clock',  // Display mode for time, can be 'clock', 'incremental' or 'timestamp'  
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
//      <a href="#download" class="action-btn" data-type="txt" data-include-hidden="true" data-include-meta="false">📥</a>	
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
//  download_log(opts)    // Download a copy of the log
//
//

//  ***********************************************

class Logger{

	_default_opts = {
		filters: [],
		time_mode: 'clock'
	};

	_default_msg_opts = {
		char: '>'
	};

	constructor(opts){
		this.opts = {...this._default_opts, ...opts};

		if(!this.opts.container){
			console.warn("No container for log specified");
		}

		this.start_time = Date.now();
		this.opts.container.dataset.start_time = this.start_time;

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

			// Add handlers for actions
			this.opts.filters_container.querySelectorAll(".action-btn").forEach(link => link.addEventListener("click", async (e) => {
				e.preventDefault()
				
				// Get the hash, to work out what sort of switch it is
				const url_target = link.href
				if(!url_target) return
				const hash = url_target.substring(url_target.indexOf('#') + 1)

				// Different options
				switch(hash){
		
					// Download dump of the log
					case "download":
						const opts = []
						if(link.dataset.type) opts.type = link.dataset.type
						if(link.dataset.includeHidden) opts.include_hidden = link.dataset.includeHidden == 'true'
						if(link.dataset.includeMeta) opts.include_meta = link.dataset.includeMeta == 'true'
						this.download_log(opts)
						break
				}
			}))
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

		// Add data properties to the log entry
		for(const d in opts.data){
			new_msg.dataset[d] = opts.data[d];
		}
		new_msg.dataset.timestamp = opts.time.getTime();
		new_msg.dataset.time_diff = opts.time.getTime() - this.start_time;

		// Which char to show as
		const char = opts.char ?? this.opts.char;

		// Generate time string
		let time_string = "";
		switch(this.opts.time_mode){
			case 'incremental':
				// 01:23
				const seconds = Math.floor((opts.time.getTime() - this.start_time)/1000) % 60;
				const minutes = Math.floor((opts.time.getTime() - this.start_time)/60000) % 60;
				time_string = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
				break;
			case 'timestamp':
				// 32913
				time_string = (opts.time.getTime() - this.start_time);
				break;
			case 'clock':
			default:
				// 11:02:23
				time_string = opts.time.toTimeString().substr(0,8);
				break;

		}
		// Format message
		new_msg.innerHTML = `
			<span class="time" title="${opts.time.toTimeString()}">${time_string}</span>
			<span class="char">${char}</span>
			<span class="msg" style="${(opts.colour) ? 'color:'+opts.colour : ''}" title="${opts.hover ?? ''}">${msg}</span>`;

		// Set class of the <p>
		if(opts.class)	new_msg.classList.add(opts.class);


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

	// /////////////////////////////////////////////////
	// Log downloading 
	download_log(opts = {}){

		// Opts can be
		opts = {...{
			type: 'csv',
			include_hidden: true,
			include_meta: true,
			filename_prefix: 'log_'
		}, ...opts};

		let data = [];

		// Assemble rows to download
		const p_rows = this.opts.container.querySelectorAll("p");
		for(let row of p_rows){
			const this_row = []

			if((row.offsetHeight <= 0) && !opts.include_hidden){
				// Skip row if hidden and we don't want to include hidden rows
				continue
			}

			let msg = row.querySelector('.msg').textContent
			if(opts.type == 'csv') msg = `"${msg.replaceAll('"', '""')}"`

			// Add base data
			this_row.push(
				row.querySelector(".time").textContent,
				row.querySelector(".char").textContent,
				msg
			)

			// Include meta data
			if(opts.include_meta){
				this_row.push(
					Array.from(row.classList).join(', '),
					row.querySelector(".time").title,
					row.dataset.timestamp,
					row.dataset.time_diff
				)

				// Save dataset items too if we have them
				for(let dataset_item in Object.assign({}, row.dataset)){
					if((dataset_item == 'timestamp') || (dataset_item == 'time_diff')){
						continue
					}
					this_row.push(`${dataset_item}: ${row.dataset[dataset_item]}`)
				}	
			}

			// Save to array of rows
			data.push(this_row)
		}

		// Create CSV
		let filedata = ''
		if(opts.type == 'csv'){
			filedata += 'Time,Type,Message'
			if(opts.include_hidden){
				filedata += ',Class,Datetime,Timestamp,Time diff,Message data'
			}
			filedata += '\n'
			data.forEach(row => filedata += `${row.join(',')}\n`)

		}else if(opts.type == 'txt'){
			data.forEach(row => filedata += `${row.join(' ')}\n`)
		}else{
			// Log error to self here!
			this.log(`Download type not recognised: ${opts.type}`, {class: 'error'})
			return
		}

		// Fix for # symbol breaking CSV files
		filedata = encodeURI(filedata)
		filedata = filedata.replaceAll('#', '%23')

		// Create filename and link data
		const filename = `${opts.filename_prefix}${Math.round(Date.now()/1000)}`
		const filename_with_suffix = `${filename}.${opts.type == 'csv' ? 'csv' : 'txt'}`
		const href = `data:text/${opts.type == 'csv' ? 'csv' : 'plain'};charset=utf-8,${filedata}`

		// Generate log entry with the link embedded in it
		this.log(`📥 Downloading log: <a class="${filename}" href="${href}" target="_blank" download="${filename_with_suffix}">${filename_with_suffix}</a>`)

		// Then trigger the download with a click
		document.querySelector(`.${filename}`).click()
	}
}
