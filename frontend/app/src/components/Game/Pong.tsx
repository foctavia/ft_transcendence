import { useState, useRef, useEffect, useCallback } from 'react';
import { PongInfo, BallInfo, PongProp } from './utils/types';
import ModalBoard from './ModalBoard';
import LiveBoard from './LiveBoard';
import PausedBoard from './PausedBoard';
import classes from '../../sass/components/Game/Pong.module.scss';
import io from 'socket.io-client';

const socket = io('http://localhost:3000/pong', {
		transports: ["websocket"],
		}
	);

// Modal's element
const BEGINNER_LEVEL = 0;
const MEDIUM_LEVEL = 1;
const HARD_LEVEL = 2;
const SPECIAL_LEVEL = 3;

const KEYBOARD_MODE = "keyboard";
const MOUSE_MODE = "mouse";

const SINGLE_MODE = "single";
const DOUBLE_MODE = "double";

// Game's element
const PLAYER_WIN = -1;
const TIE = 0;
const OPPONENT_WIN = 1;

const PLAYER_SIDE = -1;
const OPPONENT_SIDE = 1;

// initial data for the game
const info: PongInfo = {
	boardWidth: 640,
	boardHeight: 480,
	paddleWidth: 10,
	obstacleWidth: 20,
	obstacleHeight: 150,
	obstacleSpeed: 12,
	initialSpeed: 5,
	initialDelta: 3,
	playerX: 10,
	opponentX: 620, // boardWidth - paddleWidth - 10,
	obstacleX: 310, // (boardWidth - obstacleWidth) / 2,
	winnerScore: 3,
}

