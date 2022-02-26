//  ***********************************************
//  ***********************************************
//  UNDO / REDO Handler
// 
//  Author: George Cave @ Interaction Magic
//  Date: February 2022
// 
//  ***********************************************
//  
//  Provides a framework for saving and restoring items in the history
// 
//  ***********************************************
// 
//  Usage:
// 
//  const undo = new Undo({
//  	undo_elm: 			DOM_item_for_undo_link,
//  	undoundo_elm: 		DOM_item_for_undoundo_link,
//  	save_to_storage: 	true, // set true to save to localStorage to preseve on page reload
// 		disabled_class:	"disabled" // class to add to links when they are not available
//  });
// 
//  Public methods:
// 
//  save(json_obj) -> save a new history state
//  undo() -> step backwards one step in history (returns the obj from that position)
//  undoundo() -> step forewards one step in history (returns the obj from that position)
//  retrieve() -> returns the obj from the current position
//  overwrite() -> update data in current position without creating a new history entry
//  has_undo -> returns an obj with possibility for undo right now, e.g: {undo: true, undoundo: false}
// 
//  Public properties:
// 
//  has_retrieved_from_storage -> is set true if success pulling data out of localStorage
// 
//  ***********************************************

class Undo{

	// Default options are below
	_default_opts = {
		disabled_class: "disabled",
		save_to_storage: true,			// Do we save stack to storage as we go
		debug: false
	};

	has_retrieved_from_storage = false;

	_stack = [];
	_current_index = -1;

	constructor(opts) {
		// Merge opts with defaults
		this.opts = {...this._default_opts, ...opts};

		// Restore from provided data, if provided
		if(this.opts.stack){
			this._stack = this.opts.stack;
		}
		if(this.opts._current_index){
			this._current_index = this.opts._current_index;
		}

		// Retrieve from storage
		if(this.opts.save_to_storage){
			try{
				if(localStorage.getItem('undo_stack')){
					this._stack = JSON.parse(localStorage.getItem('undo_stack'));
					this._current_index =  localStorage.getItem('undo_stack_position');
					this.has_retrieved_from_storage = true;
				}else{
					console.log("No localStorage to retrieve");
				}
			}catch{
				console.warn("Could not retrieve from localStorage");
			}
		}

		// Updated icons on screen
		this._update_elms();
	}

	// Save a new bookmark point
	save(data){
		if(this._current_index < (this._stack.length-1)){
			// If we aren't at the end of the stack, then wipe everything after this before saving
			this._stack.splice(this._current_index+1);
		}
		this._stack.push(JSON.parse(JSON.stringify(data))); // Deep copy of object into stack
		this._current_index++;

		if(this.opts.debug) console.log([this._current_index, this._stack]);

		this._save_to_storage();
		this._update_elms();
	}

	// Step backwards in the stack
	undo(){
		if(this._current_index > 0){
			this._current_index--;
			return this.retrieve();
		}
		return false;
	}

	// Step forwards in the stack
	undoundo(){
		if(this._current_index < (this._stack.length-1)){
			this._current_index++;
			return this.retrieve();
		}
		return false;
	}

	// Overwrite the current stack location without moving the stack
	overwrite(data){
		if(this._current_index < 0){
			// If stack is empty, save instead
			this.save(data);
		}
		this._stack[this._current_index] = JSON.parse(JSON.stringify(data));
		this._save_to_storage();
	}

	// Fetch the current stack contents
	retrieve(){
		this._save_to_storage();
		this._update_elms();

		if(this.opts.debug) console.log([this._current_index, this._stack]);

		return this._stack[this._current_index];
	}

	// Check if undo or undoundo is possible right now
	has_undo(){
		return {
			undo: (this._current_index>0) && (this._stack.length>0),
			undoundo: (this._current_index < (this._stack.length-1)) && (this._stack.length>0)
		};
	}

	// Updates the disabled class on the elements
	_update_elms(){
		const states = this.has_undo();
		if(this.opts.undo_elm){
			this.opts.undo_elm.classList.toggle(`${this.opts.disabled_class}`, !states.undo);
		}
		if(this.opts.undoundo_elm){
			this.opts.undoundo_elm.classList.toggle(`${this.opts.disabled_class}`, !states.undoundo);
		}
	}

	// Save to localStorage if needed
	_save_to_storage(){
		if(this.opts.save_to_storage){
			// Save to localStorage
			localStorage.setItem('undo_stack', JSON.stringify(this._stack));
			localStorage.setItem('undo_stack_position', this._current_index);
		}
	}
}
