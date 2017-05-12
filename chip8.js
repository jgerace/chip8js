var Chip8 = (function () {
	var REFRESH_RATE = 60; // hertz
	var DISPLAY_WIDTH = 64;
	var DISPLAY_HEIGHT = 32;
	var PIXEL_SIZE = 8;
	
	var memoryBuf = new ArrayBuffer(4096);
	var memory = new Uint8Array(memoryBuf);
	var v = new Array(16);
	var i = null;
	var delayTimer = null;
	var soundTimer = null;
	var pc = 0;
	var sp = 0;
	var stack = new Array(16);
	var drawFlag = false;

	var display = new Array(DISPLAY_WIDTH * DISPLAY_HEIGHT);
	var screen;
	var screenContext;

	var timer;

	var isDebugMode = false;
	var doStep = false;
	var keyPresses = {};

	var displayChars = [
		0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
		0x20, 0x60, 0x20, 0x20, 0x70, // 1
		0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
		0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
		0x90, 0x90, 0xF0, 0x10, 0x10, // 4
		0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
		0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
		0xF0, 0x10, 0x20, 0x40, 0x40, // 7
		0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
		0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
		0xF0, 0x90, 0xF0, 0x90, 0x90, // A
		0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
		0xF0, 0x80, 0x80, 0x80, 0xF0, // C
		0xE0, 0x90, 0x90, 0x90, 0xE0, // D
		0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
		0xF0, 0x80, 0xF0, 0x80, 0x80  // F
	];

	var init = function (elementId) {
		window.requestAnimationFrame = window.requestAnimationFrame
									    || window.mozRequestAnimationFrame
									    || window.webkitRequestAnimationFrame
									    || window.msRequestAnimationFrame
									    || function(f){return setTimeout(f, 1000/60)}

		var emulator = document.getElementById(elementId);

		initScreen();
	}

	var initScreen = function() {
		screen = document.createElement('canvas');
		screen.width = DISPLAY_WIDTH * PIXEL_SIZE;
		screen.height = DISPLAY_HEIGHT * PIXEL_SIZE;
		screenContext = screen.getContext('2d');

		emulator.appendChild(screen);

		resetScreen();

		createGameNav(emulator);
		createDebugger(emulator);
	}

	var initEmulator = function (romName) {
		initCPU();
		initKeyMap();
		getRom(romName);
	}

	var initCPU = function () {
		for(var ii = 0; ii < memory.length; ii++) {
			memory[ii] = 0;
		}

		for(var ii = 0; ii < v.length; ii++) {
			v[ii] = 0;
		}

		for(var ii = 0; ii < stack.length; ii++) {
			stack[ii] = 0;
		}

		for(var ii = 0; ii < displayChars.length; ii++) {
			memory[ii] = displayChars[ii];
		}

		for(var ii = 0; ii < display.length; ii++) {
			display[ii] = 0;
		}

		i = 0;
		delayTimer = 0;
		soundTimer = 0;
		pc = 0x200;
		sp = 0;

		keyPresses = {}
	}

	var resetScreen = function() {
    	screenContext.fillStyle = 'black';
    	screenContext.fillRect(
    		0,
    		0,
    		DISPLAY_WIDTH * PIXEL_SIZE,
    		DISPLAY_HEIGHT * PIXEL_SIZE);
    }

    var createGameNav = function(emulatorElement) {
    	divGames = document.createElement('div');
    	gamesHTML = '\
    		<select id="gameSelect">\
    			<option value="" disabled selected>Select a game</option>\
    			<option value="15PUZZLE">15PUZZLE</option>\
    			<option value="BLINKY">BLINKY</option>\
    			<option value="BLITZ">BLITZ</option>\
    			<option value="BRIX">BRIX</option>\
    			<option value="CONNECT4">CONNECT4</option>\
    			<option value="GUESS">GUESS</option>\
    			<option value="HIDDEN">HIDDEN</option>\
    			<option value="IBM">IBM</option>\
    			<option value="INVADERS">INVADERS</option>\
    			<option value="KALEID">KALEID</option>\
    			<option value="MAZE">MAZE</option>\
    			<option value="MERLIN">MERLIN</option>\
    			<option value="MISSILE">MISSILE</option>\
    			<option value="PONG">PONG</option>\
    			<option value="PONG2">PONG2</option>\
    			<option value="PUZZLE">PUZZLE</option>\
    			<option value="SYZYGY">SYZYGY</option>\
    			<option value="TANK">TANK</option>\
    			<option value="TETRIS">TETRIS</option>\
    			<option value="TICTAC">TICTAC</option>\
    			<option value="UFO">UFO</option>\
    			<option value="VBRIX">VBRIX</option>\
    			<option value="VERS">VERS</option>\
    			<option value="WIPEOFF">WIPEOFF</option>\
    		</select>\
    	'
    	divGames.innerHTML = gamesHTML;
    	emulatorElement.append(divGames);

    	div = document.createElement('div');
    	instructionsHTML = '\
			<h3>Controls</h3>\
			<code>\
			1 | 2 | 3 | 4<br>\
			Q | W | E | R<br>\
			A | S | D | F<br>\
			Z | X | C | V<br>\
			</code>\
			<p>Instructions differ for each game</p>\
			<h3>Controls for INVADERS</h3>\
			<p>Hit W to start</p>\
			<p>Q - Move Left<br>\
			W - Shoot<br>\
			E - Move Right</p>\
		'
    	div.innerHTML = instructionsHTML;
    	emulatorElement.append(div);


    	document.getElementById('gameSelect').addEventListener('change', function () {
    		gameSelect = document.getElementById('gameSelect');
    		initEmulator(gameSelect.options[gameSelect.selectedIndex].value);
    	});
    }

    var createDebugger = function(emulatorElement) {
    	divDebug = document.createElement('div');
    	debuggerHTML = '\
    		<button id="btnDebug">Debug Mode ON</button>\
    		<br/><br/>\
    		<button id="doStep">Next Instruction</button>\
    		<br/><br/>\
    		<b>Next opcode:</b>\
    		<p id="opcode"></p>\
    		<table>\
    			<tr>\
    				<thead>\
    					<td><b>PC</b></td>\
    					<td><b>SP</b></td>\
    					<td><b>I</b></td>\
    					<td><b>DT</b></td>\
    					<td><b>ST</b></td>\
    				</thead>\
    			</tr>\
    			<tr>\
					<td id="pc"></td>\
					<td id="sp"></td>\
					<td id="i"></td>\
					<td id="dt"></td>\
					<td id="st"></td>\
    			</tr>\
    		</table>\
    		<table>\
    			<tr>\
    				<thead>\
    					<td><b>V0</b></td>\
    					<td><b>V1</b></td>\
    					<td><b>V2</b></td>\
    					<td><b>V3</b></td>\
    					<td><b>V4</b></td>\
    					<td><b>V5</b></td>\
    					<td><b>V6</b></td>\
    					<td><b>V7</b></td>\
    					<td><b>V8</b></td>\
    					<td><b>V9</b></td>\
    					<td><b>VA</b></td>\
    					<td><b>VB</b></td>\
    					<td><b>VC</b></td>\
    					<td><b>VD</b></td>\
    					<td><b>VE</b></td>\
    					<td><b>VF</b></td>\
    				</thead>\
    			</tr>\
    			<tr>\
					<td id="v0"></td>\
					<td id="v1"></td>\
					<td id="v2"></td>\
					<td id="v3"></td>\
					<td id="v4"></td>\
					<td id="v5"></td>\
					<td id="v6"></td>\
					<td id="v7"></td>\
					<td id="v8"></td>\
					<td id="v9"></td>\
					<td id="va"></td>\
					<td id="vb"></td>\
					<td id="vc"></td>\
					<td id="vd"></td>\
					<td id="ve"></td>\
					<td id="vf"></td>\
    			</tr>\
    		</table>\
    	'
    	divDebug.innerHTML = debuggerHTML;
    	emulatorElement.append(divDebug);

    	document.getElementById('btnDebug').addEventListener('click', function(event) {
    		isDebugMode = !isDebugMode;
    		btnDebug = document.getElementById('btnDebug');
    		console.log(btnDebug);
    		btnDebug.innerHTML = 'Debug Mode ' + (isDebugMode ? "OFF" : "ON");
    	});
    	document.getElementById('doStep').addEventListener('click', function(event) {
    		doStep = true;
    	});
    }

    var updateDebuggerState = function() {
    	opcodeElem = document.getElementById('opcode');
    	nextOpcode = memory[pc] << 8 | memory[pc+1];
    	opcodeElem.innerHTML = getOpcodeDescription(nextOpcode);

    	pcElem = document.getElementById('pc');
    	pcElem.innerHTML = pc.toString(16);

    	spElem = document.getElementById('sp');
    	spElem.innerHTML = sp.toString(16);

    	iElem = document.getElementById('i');
    	iElem.innerHTML = i.toString(16);

    	dtElem = document.getElementById('dt');
    	dtElem.innerHTML = delayTimer;

    	stElem = document.getElementById('st');
    	stElem.innerHTML = soundTimer;

    	v0Elem = document.getElementById('v0');
    	v0Elem.innerHTML = v[0].toString(16);

    	v1Elem = document.getElementById('v1');
    	v1Elem.innerHTML = v[1].toString(16);

    	v2Elem = document.getElementById('v2');
    	v2Elem.innerHTML = v[2].toString(16);

    	v3Elem = document.getElementById('v3');
    	v3Elem.innerHTML = v[3].toString(16);

    	v4Elem = document.getElementById('v4');
    	v4Elem.innerHTML = v[4].toString(16);

    	v5Elem = document.getElementById('v5');
    	v5Elem.innerHTML = v[5].toString(16);

    	v6Elem = document.getElementById('v6');
    	v6Elem.innerHTML = v[6].toString(16);

    	v7Elem = document.getElementById('v7');
    	v7Elem.innerHTML = v[7].toString(16);

    	v8Elem = document.getElementById('v8');
    	v8Elem.innerHTML = v[8].toString(16);

    	v9Elem = document.getElementById('v9');
    	v9Elem.innerHTML = v[9].toString(16);

    	vaElem = document.getElementById('va');
    	vaElem.innerHTML = v[0xA].toString(16);

    	vbElem = document.getElementById('vb');
    	vbElem.innerHTML = v[0xB].toString(16);

    	vcElem = document.getElementById('vc');
    	vcElem.innerHTML = v[0xC].toString(16);

    	vdElem = document.getElementById('vd');
    	vdElem.innerHTML = v[0xD].toString(16);

    	veElem = document.getElementById('ve');
    	veElem.innerHTML = v[0xE].toString(16);

    	vfElem = document.getElementById('vf');
    	vfElem.innerHTML = v[0xF].toString(16);
    }

    var render = function(bitstring){
        for(var ii = 0; ii < bitstring.length; ii++) {
            x = ii % DISPLAY_WIDTH;
            y = Math.floor(ii / DISPLAY_WIDTH);

            if(bitstring[ii]) {
                drawPixel(x, y);
            }
            else {
                resetPixel(x, y);
            }
        }
    }

    var drawPixel = function(x, y) {
    	colorPixel(x, y, 'white');
    }

    var resetPixel = function(x, y) {
    	colorPixel(x, y, 'black');
    }

    var colorPixel = function(x, y, color) {
    	screenContext.fillStyle = color;
    	screenContext.fillRect(
    		x * PIXEL_SIZE,
    		y * PIXEL_SIZE,
    		PIXEL_SIZE,
    		PIXEL_SIZE);
    }

    var initKeyMap = function() {
    	var keyMap = {
			88: 0x0, // x
			49: 0x1, // 1
			50: 0x2, // 2
			51: 0x3, // 3
			81: 0x4, // q
			87: 0x5, // w
			69: 0x6, // e
			65: 0x7, // a
			83: 0x8, // s
			68: 0x9, // d
			90: 0xA, // z
			67: 0xB, // c
			52: 0xC, // 4
			82: 0xD, // r
			70: 0xE, // f
			86: 0xF  // v
		};

		document.addEventListener("keydown", function(event) {setKeyDown(keyMap[event.keyCode])})
		document.addEventListener("keyup", function(event) {setKeyUp(keyMap[event.keyCode])})
    }

   	var setKeyDown = function(key) {
		keyPresses[key] = true;
	}

	var setKeyUp = function(key) {
		delete keyPresses[key];
	}

	var clearDisplay = function() {
		for(var ii = 0; ii < display.length; ii++) {
			display[ii] = 0;
		}
		drawFlag = true;
	}

	var getRom = function(romName) {
		xhr = new XMLHttpRequest();
		romPath = "./static/" + romName;
        xhr.open("GET", romPath, true);
        xhr.overrideMimeType("text/plain; charset=x-user-defined");

        xhr.onload = function () {
        	loadRom(xhr.responseText);
        	requestAnimationFrame(runCycle);
        };

        xhr.send(null);
	}

	var loadRom = function(rom) {
		for(var ii = 0; ii < rom.length; ii++) {
			memory[0x200 + ii] = rom.charCodeAt(ii) & 0xFF;
		}
	}

	var runCycle = function() {
		for(var ii = 0; ii < 10; ii++) {
			if((isDebugMode && doStep) || !isDebugMode) {
				emulateCycle();
				updateDebuggerState();
				if(isDebugMode) {
					doStep = false;
				}
			}
		}

		if(drawFlag) {
			render(display);
			drawFlag = false;
		}

		updateTimers();

		requestAnimationFrame(runCycle);
	}

	var updateTimers = function() {
		if(delayTimer > 0) {
			delayTimer--;
		}

		if(soundTimer > 0) {
			// todo: beep!
			soundTimer--;
		}
	}

	var emulateCycle = function() {
		opcode = memory[pc] << 8 | memory[pc+1];

		pc += 2;

		switch(opcode & 0xF000) {
			case 0x0000:
				switch(opcode & 0x00EE) {
					case 0x00E0:
						/*
						00E0 - CLS
						Clear the display
						*/
						clearDisplay();
						break;
					case 0x00EE:
						/*
						00EE - RET
						Return from a subroutine
						*/
						pc = stack[sp];
						sp--;
						break;
				}
				break;
			case 0x1000:
				/*
				1nnn - JP addr
				Jump to location nnn
				*/
				pc = opcode & 0x0FFF;
				break;
			case 0x2000:
				/*
				2nnn - CALL addr
				Call subroutine at nnn
				*/
				sp++;
				stack[sp] = pc;
				pc = opcode & 0x0FFF;
				break;
			case 0x3000:
				/*
				3xkk - SE Vx, byte
				Skip next instruction if Vx = kk
				*/
				x = (opcode & 0x0F00) >>> 8;
				kk = opcode & 0x00FF;

				if(v[x] == kk) {
					pc += 2;
				}
				break;
			case 0x4000:
				/*
				4xkk - SNE Vx, byte
				Skip next instruction if Vx != kk
				*/
				x = (opcode & 0x0F00) >>> 8;
				kk = opcode & 0x00FF;

				if(v[x] != kk) {
					pc += 2;
				}
				break;
			case 0x5000:
				/*
				5xy0 - SE Vx, Vy
				Skip next instruction if Vx = Vy
				*/
				x = (opcode & 0x0F00) >>> 8;
				y = (opcode & 0x00F0) >>> 4;

				if(v[x] == v[y]) {
					pc += 2;
				}
				break;
			case 0x6000:
				/*
				6xkk - LD Vx, byte
				Set Vx = kk
				*/
				x = (opcode & 0x0F00) >>> 8;
				kk = opcode & 0x00FF;

				v[x] = kk;
				break;
			case 0x7000:
				/*
				7xkk - ADD Vx, byte
				Set Vx = Vx + kk
				*/
				x = (opcode & 0x0F00) >>> 8;
				kk = opcode & 0x00FF;

				v[x] = (v[x] + kk) & 0xFF;
				break;
			case 0x8000:
				x = (opcode & 0x0F00) >>> 8;
				y = (opcode & 0x00F0) >>> 4;

				switch(opcode & 0x000F) {
					case 0x0:
						/*
						8xy0 - LD Vx, Vy
						Set Vx = Vy
						*/
						v[x] = v[y];
						break;
					case 0x1:
						/*
						8xy1 - OR Vx, Vy
						Set Vx = Vx OR Vy
						*/
						v[x] |= v[y];
						break;
					case 0x2:
						/*
						8xy2 - AND Vx, Vy
						Set Vx = Vx AND Vy
						*/
						v[x] &= v[y];
						break;
					case 0x3:
						/*
						8xy3 - XOR Vx, Vy
						Set Vx = Vx XOR Vy
						*/
						v[x] ^= v[y];
						break;
					case 0x4:
						/*
						8xy4 - ADD Vx, Vy
						Set Vx = Vx + Vy, set VF = carry
						*/
						v[x] += v[y];
						v[0xF] = v[x] > 255 ? 1 : 0;
						v[x] = (v[x] & 0xFF);
						break;
					case 0x5:
						/*
						8xy5 - SUB Vx, Vy
						Set Vx = Vx - Vy, set VF = NOT borrow
						*/
						v[0xF] = v[x] > v[y] ? 1 : 0;
						v[x] = (v[x] - v[y]) & 0xFF;
						break;
					case 0x6:
						/*
						8xy6 - SHR Vx {, Vy}
						Set Vx = Vx SHR 1
						*/
						v[0xF] = v[x] & 0x1;
						v[x] = v[x] >>> 1;
						break;
					case 0x7:
						/*
						8xy7 - SUBN Vx, Vy
						Set Vx = Vy - Vx, set VF = NOT borrow
						*/
						v[0xF] = v[y] > v[x] ? 1 : 0;
						v[x] = (v[y] - v[x]) & 0xFF
						break;
					case 0xE:
						/*
						8xyE - SHL Vx {, Vy}
						Set Vx = Vx SHL 1
						*/
						v[0xF] = (v[x] & 0x80) === 0x80 ? 1 : 0;
						v[x] = (v[x] << 1) & 0xFF;
						break;
				}
				break;
			case 0x9000:
				/*
				9xy0 - SNE Vx, Vy
				Skip next instruction if Vx != Vy
				*/
				x = (opcode & 0x0F00) >>> 8;
				y = (opcode & 0x00F0) >>> 4;

				if(v[x] != v[y]) {
					pc += 2;
				}
				break;
			case 0xA000:
				/*
				Annn - LD I, addr
				Set I = nnn
				*/
				i = opcode & 0x0FFF;
				break;
			case 0xB000:
				/*
				Bnnn - JP V0, addr
				Jump to location nnn + V0
				*/
				pc = (opcode & 0x0FFF) + v[0];
				break;
			case 0xC000:
				/*
				Cxkk - RND Vx, byte
				Set Vx = random byte AND kk
				*/
				x = (opcode & 0x0F00) >>> 8;
				v[x] = Math.floor(Math.random() * 0xFF) & (opcode & 0x00FF);
				break;
			case 0xD000:
				/*
				Dxyn - DRW Vx, Vy, nibble
				Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision
				*/
				x = (opcode & 0x0F00) >> 8;
				y = (opcode & 0x00F0) >> 4;
				n = opcode & 0x000F;
				
				isPixelErased = false;
				for(var byte = 0; byte < n; byte++) {
					rowIdx = (v[y] + byte) * DISPLAY_WIDTH + v[x];
					var spriteChar = memory[i+byte];
					for(var bit = 0; bit < 8; bit++) {
						currPixel = display[rowIdx + bit];
						newPixel = (spriteChar & 0x80) > 0 ? 1 : 0;
						display[rowIdx + bit] ^= newPixel;
						if(currPixel == 1 && display[rowIdx + bit] == 0) {
							isPixelErased = true;
						}
						spriteChar = spriteChar << 1;
					}
				}
				v[0xF] = isPixelErased ? 1 : 0;
				drawFlag = true;
				break;
			case 0xE000:
				x = (opcode & 0x0F00) >>> 8;
				switch(opcode & 0x00FF) {
					case 0x009E:
						/*
						Ex9E - SKP Vx
						Skip next instruction if key with the value of Vx is pressed
						*/
						if(keyPresses[v[x]]) {
							pc += 2;
						}
						break;
					case 0x00A1:
						/*
						ExA1 - SKNP Vx
						Skip next instruction if key with the value of Vx is not pressed
						*/
						if(!keyPresses[v[x]]) {
							pc += 2;
						}
						break;
					default:
						console.log("Unknown E instruction: " + opcode.toString(16));
						break;
				}
				break;
			case 0xF000:
				x = (opcode & 0x0F00) >>> 8;

				switch(opcode & 0x00FF) {
					case 0x07:
						/*
						Fx07 - LD Vx, DT
						Set Vx = delay timer value
						*/
						v[x] = delayTimer;
						break;
					case 0x0A:
						/*
						Fx0A - LD Vx, K
						Wait for a key press, store the value of the key in Vx
						*/
						if(keyPresses.length > 0) {
							//paused = false;
							for(var key in keyPresses) {
								v[x] = key;
							}
						}
						else {
							//paused = true;
							pc -= 2;
						}
						break;
					case 0x15:
						/*
						Fx15 - LD DT, Vx
						Set delay timer = Vx
						*/
						delayTimer = v[x];
						break;
					case 0x18:
						/*
						Fx18 - LD ST, Vx
						Set sound timer = Vx
						*/
						soundTimer = v[x];
						break;
					case 0x1E:
						/*
						Fx1E - ADD I, Vx
						Set I = I + Vx
						*/
						i = i + v[x]
						break;
					case 0x29:
						/*
						Fx29 - LD F, Vx
						Set I = location of sprite for digit Vx
						*/
						i = v[x] * 5;
						break;
					case 0x33:
						/*
						Fx33 - LD B, Vx
						Store BCD representation of Vx in memory locations I, I+1, and I+2
						*/
						num = v[x];
						for(var offset = 2; offset >= 0; offset--) {
							memory[i+offset] = num % 10;
							num = Math.floor(num / 10);
						}
						break;
					case 0x55:
						/*
						Fx55 - LD [I], Vx
						Store registers V0 through Vx in memory starting at location I
						*/
						for(var offset = 0; offset <= x; offset++) {
							memory[i + offset] = v[offset];
						}
						break;
					case 0x65:
						/*
						Fx65 - LD Vx, [I]
						Read registers V0 through Vx from memory starting at location I
						*/
						for(var offset = 0; offset <= x; offset++) {
							v[offset] = memory[i + offset];
						}
						break;
					default:
						console.log("Unknown F instruction opcode: " + opcode.toString(16));
						break;
				}
				break;
			default:
				throw new Error("Unknown opcode: " + opcode.toString(16));
		}
	}

	var getOpcodeDescription = function(opcode) {
		var description = opcode.toString(16) + ' ';
		switch(opcode & 0xF000) {
			case 0x0000:
				switch(opcode & 0x00EE) {
					case 0x00E0:
						description = description.concat('CLS        // Clear display');
						break;
					case 0x00EE:
						description = description.concat('RET        // Return from subroutine');
						break;
				}
				break;
			case 0x1000:
				nnn = opcode & 0x0FFF;
				description = description.concat('JMP ' + nnn.toString(16) + '    // Jump to addr');
				break;
			case 0x2000:
				nnn = opcode & 0x0FFF;
				description = description.concat('CALL ' + nnn.toString(16) + '   // Call subroutine');
				break;
			case 0x3000:
				x = (opcode & 0x0F00) >>> 8;
				kk = opcode & 0x00FF;
				description = description.concat('SE v[' + x.toString(16) + '], ' + kk.toString(16) + ' // Skip if Vx == kk');
				break;
			case 0x4000:
				x = (opcode & 0x0F00) >>> 8;
				kk = opcode & 0x00FF;
				description = description.concat('SNE v[' + x.toString(16) + '], ' + kk.toString(16) + ' // Skip if Vx != kk');
				break;
			case 0x5000:
				x = (opcode & 0x0F00) >>> 8;
				y = (opcode & 0x00F0) >>> 4;
				description = description.concat('SE v[' + x.toString(16) + '], v[' + y.toString(16) + '] // Skip if Vx == Vy');
				break;
			case 0x6000:
				x = (opcode & 0x0F00) >>> 8;
				kk = opcode & 0x00FF;
				description = description.concat('LD v[' + x.toString(16) + '], ' + kk.toString(16) + ' // Set Vx = kk');
				break;
			case 0x7000:
				x = (opcode & 0x0F00) >>> 8;
				kk = opcode & 0x00FF;
				description = description.concat('ADD v[' + x.toString(16) + '], ' + kk.toString(16) + ' // Set Vx = Vx + kk');
				break;
			case 0x8000:
				x = (opcode & 0x0F00) >>> 8;
				y = (opcode & 0x00F0) >>> 4;

				switch(opcode & 0x000F) {
					case 0x0:
						description = description.concat('LD v[' + x.toString(16) + '], v[' + y.toString(16) + '] // Set Vx = Vy');
						break;
					case 0x1:
						description = description.concat('OR v[' + x.toString(16) + '], v[' + y.toString(16) + '] // Set Vx |= Vy');
						break;
					case 0x2:
						description = description.concat('AND v[' + x.toString(16) + '], v[' + y.toString(16) + '] // Set Vx &= Vy');
						break;
					case 0x3:
						description = description.concat('XOR v[' + x.toString(16) + '], v[' + y.toString(16) + '] // Set Vx ^= Vy');
						break;
					case 0x4:
						description = description.concat('ADD v[' + x.toString(16) + '], v[' + y.toString(16) + '] // Add Vx, Vy VF = carry');
						break;
					case 0x5:
						description = description.concat('SUB v[' + x.toString(16) + '], v[' + y.toString(16) + '] // Sub Vx, Vy VF = NOT borrow');
						break;
					case 0x6:
						description = description.concat('SHR v[' + x.toString(16) + ']{, v[' + y.toString(16) + ']} // Shift right Vx');
						break;
					case 0x7:
						description = description.concat('SUBN v[' + x.toString(16) + '], v[' + y.toString(16) + '] // Sub Vy, Vx VF = NOT borrow');
						break;
					case 0xE:
						description = description.concat('SHL v[' + x.toString(16) + ']{, v[' + y.toString(16) + ']} // Shift left Vx');
						break;
				}
				break;
			case 0x9000:
				description = description.concat('SNE v[' + x.toString(16) + '], v[' + y.toString(16) + '] // Skip if Vx != Vy');
				break;
			case 0xA000:
				nnn = opcode & 0x0FFF;
				description = description.concat('LD I, ' + nnn.toString(16) + ' // Set I = nnn');
				break;
			case 0xB000:
				nnn = opcode & 0x0FFF;
				description = description.concat('JP V[0], ' + nnn.toString(16) + ' // Jump to nnn + V0');
				break;
			case 0xC000:
				x = (opcode & 0x0F00) >>> 8;
				kk = opcode & 0x00FF;
				description = description.concat('RND v[' + x.toString(16) + '], ' + kk.toString(16) + ' // Set Vx = random byte AND kk');
				break;
			case 0xD000:
				x = (opcode & 0x0F00) >> 8;
				y = (opcode & 0x00F0) >> 4;
				n = opcode & 0x000F;
				description = description.concat('DRW v[' + x.toString(16) + '], v[' + y.toString(16) + '], ' + n.toString(16) + ' // Draw Vx, Vy, n');
				break;
			case 0xE000:
				x = (opcode & 0x0F00) >>> 8;
				switch(opcode & 0x00FF) {
					case 0x009E:
						description = description.concat('SKP v[' + x.toString(16) + '] // Skip if key Vx pressed');
						break;
					case 0x00A1:
						description = description.concat('SKNP v[' + x.toString(16) + '] // Skip if key Vx NOT pressed');
						break;
				}
				break;
			case 0xF000:
				x = (opcode & 0x0F00) >>> 8;

				switch(opcode & 0x00FF) {
					case 0x07:
						description = description.concat('LD v[' + x.toString(16) + '] DT // Set Vx = delay timer');
						break;
					case 0x0A:
						description = description.concat('LD v[' + x.toString(16) + '], K // Wait for key press');
						break;
					case 0x15:
						description = description.concat('LD DT, v[' + x.toString(16) + '] // Set delay timer = Vx');
						break;
					case 0x18:
						description = description.concat('LD ST, v[' + x.toString(16) + '] // Set sound timer = Vx');
						break;
					case 0x1E:
						description = description.concat('ADD I, v[' + x.toString(16) + '] // Set I = I + Vx');
						break;
					case 0x29:
						description = description.concat('LD F, v[' + x.toString(16) + '] // Set I = location of sprite Vx');
						break;
					case 0x33:
						description = description.concat('LD B, v[' + x.toString(16) + '] // BCD of Vx in memory locs I, I+1, I+2');
						break;
					case 0x55:
						description = description.concat('LD [I], v[' + x.toString(16) + '] // Store V0 through Vx in mem loc I');
						break;
					case 0x65:
						description = description.concat('LD v[' + x.toString(16) + '], [I] // Read V0 through Vx from mem loc I');
						break;
				}
				break;
			default:
				description = description.concat('Unknown opcode');
		}
		return description;
	}

	var test = function () {
		initCPU();

		setOpcode(0x1999);
		emulateCycle();
		if(pc != 0x0999) {
			throw new Error('Error in jump');
		}
		initCPU();

		setOpcode(0x2999);
		emulateCycle();
		if(sp != 1 || stack[sp] != 0x202 || pc != 0x0999) {
			throw new Error('Error in call');
		}
		initCPU();

		setOpcode(0x3100);
		emulateCycle();
		if(pc != 0x204) {
			throw new Error('Error in skip equal, equal');
		}
		initCPU();

		setOpcode(0x3101);
		emulateCycle();
		if(pc != 0x202) {
			throw new Error('Error in skip equal, unequal');
		}
		initCPU();

		setOpcode(0x4101);
		v[1] = 0x01;
		emulateCycle();
		if(pc != 0x202) {
			console.log(pc.toString(16))
			throw new Error('Error in skip not equal, equal');
		}
		initCPU();

		setOpcode(0x4101);
		v[1] = 0x0;
		emulateCycle();
		if(pc != 0x204) {
			throw new Error('Error in skip not equal, not equal');
		}
		initCPU();

		setOpcode(0x5120);
		v[1] = 0x0;
		v[2] = 0x0;
		emulateCycle();
		if(pc != 0x204) {
			throw new Error('Error in skip on vx vy equals, equal');
		}
		initCPU();

		setOpcode(0x5120);
		v[1] = 0x0;
		v[2] = 0x1;
		emulateCycle();
		if(pc != 0x202) {
			throw new Error('Error in skip on vx vy equals, not equal');
		}
		initCPU();

		setOpcode(0x6199);
		v[1] = 0x0;
		emulateCycle();
		if(v[1] != 0x99) {
			throw new Error('Error in set vx');
		}
		initCPU();

		setOpcode(0x7199);
		v[1] = 0x5;
		emulateCycle();
		if(v[1] != 0x9E) {
			throw new Error('Error in add to vx');
		}
		initCPU();

		setOpcode(0x7199);
		v[1] = 0x77;
		emulateCycle();
		if(v[1] != 0x10) {
			throw new Error('Error in add to vx, overflow');
		}
		initCPU();

		setOpcode(0x8120);
		v[1] = 0x10;
		v[2] = 0x09;
		emulateCycle();
		if(v[1] != 0x09) {
			throw new Error('Error in vx = vy');
		}
		initCPU();

		setOpcode(0x8121);
		v[1] = 0x10;
		v[2] = 0x09;
		emulateCycle();
		if(v[1] != 0x19) {
			throw new Error('Error in vx |= vy');
		}
		initCPU();

		setOpcode(0x8122);
		v[1] = 0x0F;
		v[2] = 0x0E;
		emulateCycle();
		if(v[1] != 0x0E) {
			throw new Error('Error in vx &= vy');
		}
		initCPU();

		setOpcode(0x8123);
		v[1] = 0x09;
		v[2] = 0x0F;
		emulateCycle();
		if(v[1] != 0x06) {
			throw new Error('Error in vx ^= vy');
		}
		initCPU();

		setOpcode(0x8124);
		v[1] = 0x0F;
		v[2] = 0x0E;
		emulateCycle();
		if(v[1] != 0x1D || v[0xF] != 0) {
			throw new Error('Error in add vx, vy');
		}
		initCPU();

		setOpcode(0x8124);
		v[1] = 0xFF;
		v[2] = 0x01;
		emulateCycle();
		if(v[1] != 0x00 || v[0xF] != 1) {
			throw new Error('Error in add vx, vy with carry');
		}
		initCPU();

		setOpcode(0x8125);
		v[1] = 0xFF;
		v[2] = 0x01;
		emulateCycle();
		if(v[1] != 0xFE || v[0xF] != 1) {
			throw new Error('Error in sub vx, vy');
		}
		initCPU();

		setOpcode(0x8125);
		v[1] = 0x01;
		v[2] = 0x02;
		emulateCycle();
		if(v[1] != 0xFF || v[0xF] != 0) {
			throw new Error('Error in sub vx, vy with borrow');
		}
		initCPU();

		setOpcode(0x8126);
		v[1] = 0x08;
		emulateCycle();
		if(v[1] != 0x04 || v[0xF] != 0) {
			throw new Error('Error in shift right vx');
		}
		initCPU();

		setOpcode(0x8126);
		v[1] = 0x09;
		emulateCycle();
		if(v[1] != 0x04 || v[0xF] != 1) {
			throw new Error('Error in shift right vx with carry');
		}
		initCPU();

		setOpcode(0x8127);
		v[1] = 0x05;
		v[2] = 0x10;
		emulateCycle();
		if(v[1] != 0x0B || v[0xF] != 1) {
			throw new Error('Error in sub vy, vx with borrow');
		}
		initCPU();

		setOpcode(0x8127);
		v[1] = 0x10;
		v[2] = 0x05;
		emulateCycle();
		if(v[1] != 0xF5 || v[0xF] != 0) {
			throw new Error('Error in sub vy, vx');
		}
		initCPU();

		setOpcode(0x810E);
		v[1] = 0x04;
		emulateCycle();
		if(v[1] != 0x08 || v[0xF] != 0) {
			throw new Error('Error in shift left vx');
		}
		initCPU();

		setOpcode(0x810E);
		v[1] = 0x80;
		emulateCycle();
		if(v[1] != 0x00 || v[0xF] != 1) {
			throw new Error('Error in shift left vx with carry');
		}
		initCPU();

		setOpcode(0x9120);
		v[1] = 0x80;
		v[2] = 0x10;
		emulateCycle();
		if(pc != 0x204) {
			throw new Error('Error in skip vx not equals vy');
		}
		initCPU();

		setOpcode(0x9120);
		v[1] = 0x80;
		v[2] = 0x80;
		emulateCycle();
		if(pc != 0x202) {
			throw new Error('Error in skip vx not equals vy, no skip');
		}
		initCPU();

		setOpcode(0xA700);
		emulateCycle();
		if(i != 0x700) {
			throw new Error('Error in load I');
		}
		initCPU();

		setOpcode(0xB700);
		v[0] = 0x09;
		emulateCycle();
		if(pc != 0x709) {
			throw new Error('Error in jump to nnn + v0');
		}
		initCPU();

		/*
		Dxyn - DRW Vx, Vy, nibble
		Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision
		*/
		setOpcode(0xD015);
		v[0] = 0;
		v[1] = 0;
		i = 0;
		emulateCycle();
		var expectedDisplay = new Array(DISPLAY_WIDTH * DISPLAY_HEIGHT);
		for(var ii = 0; ii < DISPLAY_WIDTH*DISPLAY_HEIGHT; ii++) { expectedDisplay[ii] = 0; }
		expectedDisplay[0] = 1; expectedDisplay[1] = 1; expectedDisplay[2] = 1; expectedDisplay[3] = 1;
		expectedDisplay[64] = 1; expectedDisplay[65] = 0; expectedDisplay[66] = 0; expectedDisplay[67] = 1;
		expectedDisplay[128] = 1; expectedDisplay[129] = 0; expectedDisplay[130] = 0; expectedDisplay[131] = 1;
		expectedDisplay[192] = 1; expectedDisplay[193] = 0; expectedDisplay[194] = 0; expectedDisplay[195] = 1;
		expectedDisplay[256] = 1; expectedDisplay[257] = 1; expectedDisplay[258] = 1; expectedDisplay[259] = 1;
		for(var ii = 0; ii < DISPLAY_WIDTH*DISPLAY_HEIGHT; ii++) {
			if(expectedDisplay[ii] != display[ii]) {
				throw new Error('Error in display sprite');
			}
		}
		initCPU();

		setOpcode(0xD015);
		v[0] = 0;
		v[1] = 0;
		i = 0;
		display[1] = 1;
		emulateCycle();
		var expectedDisplay = new Array(DISPLAY_WIDTH * DISPLAY_HEIGHT);
		for(var ii = 0; ii < DISPLAY_WIDTH*DISPLAY_HEIGHT; ii++) { expectedDisplay[ii] = 0; }
		expectedDisplay[0] = 1; expectedDisplay[1] = 0; expectedDisplay[2] = 1; expectedDisplay[3] = 1;
		expectedDisplay[64] = 1; expectedDisplay[65] = 0; expectedDisplay[66] = 0; expectedDisplay[67] = 1;
		expectedDisplay[128] = 1; expectedDisplay[129] = 0; expectedDisplay[130] = 0; expectedDisplay[131] = 1;
		expectedDisplay[192] = 1; expectedDisplay[193] = 0; expectedDisplay[194] = 0; expectedDisplay[195] = 1;
		expectedDisplay[256] = 1; expectedDisplay[257] = 1; expectedDisplay[258] = 1; expectedDisplay[259] = 1;
		for(var ii = 0; ii < DISPLAY_WIDTH*DISPLAY_HEIGHT; ii++) {
			if(expectedDisplay[ii] != display[ii]) {
				console.log(ii);
				console.log(expectedDisplay[ii]);
				console.log(display[ii]);
				throw new Error('Error in display sprite, carry flag set');
			}
		}
		if(v[0xF] != 1) {
			console.log(v[0xF]);
			throw new Error('Error in display sprite, carry flag set');
		}
		initCPU();

		setOpcode(0xE19E);
		v[1] = 0x09;
		keyPresses[0x09] = true;
		emulateCycle();
		if(pc != 0x204) {
			throw new Error('Error skip on key');
		}
		initCPU();

		setOpcode(0xE19E);
		v[1] = 0x09;
		emulateCycle();
		if(pc != 0x202) {
			throw new Error('Error skip on key, no skip');
		}
		initCPU();

		setOpcode(0xF107);
		delayTimer = 0x03;
		emulateCycle();
		if(v[1] != 0x03) {
			throw new Error('Error load DT in vx');
		}
		initCPU();

		/*
		TODO: Fx0A
		*/

		setOpcode(0xF115);
		v[1] = 0x03;
		emulateCycle();
		if(delayTimer != 0x03) {
			throw new Error('Error load vx in DT');
		}
		initCPU();

		setOpcode(0xF118);
		v[1] = 0x03;
		emulateCycle();
		if(soundTimer != 0x03) {
			throw new Error('Error load vx in ST');
		}
		initCPU();

		setOpcode(0xF11E);
		v[1] = 0x03;
		i = 0x10;
		emulateCycle();
		if(i != 0x13) {
			throw new Error('Error set I');
		}
		initCPU();

		setOpcode(0xF129);
		v[1] = 0x04;
		emulateCycle();
		if(i != 0x14) {
			throw new Error('Error set I to sprite');
		}
		initCPU();

		setOpcode(0xF133);
		v[1] = 0x7B;
		i = 0x900
		emulateCycle();
		if(memory[0x900] != 1 || memory[0x901] != 2 || memory[0x902] != 3) {
			throw new Error('Error in BCD vx');
		}
		initCPU();

		setOpcode(0xF855);
		for(var ii = 0; ii <= 8; ii++) {
			v[ii] = ii;
		}
		i = 0x900
		emulateCycle();
		for(var ii = 0; ii <= 8; ii++) {
			if(memory[0x900+ii] != v[ii]) {
				throw new Error('Error in load registers to memory, i=' + ii)
			}
		}
		initCPU();

		setOpcode(0xF865);
		i = 0x900
		for(var ii = 0; ii <= 8; ii++) {
			memory[i+ii] = ii;
		}
		emulateCycle();
		for(var ii = 0; ii <= 8; ii++) {
			if(v[ii] != ii) {
				throw new Error('Error in load registers from memory, i=' + ii)
			}
		}
		initCPU();

		console.log("All tests passed");
	}

	var setOpcode = function (opcode) {
		memory[0x200] = (opcode & 0xFF00) >> 8;
		memory[0x201] = opcode & 0x00FF;
	}

	// interface
	return {
		init: init,
		test: test
	}
})();

