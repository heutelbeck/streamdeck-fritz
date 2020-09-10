var websocket = null,
    contextArray = [],
	settings = {},
    DestinationEnum = Object.freeze({ 'HARDWARE_AND_SOFTWARE': 0, 'HARDWARE_ONLY': 1, 'SOFTWARE_ONLY': 2 }),
	defaultAddress = 'fritz.box',
	defaultUsername = '',
	defaultAin = '',
	defaultPassword = '',
	defaultAction = 'setswitchtoggle',
	defaultParameters = '';

function connectElgatoStreamDeckSocket (inPort, inUUID, inMessageType, inApplicationInfo, inActionInfo) 
{
	// Cleanup dangling websockt is exists and connect
	if (websocket) {
        websocket.close();
    };
  	websocket = new WebSocket('ws://127.0.0.1:' + inPort);

	// register the plugin
    websocket.onopen = function () {
        var json = {
            event: inMessageType,
            uuid: inUUID
        };
        websocket.send(JSON.stringify(json));
    };

    websocket.onclose = function (evt) {
        console.log('Websocket closed: ', evt);
    };

    websocket.onerror = function (evt) {
        console.warn('Websocket error:', evt);
    };

    websocket.onmessage = function (evt) {
        try {
            var jsonObj = JSON.parse(evt.data);
            var event = jsonObj['event'];
			/** dispatch message */
			let bEvt;
			if (event && event === 'willAppear') {
				bEvt = event;
			} else {
				bEvt = !jsonObj.hasOwnProperty('action') ? jsonObj.event : jsonObj.event + jsonObj['context'];
			}
			if (action.hasOwnProperty(bEvt)) {
				action[bEvt](jsonObj);
			}        
        } catch (error) {
            console.trace('Could not parse incoming message', error, evt.data);
        }
    };
}

var action = {

    willAppear: function (jsn) {
		var context = jsn.context;
		console.log("will appear for context: ",context);		
		
		let modified = false;
		if (jsn.hasOwnProperty('payload')) {
			if(jsn.payload.hasOwnProperty('settings')) {
				settings = jsn.payload.settings;
			} else {
				settings = {};
				modified = true;
			}
			console.log("existing settings: ",settings);		
			if(!settings.hasOwnProperty('address')){
				settings.address = defaultAddress;
				modified = true;
			}
			if(!settings.hasOwnProperty('username')){
				settings.username = defaultUsername;
				modified = true;
			}
			if(!settings.hasOwnProperty('ain'+context)){
				settings['ain'+context] = defaultAin;
				modified = true;
			}
			if(!settings.hasOwnProperty('password')){
				settings.password = defaultPassword;
				modified = true;
			}
			if(!settings.hasOwnProperty('action'+context)){
				settings['action'+context]=defaultAction;
				modified = true;
			}
			if(!settings.hasOwnProperty('parameters'+context)){
				settings['parameters'+context]=defaultParameters;
				modified = true;
			}
			if(modified == true) {
				console.log("wrote default values to settings. Send to Streamdeck and inspector...", settings);
				setSettings(jsn.context,settings);
				sendToPropertyInspector(jsn.context,settings);
			}
		}
		
        if (!contextArray.includes(jsn.context)) {
            contextArray.push(jsn.context);
        }

        action['keyDown' + jsn.context] = function (jsn) {
            console.log('**** action.KEYDOWN', jsn.context);
			console.log('execute action: ',settings['action'+jsn.context]);
		authnAndExecute(
			settings.address,
			settings.username,
			settings.password,
			settings['action'+jsn.context],
			settings['ain'+jsn.context], 
			settings['parameters'+jsn.context],
			function (result) {
					console.log("switch state now:",result);
			});
		};

        action['keyUp' + jsn.context] = function (jsn) {
            console.log('**** action.KEYUP', jsn.context);
        };

        action['sendToPlugin' + jsn.context] = function (jsn) {
            console.log('**** action.SENDTOPLUGIN', jsn.context, jsn);
            if (jsn.hasOwnProperty('payload')) {
                const pl = jsn.payload;
				if (pl.hasOwnProperty('sdpi_collection')) {
					console.log('got sendToPlugin sdpi_collection from PI:', pl.sdpi_collection);
					switch (pl.sdpi_collection['key']) {
						case 'addressinput':
							console.log("Address of Fritz!Box changed to:", pl.sdpi_collection['value']);
							settings.address = pl.sdpi_collection['value'];
							setSettings(jsn.context,settings);
							break;
						case 'usernameinput':
							console.log("Username changed to:", pl.sdpi_collection['value']);
							settings.username = pl.sdpi_collection['value'];
							setSettings(jsn.context,settings);
							break;
						case 'userpasswordinput':
							console.log("Password changed to:", pl.sdpi_collection['value']);
							settings.password = pl.sdpi_collection['value'];
							setSettings(jsn.context,settings);
							break;
						case 'aininput':
							console.log("AIN changed to:", pl.sdpi_collection['value']);
							settings['ain'+jsn.context] = pl.sdpi_collection['value'];
							setSettings(jsn.context,settings);
							break;
						case 'action_select':
							console.log("Action type changed to:", pl.sdpi_collection['value']);
							settings['action'+jsn.context] = pl.sdpi_collection['value'];
							setSettings(jsn.context,settings);
							break;
						case 'parametersinput':
							console.log("Parameters changed to:", pl.sdpi_collection['value']);
							settings['parameters'+jsn.context] = pl.sdpi_collection['value'];
							setSettings(jsn.context,settings);
							break;
						default:
							console.log("Unknown key ("+pl.sdpi_collection['key']+") changed to:", pl.sdpi_collection['value']);
							break;
					}
				} 
            }
        };

        action['willDisappear' + jsn.context] = function (jsn) {
            console.log('**** action.WILLDISAPPEAR', jsn.context, contextArray);
            contextArray = contextArray.filter(item => item !== jsn.context);
            console.log(contextArray);
        };

    }
	 
};

/** STREAM DECK COMMUNICATION */
function setSettings(context, settings) {
	var json = 	{
					"event"  : "setSettings",
					"context": context,
					"payload": settings
				};
	websocket.send(JSON.stringify(json));
};

function sendToPropertyInspector (context, jsonData) {
    var json = {
					'event'  : 'sendToPropertyInspector',
					'context': context,
					'payload': jsonData
				};
    console.log('sending to Property Inspector: ', JSON.stringify(json));
    websocket.send(JSON.stringify(json));
};