export default function Pong(prop: PongProp) {
	// game play
	const [isRunning, setIsRunning] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isLive, setIsLive] = useState(false);
	const [isReady, setIsReady] = useState(false);
	const [gameOver, setGameOver] = useState(false);
	const [winner, setWinner] = useState(TIE);
	const [closingText, setClosingText] = useState('');
	const [gameRoom, setGameRoom] = useState('');
	// const [linkInvite, setLinkInvite] = useState('');
	// game mode
	const [toolMode, setToolMode] = useState(MOUSE_MODE);
	const [level, setLevel] = useState(BEGINNER_LEVEL);
	const [playerMode, setPlayerMode] = useState(SINGLE_MODE);
	// ball info
	const [ballRadius, setBallRadius] = useState(0);
	const [ballX, setBallX] = useState(0);
	const [ballY, setBallY] = useState(0);
	const [ballSpeed, setBallSpeed] = useState(0);
	// ball direction
	const [deltaX, setDeltaX] = useState(0);
	const [deltaY, setDeltaY] = useState(0);
	// paddle info
	const [paddleUp, setPaddleUp] = useState(false);
	const [paddleDown, setPaddleDown] = useState(false);
	const [paddleHeight, setPaddleHeight] = useState(0);
	// players info
	const [playerY, setPlayerY] = useState((info.boardHeight - paddleHeight) / 2);
	const [opponentY, setOpponentY] = useState((info.boardHeight - paddleHeight) / 2);
	const [opponentName, setOpponentName] = useState('');
	// obstacle info
	const [obstacleY, setObstacleY] = useState(info.boardHeight);
	const [obstacleDir, setObstacleDir] = useState(true);
	// score
	const [playerScore, setPlayerScore] = useState(0);
	const [opponentScore, setOpponentScore] = useState(0);
	// canvas
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	// animation
	const frameId = useRef(0);
	const prevFrameId = useRef(0);

	// loop to emit a join request to the server
	useEffect(() => {
		if (playerMode === DOUBLE_MODE && !prop.inviteMode) {
			console.log('emit a join random game request');
			socket.emit('joinRandom', { id: prop.userId, lvl: level });
		}
		if (playerMode === DOUBLE_MODE && prop.inviteMode && !prop.isInvited) {
			console.log('emit a join invitation game request');
			socket.emit('joinInvitation', { playerId: prop.userId, opponentId: prop.opponentId, lvl: level, gameRoom: prop.gameRoom })
		}
	}, [playerMode, level, prop.userId, prop.inviteMode]);

	// loop to receive several game play events
	useEffect(() => {
		if (playerMode === DOUBLE_MODE) {
			socket.on('passGameRoom', ({ gameRoom }) => {
				socket.emit('sendInvitation', {
					playerId: prop.userId,
					opponentId: prop.opponentId,
					gameRoom: gameRoom,
					// link: linkInvite
				});
			});
			// receive a welcome message from server informing that you are in a specific game room, and trigger a liveBoard
			socket.on('welcome', ({ message, opponent, gameRoom }) => {
				console.log({ message, opponent, gameRoom });
				if (opponent) {
					setOpponentName(opponent.name);
				}
				setGameRoom(gameRoom);
				setIsLive(true);
				setIsReady(false);
			});
			// receive an information about the opponent from server
			socket.on('opponentJoin', ({ message, opponent }) => {
				console.log({ message, opponent });
				setOpponentName(opponent.name);
			});
			// receive a confirmation from server to start the game, and trigger the liveBoard to start counting the countdown
			socket.on('startGame', ({ message }) => {
				console.log({ message });
				setIsReady(true);
			});
			// receiving the ball direction from server
			socket.on('ballServe', ({ dx, dy }) => {
				setDeltaX(dx);
				setDeltaY(dy);
				setBallX(info.boardWidth / 2);
				setBallY(info.boardHeight / 2);
				setBallSpeed(info.initialSpeed + level);
			});
			// receiving the new ball direction from server
			socket.on('ballBounce', ({dx, dy, x, y, s}) => {
				setDeltaX(dx);
				setDeltaY(dy);
				setBallX(x);
				setBallY(y);
				setBallSpeed(s);
			});
			// receive a pause signal
			socket.on('makePause', ({ message }) => {
				console.log({ message });
				setIsPaused(current => !current);
			});
			// receive new score signal
			socket.on('newScore', ({ pScore, oScore }) => {
				setPlayerScore(pScore);
				setOpponentScore(oScore);
			});
		}
	}, [playerMode, level, prop.inviteMode]);

	// function to stop the animation by toggling the isRunning bool, and send a leave request to the server
	const stopGame = useCallback(() => {
		setIsRunning(false);
		console.log('in stop game, with gameRoom ', gameRoom);
		if (playerMode === DOUBLE_MODE && winner !== OPPONENT_WIN) {
			socket.emit('gameOver', {
				gameInfo: {
					playerId: prop.userId,
					winner: winner,
					playerScore: playerScore,
					opponentScore: opponentScore,
				}, 
				gameRoom: gameRoom,
			});
		}
	}, [gameRoom, opponentScore, playerMode, playerScore, winner, prop.userId]);

	// loop to detect stopGame event from server
	useEffect(() => {
		if (playerMode === DOUBLE_MODE) {
			const handleStopGame = ({ message }: {message: string}) => {
				console.log({ message });
				setGameOver(true);
				setWinner(TIE);
				setClosingText(message);
				stopGame();
			};
		
			// receive a message from server to stop the game, and trigger the modalBoard
			socket.on('stopGame', handleStopGame);
		
			return () => {
				socket.off('stopGame', handleStopGame);
			};
		}
	}, [playerMode, stopGame]);
	
	useEffect(() => {
		const handleUpdateGame = ({ socketId }: { socketId: string }) => {
			socket.emit('lastUpdatedInfo', {
				gameInfo: {
				x: ballX,
				y: ballY,
				dx: deltaX,
				dy: deltaY,
				s: ballSpeed,
				playerY: playerY,
				opponentY: opponentY,
				pScore: playerScore,
				oScore: opponentScore,
				},
				socketId: socketId,
				gameRoom: gameRoom,
			});
			console.log('just emit updated info');
		}

		socket.on('updateGame', handleUpdateGame);
	
		return () => {
		socket.off('updateGame', handleUpdateGame);
		};
	}, [ballSpeed, ballX, ballY, deltaX, deltaY, gameRoom, opponentScore, opponentY, playerScore, playerY]);

	// function to set an initial ball position and direction to start the round
	const ballServe = useCallback((side: number) => {
		// if the game is against computer, the calculation for the ball direction is directly in the front
		if (playerMode === SINGLE_MODE) {
			setDeltaX((info.initialDelta + level) * side);
			setDeltaY(5 * (Math.random() * 2 - 1));
			setBallX(info.boardWidth / 2);
			setBallY(info.boardHeight / 2);
			setBallSpeed(info.initialSpeed + level);
		// if the game is against other player, calculation will be done by server
		} else if (playerMode === DOUBLE_MODE) {
			// receiving the ball direction from server
			socket.on('ballServe', ({ dx, dy }) => {
				setDeltaX(dx);
				setDeltaY(dy);
				setBallX(info.boardWidth / 2);
				setBallY(info.boardHeight / 2);
				setBallSpeed(info.initialSpeed + level);
			});
		}
	}, [level, playerMode]);
	
	// function to set initial value to start the game
	const startGame = (side: number) => {
		if (!isRunning) {
			switch (level) {
				case BEGINNER_LEVEL:
					setBallRadius(10);
					setPaddleHeight(120);
					break ;
				case MEDIUM_LEVEL:
					setBallRadius(10);
					setPaddleHeight(80);
					break ;
				case HARD_LEVEL:
				case SPECIAL_LEVEL:
					setBallRadius(6);
					setPaddleHeight(40);
					break ;
			}
			setPlayerY((info.boardHeight - paddleHeight) / 2);
			setOpponentY((info.boardHeight - paddleHeight) / 2);
			setPlayerScore(0);
			setOpponentScore(0);
			setGameOver(false);
		}
		
		if (playerMode === DOUBLE_MODE) {
			// send a signal to server to start a calculation of the ball direction to start the round
			socket.emit('startBall', {
				gameInfo: {
					initialDelta: info.initialDelta,
					level: level,
				}, gameRoom: gameRoom,
			});
		}
		
		// call ballServe function to set the ball values
		ballServe(side);
		// toggle isRunning boolean to start the animation of the game
		setIsRunning(true);
	}

	// a function to calculate a new direction of the game after the ball hit a paddle
	const ballCollision = useCallback((squareY: number, squareHeight: number, add: boolean): BallInfo => {
		let dx = 0, dy = 0, x= 0, y = 0, s = 0;

		// the area of the paddle where the ball hits (top/middle/bottom) affect the calculation of the new direction
		let collisionPoint = (ballY + (ballRadius / 2)) - (squareY + (squareHeight / 2));
		collisionPoint = collisionPoint / (squareHeight / 2);

		let angle = (Math.PI / 4) * collisionPoint;

		dx = ballSpeed * Math.cos(angle);
		dy = ballSpeed * Math.sin(angle);
		x = (add === true ? ballX + ballRadius : ballX - ballRadius);
		y = ballY;
		s = ballSpeed + 0.5

		return {dx, dy, x, y, s};
	}, [ballRadius, ballX, ballY, ballSpeed]);

	// a function to handle ballBounce event from socket
	useEffect(() => {
		const handleBallBounce = ({ dx, dy, x, y, s }: BallInfo) => {
			setDeltaX(dx);
			setDeltaY(dy);
			setBallX(x);
			setBallY(y);
			setBallSpeed(s);
		};
	  
		socket.on('ballBounce', handleBallBounce);
	  
		// Clean up the event listener when the component is unmounted
		return () => {
		  socket.off('ballBounce', handleBallBounce);
		};
	  }, []); 

	// function to detect when a ball hit the obstacle
	const detectObstacleCollision = useCallback( async () => {
		if (ballX + ballRadius >= info.obstacleX
			&& ballX > info.playerX + info.paddleWidth && ballX <= info.boardWidth / 2
			&& ballY > obstacleY && ballY < obstacleY + info.obstacleHeight) {
				// if the game is against computer, the calculation for the new direction is directly in the front
				if (playerMode === SINGLE_MODE) {
					const {dx, dy, x, s} = await ballCollision(obstacleY, info.obstacleHeight, false);
					
					setDeltaX(dx * -1);
					setDeltaY(dy);
					setBallX(x);
					setBallSpeed(s);
				}
		}
		if (ballX <= info.obstacleX + info.obstacleWidth
			&& ballX >= info.boardWidth / 2 && ballX < info.opponentX
			&& ballY > obstacleY && ballY < obstacleY + info.obstacleHeight) {
				if (playerMode === DOUBLE_MODE) {
					// send a signal to server to start calculating a new direction of the ball
					socket.emit('ballCollision', {
						gameInfo: {
							x: ballX,
							y: ballY,
							r: ballRadius,
							squareY: obstacleY,
							squareHeight: info.obstacleHeight,
							ballSpeed: ballSpeed,
							middleBoard: info.boardWidth / 2,
						}, gameRoom: gameRoom,
					});
				}

				// if the game is against computer, the calculation for the new direction is directly in the front
				if (playerMode === SINGLE_MODE) {
					const {dx, dy, x, s} = await ballCollision(obstacleY, info.obstacleHeight, true);
					
					setDeltaX(dx);
					setDeltaY(dy);
					setBallX(x);
					setBallSpeed(s);
				}
		}
	}, [ballCollision, ballRadius, ballX, ballY, gameRoom, obstacleY, playerMode, ballSpeed]);

	// function to detect when a ball hit the paddle of the opponent side
	const detectOpponentCollision = useCallback( async () => {
		if (ballX + ballRadius >= info.opponentX && ballY > opponentY && ballY < opponentY + paddleHeight) {
			// if the game is against computer, the calculation for the new direction is directly in the front
			if (playerMode === SINGLE_MODE) {
				const {dx, dy, x, s} = await ballCollision(opponentY, paddleHeight, false);
				
				setDeltaX(dx * -1);
				setDeltaY(dy);
				setBallX(x);
				setBallSpeed(s);
			}
		}
	}, [ballCollision, ballRadius, ballX, ballY, opponentY, paddleHeight, playerMode]);

	// function to detect when a ball hit the paddle of the player side
	const detectPlayerCollision = useCallback( async () => {
		if (ballX - ballRadius <= info.playerX + info.paddleWidth && ballY > playerY && ballY < playerY + paddleHeight) {
			if (playerMode === DOUBLE_MODE) {
				// send a signal to server to start calculating a new direction of the ball
				socket.emit('ballCollision', {
					gameInfo: {
						x: ballX,
						y: ballY,
						r: ballRadius,
						squareY: playerY,
						squareHeight: paddleHeight,
						ballSpeed: ballSpeed,
						middleBoard: info.boardWidth / 2,
					}, gameRoom: gameRoom,
				});
			}

			// if the game is against computer, the calculation for the new direction is directly in the front
			if (playerMode === SINGLE_MODE) {
				const {dx, dy, x, s} = await ballCollision(playerY, paddleHeight, true);
				
				setDeltaX(dx);
				setDeltaY(dy);
				setBallX(x);
				setBallSpeed(s);
			}
		}
	}, [ballCollision, ballRadius, ballX, ballY, gameRoom, paddleHeight, playerMode, playerY, ballSpeed]);

	// function to detect ball collision with all 4 part of the walls/borders
	const detectWallCollision = useCallback(() => {
		const minY    = ballRadius;
		const maxY    = info.boardHeight - ballRadius;

		// top collision
		if (ballY < minY) {
			setDeltaY(y => y * -1);
			setBallY(minY);
		}
		// bottom collision
		if (ballY > maxY) {
			setDeltaY(y => y * -1);
			setBallY(maxY);
		}
		// left collision / ball passing the player's paddle, so opponent gains a point
		if (ballX <= 0) {
			if (playerMode === SINGLE_MODE) {
				setOpponentScore(o => o += 1);
			} else if (playerMode === DOUBLE_MODE) {
				// send signal to server to calculate the ball direction for a new round
				socket.emit('startBall', {
					gameInfo: {
						initialDelta: info.initialDelta,
						level: level,
					}, gameRoom: gameRoom,
				});
				// send signal to server to inform am update on the scores
				socket.emit('updateScore', {
					gameInfo: {
						playerScore: playerScore,
						opponentScore: opponentScore,
					}, gameRoom: gameRoom,
				});
			}
			ballServe(OPPONENT_SIDE);
		}
		//right collision / ball passing the opponent's paddle, so player gains a point
		if (ballX >= info.boardWidth) {
			if (playerMode === SINGLE_MODE) {
				setPlayerScore(p => p += 1);
			}
			ballServe(PLAYER_SIDE);
		}
	}, [ballRadius, ballServe, ballX, ballY, gameRoom, level, opponentScore, playerMode, playerScore]);
	
	// function to calculate the movement of the ball based on its direction
	const moveBall = useCallback(() => {
		setBallX(x => x += deltaX);
		setBallY(y => y += deltaY);
	}, [deltaX, deltaY]);

	// function to calculate the opponent movement (against computer or other player)
	const moveOpponent = useCallback(() => {
		// calculating movement of the computer
		const nextPos = ballY - (paddleHeight / 2) * (level === HARD_LEVEL || level === SPECIAL_LEVEL ? 0.5 : 0.1);
		
		if (playerMode === SINGLE_MODE 
			&& nextPos >= 0 
			&& nextPos + paddleHeight <= info.boardHeight) {
			setOpponentY(nextPos);
		} else if (playerMode === DOUBLE_MODE) {
			// receiving a new position from the server, based on the other player's input
			socket.on('paddleMove', ({y}) => {
				setOpponentY(y);
			});
		}
	}, [ballY, level, paddleHeight, playerMode]);

	// function to calculate the players movement based on its input (mouse event or keyboard event)
	const movePlayer = useCallback(() => {
		if (toolMode === KEYBOARD_MODE && isRunning)
		{
			const nextPostUp = playerY - 15;
			const nextPostDown = playerY + 15 + paddleHeight;
			if (paddleUp && nextPostUp >= 0) {
				setPlayerY(nextPostUp);
				if (playerMode === DOUBLE_MODE) {
					// send the new position to server to be forwarded to other player
					socket.emit('moveInput', {y: nextPostUp, gameRoom: gameRoom});
				}
			}
			if (paddleDown && nextPostDown <= info.boardHeight) {
				setPlayerY(nextPostDown - paddleHeight);
				if (playerMode === DOUBLE_MODE) {
					// send the new position to server to be forwarded to other player
					socket.emit('moveInput', {y: nextPostDown - paddleHeight, gameRoom: gameRoom});
				}
			}
		}
	}, [gameRoom, isRunning, paddleDown, paddleHeight, paddleUp, playerMode, playerY, toolMode]);

	// function to calculate the steady movement of the obstacle
	const moveObstacle = useCallback(() => {
		const nextPostUp = obstacleY - info.obstacleSpeed;
		const nextPostDown = obstacleY + info.obstacleSpeed + info.obstacleHeight;
		if (obstacleDir && nextPostUp >= 0) {
			setObstacleY(nextPostUp);
		} else if (!obstacleDir && nextPostDown <= info.boardHeight) {
			setObstacleY(nextPostDown - info.obstacleHeight);
		} else {
			setObstacleDir(current => !current);
		}
	}, [obstacleDir, obstacleY]);
	
	// function to draw the board with its initial element
	const drawBoard = useCallback((context: CanvasRenderingContext2D) => {
		context.clearRect(0, 0, info.boardWidth, info.boardHeight);
		// draw background
		context.fillStyle = '#4E6E81';
		context.fillRect(0, 0, info.boardWidth, info.boardHeight);
		context.save();
		// draw score
		context.fillStyle = '#F2F2F2';
		context.font = '42px Inter';
		context.fillText(' ' + playerScore, 245, 50);
		context.fillText(' ' + opponentScore, 345, 50);
	}, [playerScore, opponentScore]);
	
	// function to draw the elements of the game
	const drawElement = useCallback((context: CanvasRenderingContext2D) => {
		// draw player
		context.fillStyle = '#F2F2F2';
		context.fillRect(info.playerX, playerY, info.paddleWidth, paddleHeight);
		context.save();
		// draw opponent
		context.fillStyle = '#F2F2F2';
		context.fillRect(info.opponentX, opponentY, info.paddleWidth, paddleHeight);
		context.save();
		// draw ball
		context.strokeStyle = '#F2F2F2';
		context.beginPath();
		context.arc(ballX, ballY, ballRadius, 0, 2 * Math.PI);
		context.fill();
		context.stroke();
		if (level === SPECIAL_LEVEL) {
			// draw obstacle 
			context.fillStyle = '#F2F2F2';
			context.fillRect(info.obstacleX, obstacleY, info.obstacleWidth, info.obstacleHeight);
			context.save();
		}
	}, [ballRadius, ballX, ballY, playerY, opponentY, obstacleY, level, paddleHeight]);

	// render the game
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
	  
		const context = canvas.getContext('2d');
		if (!context) return;
	  
		const fps = 24;
		const frameDuration = 1000 / fps; // Frame duration in milliseconds
	  
		const render = (timestamp: number) => {
			const deltaTime = timestamp - prevFrameId.current;
		
			if (deltaTime >= frameDuration) {
				prevFrameId.current = timestamp;
				
				drawBoard(context);
				if (isRunning && !isPaused) {
					drawElement(context);
					moveBall();
					movePlayer();
					moveOpponent();
					detectPlayerCollision();
					detectOpponentCollision();
					detectWallCollision();
					// added function for special level
					if (level === SPECIAL_LEVEL) {
						moveObstacle();
						detectObstacleCollision();
					}
					// check game status
					if (opponentScore > info.winnerScore || playerScore > info.winnerScore) {
						playerScore > info.winnerScore ? setWinner(PLAYER_WIN) : setWinner(OPPONENT_WIN);
						playerScore > info.winnerScore ? setClosingText('You win!') : setClosingText('You lose!');
						setGameOver(true);
						stopGame();
					}
				}
			}
			
			frameId.current = requestAnimationFrame(render);
		};

		frameId.current = requestAnimationFrame(render);
	  
		// Cleanup
		return () => {
			window.cancelAnimationFrame(frameId.current);
		};

	  }, [drawBoard, drawElement,
			moveBall, movePlayer, moveOpponent,
			detectPlayerCollision, detectOpponentCollision, detectWallCollision,
			moveObstacle, detectObstacleCollision,
			stopGame,
			level, playerScore, opponentScore,
			isRunning, isPaused]);

	// keyboard event handler
	useEffect(() => {
		window.onkeydown = function(event) {
			if (isRunning) {
				if (toolMode === KEYBOARD_MODE)
				{
					if (event.code === "ArrowUp") {
						setPaddleUp(true);
					}
					if (event.code === "ArrowDown") {
						setPaddleDown(true);
					}
				}
				if (event.code === "Space") {
					if (playerMode === DOUBLE_MODE) {
						socket.emit('pressPause', gameRoom);
					}
	
					setIsPaused(current => !current);
				}
			}
		}
		window.onkeyup = function(event) {
			if (toolMode === KEYBOARD_MODE && isRunning)
			{
				if (event.code === "ArrowUp") {
					setPaddleUp(false);
				}
				if (event.code === "ArrowDown") {
					setPaddleDown(false);
				}
			}
		}

	}, [isRunning, toolMode, playerMode, gameRoom]);
	
	// mouse event handler
	useEffect(() => {
		window.onmousemove = function(event) {
			const nextPost = event.clientY - info.boardHeight + (paddleHeight / 2);
		
			if (toolMode === MOUSE_MODE && isRunning) {
				if ( nextPost >= 0 && nextPost + paddleHeight <= info.boardHeight) {
						setPlayerY(nextPost);
						if (playerMode === DOUBLE_MODE) {
							socket.emit('moveInput', {y: nextPost, gameRoom: gameRoom});
						}
				} else if (nextPost < 0) {
					setPlayerY(0);
					if (playerMode === DOUBLE_MODE) {
						socket.emit('moveInput', {y: 0, gameRoom: gameRoom});
					}
				} else if (nextPost + paddleHeight > info.boardHeight) {
					setPlayerY(info.boardHeight - paddleHeight);
					if (playerMode === DOUBLE_MODE) {
						socket.emit('moveInput', {y: info.boardHeight - paddleHeight, gameRoom: gameRoom})
					}
				}
			}
		}
	}, [toolMode, isRunning, gameRoom, paddleHeight, playerMode]);

	return (
		<>
			{(!isRunning && isLive) && (
				<LiveBoard
					isReady={isReady}
					playerName={prop.userName}
					opponentName={opponentName}
					inviteMode={prop.inviteMode}
					spectatorMode={false}
					closingText={''}
					start={() => {startGame(winner === PLAYER_WIN ? PLAYER_SIDE : OPPONENT_SIDE); setIsLive(false)}}
				/>
			)}
			{((!isRunning || gameOver) && !isLive) && (
				<ModalBoard
					onDifficulty={(level) => {setLevel(level)}}
					onTool={(mode) => {setToolMode(mode)}}
					onPlayerMode={(mode) => {setPlayerMode(mode)}}
					onStartPage={() => startGame(winner === PLAYER_WIN ? PLAYER_SIDE : OPPONENT_SIDE)}
					inviteMode={prop.inviteMode}
					isInvited={prop.isInvited}
					buttonText={gameOver ? "Play again" : "Start playing"}
					closingText={closingText}
				/>
			)}
			{(isPaused) && (
				<PausedBoard
					mode={'play'}
				/>
			)}
			<div className={classes.container}>
				<div className={classes.divider_line}></div>
				<div className={classes.playground}>
					<canvas 
						ref={canvasRef}
						width={info.boardWidth}
						height={info.boardHeight}
					/>
				</div>
			</div>
		</>
	);
}