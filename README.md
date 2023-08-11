# Hardware UX Prototyping Tools

🕹️ 🎮 🎚️ 🎛️ 🎹 🔊 

A collection of mini JS libraries to support hardware UX prototyping. Each library is a standalone class, written in vanilla JS with no dependencies. Import or include as you wish!

These libraries are especially useful for building web UIs to interact with physical hardware controls.

Comments or questions: hello@interactionmagic.com 

## Libraries

| Library | What does it do? |
| --- | --- |
| [`Input.js`](https://lib.interactionmagic.com/src/Input.js) | Handles physical buttons via keyboard, Serial or click, including single/double/long presses |
| [`Undo.js`](https://lib.interactionmagic.com/src/Undo.js) | Provides undo/redo history stack | 
| [`Serial.js`](https://lib.interactionmagic.com/src/Serial.js) | Connect to and read/write data over serial with WebUSB |
| [`Logger.js`](https://lib.interactionmagic.com/src/Logger.js) | Creates a simple logging panel on the page. Include the [`Logger.css`](https://lib.interactionmagic.com/src/Logger.css) as well. |
| [`BLEComms.js`](https://lib.interactionmagic.com/src/BLEComms.js) | Sets up WebBluetooth connection with TX/RX to nRF52840 |
| [`WebMQTT.js`](https://lib.interactionmagic.com/src/WebMQTT.js) | Wrapper around Paho MQTT client for easy messaging |

## How to include

Download files on [Github](https://github.com/Interaction-Magic/ux-proto-tools), or direct link to hosted versions:

```html
<script src="https://lib.interactionmagic.com/src/Input.js"></script>
```