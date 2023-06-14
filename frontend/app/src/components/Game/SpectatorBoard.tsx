import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { PongInfo, BallInfo, PongProp, SpectatorProp } from './utils/types';
import ModalBoard from './ModalBoard';
import LiveBoard from './LiveBoard';
import classes from '../../sass/components/Game/Pong.module.scss';
import io from 'socket.io-client';
import PausedBoard from './PausedBoard';


const socket = io('http://localhost:3000/pong', {
		transports: ["websocket"],
		}
	);

// Modal's element
const BEGINNER_LEVEL = 0;
const MEDIUM_LEVEL = 1;
const HARD_LEVEL = 2;
const SPECIAL_LEVEL = 3;

// Game's element
const PLAYER_WIN = -1;
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


export default function SpectatorBoard({playerId, playerName, opponentId, opponentName}: SpectatorProp) {
	// game play
	const [isRunning, setIsRunning] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isLive, setIsLive] = useState(false);
	const [isReady, setIsReady] = useState(false);
	const [gameOver, setGameOver] = useState(false);
	const [winner, setWinner] = useState(0);
	const [gameRoom, setGameRoom] = useState(0);
	// game mode
	const [level, setLevel] = useState(BEGINNER_LEVEL);
	// animation
	const [frameCount, setFrameCount] = useState(0);
	const [speed, setSpeed] = useState(0);
	// ball info
	const [ballRadius, setBallRadius] = useState(0);
	const [ballX, setBallX] = useState(0);
	const [ballY, setBallY] = useState(0);
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
	// obstacle info
	const [obstacleY, setObstacleY] = useState(info.boardHeight);
	const [obstacleDir, setObstacleDir] = useState(true);
	// score
	const [playerScore, setPlayerScore] = useState(0);
	const [opponentScore, setOpponentScore] = useState(0);
	// canvas
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	// to be checked ----->
	// useEffect(() => {
	// 	if (playerMode === DOUBLE_MODE) {
	// 		// if the game is for 2 players mode, start by sending a join request to the server
	// 		socket.emit('join', { id: userId, lvl: level });
	// 		// receive a welcome message from server informing that you are in a specific game room, and trigger a liveBoard
	// 		socket.on('welcome', ({ message, opponent, gameRoom }) => {
	// 			console.log({ message, opponent, gameRoom });
	// 			if (opponent) {
	// 				setOpponentName(opponent.name);
	// 			}
	// 			setGameRoom(gameRoom);
	// 			setIsLive(true);
	// 			setIsReady(false);
	// 		});
	// 		// receive an information about the opponent from server
	// 		socket.on('opponentJoin', ({ message, opponent }) => {
	// 			console.log({ message, opponent });
	// 			setOpponentName(opponent.name);
	// 		});
	// 		// receive a confirmation from server to start the game, and trigger the liveBoard to start counting the countdown
	// 		socket.on('startGame', ({ message }) => {
	// 			console.log({ message });
	// 			setIsReady(true);
	// 		});
	// 		// receive a pause signal
	// 		socket.on('makePause', ({ message }) => {
	// 			console.log({ message });
	// 			setIsPaused(current => !current);
	// 		})
	// 		// receive a message from a server that an opponent just left the game
	// 		socket.on('opponentLeft', ({message}) => {
	// 			console.log({message});
	// 			socket.emit('leaveGameRoom', {gameRoom: gameRoom});
	// 		});
	// 		// receive a message from server to stop the game, and trigger the modalBoard
	// 		socket.on('stopGame', ({ message }) => {
	// 			console.log({ message });
	// 			setGameOver(true);
	// 			setWinner(PLAYER_WIN);
	// 			stopGame();
	// 		});
	// 	}
	// }, [playerMode])

	// function to stop the animation by toggling the isRunning bool, and send a leave request to the server after 1 second
	const stopGame = () => {
		setIsRunning(false);
	}

	// a function to calculate a new direction of the game after the ball hit a paddle
	const ballCollision = (squareY: number, squareHeight: number, add: boolean): BallInfo => {
		let dx = 0, dy = 0, x= 0, s = 0;

		// the area of the paddle where the ball hits (top/middle/bottom) affect the calculation of the new direction
		let collisionPoint = (ballY + (ballRadius / 2)) - (squareY + (squareHeight / 2));
		collisionPoint = collisionPoint / (squareHeight / 2);

		let angle = (Math.PI / 4) * collisionPoint;

		dx = speed * Math.cos(angle);
		dy = speed * Math.sin(angle);
		x = (add === true ? ballX + ballRadius : ballX - ballRadius);
		s = speed + 0.5

		return {dx, dy, x, s};
	}
	
	// function to detect when a ball hit the paddle of the opponent side
	const detectOpponentCollision = async () => {
		if (ballX + ballRadius >= info.opponentX && ballY > opponentY && ballY < opponentY + paddleHeight) {
			// receiving the new ball direction from server
			socket.on('ballLaunch', ({dx, dy, x, y, s}) => {
				setDeltaX(dx);
				setDeltaY(dy);
				setBallX(x);
				setBallY(y);
				setSpeed(s);
			});
		}
	}

	// function to detect when a ball hit the obstacle
	const detectObstacleCollision = async () => {
		if (ballX + ballRadius >= info.obstacleX
			&& ballX > info.playerX + info.paddleWidth && ballX <= info.boardWidth / 2
			&& ballY > obstacleY && ballY < obstacleY + info.obstacleHeight) {
				// receiving the new ball direction from server
				socket.on('ballLaunch', ({dx, dy, x, y, s}) => {
					setDeltaX(dx);
					setDeltaY(dy);
					setBallX(x);
					setBallY(y);
					setSpeed(s);
				});
		}
		if (ballX <= info.obstacleX + info.obstacleWidth
			&& ballX >= info.boardWidth / 2 && ballX < info.opponentX
			&& ballY > obstacleY && ballY < obstacleY + info.obstacleHeight) {
				// receiving the new ball direction from server
				socket.on('ballLaunch', ({dx, dy, x, y, s}) => {
					setDeltaX(dx);
					setDeltaY(dy);
					setBallX(x);
					setBallY(y);
					setSpeed(s);
				});
		}
	}

	// function to detect when a ball hit the paddle of the player side
	const detectPlayerCollision = async () => {
		if (ballX - ballRadius <= info.playerX + info.paddleWidth && ballY > playerY && ballY < playerY + paddleHeight) {
			// receiving the new ball direction from server
			socket.on('ballLaunch', ({dx, dy, x, y, s}) => {
				setDeltaX(dx);
				setDeltaY(dy);
				setBallX(x);
				setBallY(y);
				setSpeed(s);
			});
		}
	}
	
	// function to set an initial ball position and direction to start the round
	const serve = (side: number) => {
		// receiving the ball direction from server
		socket.on('ballServe', ({dx, dy}) => {
			// console.log("serve ball dx, dy: ", dx, dy);
			setDeltaX(dx);
			setDeltaY(dy);
			setBallX(info.boardWidth / 2);
			setBallY(info.boardHeight / 2);
			setSpeed(info.initialSpeed + level);
		});
	}
	
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
		// call serve function to set the ball values
		serve(side);
		// toggle isRunning boolean to start the animation of the game
		setIsRunning(true);
	}
	
	// function to detect ball collision with all 4 part of the walls/borders
	const detectWallCollision = () => {
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
			socket.on('newScore', ({pScore, oScore}) => {
				setPlayerScore(pScore);
				setOpponentScore(oScore);
			});
			serve(OPPONENT_SIDE);
		}
		//right collision / ball passing the opponent's paddle, so player gains a point
		if (ballX >= info.boardWidth) {
			socket.on('newScore', ({pScore, oScore}) => {
				setPlayerScore(pScore);
				setOpponentScore(oScore);
			});
			serve(PLAYER_SIDE);
		}
	}
	
	// function to calculate the movement of the ball based on its direction
	const moveBall = () => {
		setBallX(x => x += deltaX);
		setBallY(y => y += deltaY);
	}

	// function to calculate the opponent movement (against computer or other player)
	const moveOpponent = () => {
		// receiving a new position from the server, based on the other player's input
		socket.on('paddleMove', ({y}) => {
			setOpponentY(y);
		});
	}

	// function to calculate the players movement based on its input (mouse event or keyboard event)
	const movePlayer = () => {
		// to be checked --->
		// if (toolMode === KEYBOARD_MODE && isRunning)
		// {
		// 	const nextPostUp = playerY - 15;
		// 	const nextPostDown = playerY + 15 + paddleHeight;
		// 	if (paddleUp && nextPostUp >= 0) {
		// 		setPlayerY(nextPostUp);
		// 		if (playerMode === DOUBLE_MODE) {
		// 			// send the new position to server to be forwarded to other player
		// 			socket.emit('moveInput', {y: nextPostUp, gameRoom: gameRoom});
		// 		}
		// 	}
		// 	if (paddleDown && nextPostDown <= info.boardHeight) {
		// 		setPlayerY(nextPostDown - paddleHeight);
		// 		if (playerMode === DOUBLE_MODE) {
		// 			// send the new position to server to be forwarded to other player
		// 			socket.emit('moveInput', {y: nextPostDown - paddleHeight, gameRoom: gameRoom});
		// 		}
		// 	}
		// }
	}

	// function to calculate the steady movement of the obstacle
	const moveObstacle = () => {
		const nextPostUp = obstacleY - info.obstacleSpeed;
		const nextPostDown = obstacleY + info.obstacleSpeed + info.obstacleHeight;
		if (obstacleDir && nextPostUp >= 0) {
			setObstacleY(nextPostUp);
		} else if (!obstacleDir && nextPostDown <= info.boardHeight) {
			setObstacleY(nextPostDown - info.obstacleHeight);
		} else {
			setObstacleDir(current => !current);
		}
	} 
	
	// function to draw the board with its initial element
	const drawBoard = (context: CanvasRenderingContext2D) => {
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
	}
	
	// function to draw the elements of the game
	const drawElement = (context: CanvasRenderingContext2D) => {
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
	}

	// render the game
	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas)
		return;
		const context = canvas.getContext('2d');
		if (!context)
		return;
		
		drawBoard(context);
		// start animation
		if (isRunning && !isPaused) {
			drawElement(context);
			moveBall();
			movePlayer();
			moveOpponent();
			if (level === SPECIAL_LEVEL) {
				moveObstacle();
				detectObstacleCollision();
			}
			detectWallCollision();
			detectPlayerCollision();
			detectOpponentCollision();
			// check game status
			if (opponentScore > info.winnerScore || playerScore > info.winnerScore) {
				playerScore > info.winnerScore ? setWinner(PLAYER_WIN) : setWinner(OPPONENT_WIN);
				setGameOver(true);
				stopGame();
			}
		}
	}, [frameCount]);
	
	// update the frameCount
	useLayoutEffect(() => {
		const fps = 24;
		let frameId: number;

		const render = () => {
			setTimeout(() => {
				setFrameCount(fc => fc + 1);
				frameId = requestAnimationFrame(render);
			}, 1000 / fps);
		}

		frameId = requestAnimationFrame(render);
		
		return () => {window.cancelAnimationFrame(frameId);}
	}, []);
	
	return (
		<>
			{(!isRunning && isLive) && (
				<LiveBoard
					isReady={isReady}
					playerName={playerName}
					opponentName={opponentName}
					start={() => {startGame(winner === PLAYER_WIN ? PLAYER_SIDE : OPPONENT_SIDE); setIsLive(false)}}
				/>
			)}
			{(isPaused) && (
				<PausedBoard/>
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