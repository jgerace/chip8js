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

	var paused = false;
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
		paused = false;
		keyPresses = {}

		window.requestAnimationFrame = window.requestAnimationFrame
									    || window.mozRequestAnimationFrame
									    || window.webkitRequestAnimationFrame
									    || window.msRequestAnimationFrame
									    || function(f){return setTimeout(f, 1000/60)}

		var emulator = document.getElementById(elementId);
		initKeyMap();
		initScreen();
		getRom();
	}

	var initScreen = function() {
		screen = document.createElement('canvas');
		screen.width = DISPLAY_WIDTH * PIXEL_SIZE;
		screen.height = DISPLAY_HEIGHT * PIXEL_SIZE;
		screenContext = screen.getContext('2d');

		emulator.appendChild(screen);

		resetScreen();

		createInstructions(emulator);
	}

	var resetScreen = function() {
    	screenContext.fillStyle = 'black';
    	screenContext.fillRect(
    		0,
    		0,
    		DISPLAY_WIDTH * PIXEL_SIZE,
    		DISPLAY_HEIGHT * PIXEL_SIZE);
    }

    var createInstructions = function(emulatorElement) {
    	div = document.createElement('div');
    	instructionsHTML = '\
    			<h3>Controls</h3>\
    			<p>Hit W to start</p>\
    			<p>Q - Move Left<br>\
    			W - Shoot<br>\
    			E - Move Right</p>\
    		'
    	div.innerHTML = instructionsHTML;
    	emulatorElement.append(div);
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

	var getRom = function() {
		xhr = new XMLHttpRequest();
        xhr.open("GET", "./invaders.rom", true);
        xhr.responseType = "arraybuffer";

        xhr.onload = function () {
        	loadRom(new Uint8Array(xhr.response));
        	requestAnimationFrame(runCycle);
        };

        xhr.send()
	}

	var loadRom = function(rom) {
		for(var ii = 0; ii < rom.length; ii++) {
			memory[0x200 + ii] = rom[ii];
		}
	}

	var runCycle = function() {
		for(var ii = 0; ii < 10; ii++) {
			emulateCycle();
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
						sp--;
						pc = stack[sp];
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
				stack[sp] = pc;
				sp++;
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
						v[0xF] = +(v[x] > 255);
						v[x] = (v[x] & 0xFF);
						break;
					case 0x5:
						/*
						8xy5 - SUB Vx, Vy
						Set Vx = Vx - Vy, set VF = NOT borrow
						*/
						v[0xF] = +(v[x] > v[y]);
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
						v[0xF] = +(v[y] > v[x]);
						v[x] = (v[y] - v[x]) & 0xFF
						break;
					case 0xE:
						/*
						8xyE - SHL Vx {, Vy}
						Set Vx = Vx SHL 1
						*/
						v[0xF] = v[x] & 0x80;
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
						newPixel = +((spriteChar & 0x80) > 0);
						if(currPixel == 1 && newPixel == 0) {
							isPixelErased = true;
						}
						display[rowIdx + bit] ^= newPixel;
						spriteChar = spriteChar << 1;
					}
				}
				v[0xF] = +(isPixelErased) | 0;
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
							paused = false;
							for(var key in keyPresses) {
								v[x] = key;
							}
						}
						else {
							paused = true;
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
				}
				break;
			default:
				throw new Error("Unknown opcode: " + opcode.toString(16));
		}
	}

	// interface
	return {
		init: init
	}
})();

