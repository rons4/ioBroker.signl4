"use strict";

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
// const fs = require("fs");

const axios = require("axios");

let adapter = null;

class Signl4 extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "signl4",
		});

		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		//this.on("objectChange", this.onObjectChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:

		if  (this.config.signl4_webhook_url == null) {
			this.config.signl4_webhook_url = "";
		}
		if  (this.config.x_s4_service == null) {
			this.config.x_s4_service = "";
		}
		if  (this.config.x_s4_location == null) {
			this.config.x_s4_location = "";
		}
		if  (this.config.x_s4_alertingscenario == null) {
			this.config.x_s4_alertingscenario = "";
		}
		if  (this.config.x_s4_filtering == null) {
			this.config.x_s4_filtering = false;
		}
		if  (this.config.x_s4_externalid == null) {
			this.config.x_s4_externalid = "";
		}
		if  (this.config.x_s4_status == null) {
			this.config.x_s4_status = "";
		}

		this.log.info("config SIGNL4 Webhook URL: " + this.config.signl4_webhook_url);
		this.log.info("config X-S4-Service: " + this.config.x_s4_service);
		this.log.info("config X-S4-Location: " + this.config.x_s4_location);
		this.log.info("config X-S4-AlertingScenario: " + this.config.x_s4_alertingscenario);
		this.log.info("config X-S4-Filtering: " + this.config.x_s4_filtering);
		this.log.info("config X-S4-ExternalID: " + this.config.x_s4_externalid);
		this.log.info("config X-S4-Status: " + this.config.x_s4_status);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "statusLastAlert"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		await this.setObjectNotExistsAsync("statusLastAlert", {
			type: "state",
			common: {
				name: "statusLastAlert",
				type: "boolean",
				role: "indicator",
				read: true,
				write: true,
			},
			native: {},
		});

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates("statusLastAlert");
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// same thing, but the value is flagged "ack"
		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		await this.setStateAsync("statusLastAlert", { val: '', ack: true, expire: 60 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync("admin", "iobroker");
		this.log.info("check user admin pw iobroker: " + result);

		result = await this.checkGroupAsync("admin", "admin");
		this.log.info("check group user admin group admin: " + result);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	onMessage(obj) {
	if (typeof obj === "object" && obj.message) {
		if (obj.command === "send") {
			// e.g. send email or pushover or whatever
			this.log.info("send command");

				// Send SIGNL4 alert
				this.sendSIGNL4Alert(obj.message);

				// Send response in callback if required
				if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
			}
 		}
	}

	// Send SIGNL4 alert
	sendSIGNL4Alert(data) {

		let json = JSON.parse(JSON.stringify(data));

		json["X-S4-Service"] = this.config.x_s4_service;
		json["X-S4-Location"] = this.config.x_s4_location;
		json["X-S4-AlertingScenario"] = this.config.x_s4_alertingscenario;
		json["X-S4-Filtering"] = this.config.x_s4_filtering;
		json["X-S4-ExternalID"] = this.config.x_s4_externalid;
		json["X-S4-Status"] = this.config.x_s4_status;
		json["X-S4-SourceSystem"] = "ioBroker";

		// Remember adapter for callback functions
		adapter = this;

		// Send request
		axios.post(this.config.signl4_webhook_url, json)
			.then(function (response) {
				// OK
				adapter.log.info(response);

				adapter.setStateAsync('statusLastAlert', JSON.stringify(response.data));

			})
			.catch(function (error) {
				// Error
				adapter.log.error(error);
			});
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Signl4(options);
} else {
	// otherwise start the instance directly
	new Signl4();
}