import { Logger } from '@nestjs/common';
import { OnGatewayInit, OnGatewayConnection, WebSocketGateway, SubscribeMessage, WebSocketServer, MessageBody, ConnectedSocket, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket, Server, Namespace } from 'socket.io';

import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GameEntity } from './entities/game.entity';
import { UsersService } from '../users/users.service';

import { ServeInfo, CollisionInfo, GameOverInfo, ScoreInfo, UpdatedInfo } from './utils/types';
import { GameState } from '@prisma/client';

@WebSocketGateway({ namespace: '/pong' })
export class GamesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger(GamesGateway.name);

	constructor(private readonly gamesService: GamesService, private prisma: PrismaService) {}

	@WebSocketServer() io: Namespace;
	@WebSocketServer() server: Server

	// Gateway initialized (provided in module and instantiated)
	afterInit(): void {
		this.logger.log(`Websocket Gateway initialized.`);
	}

	// Receive connection from client
	@SubscribeMessage('connection')
	async handleConnection() {
		console.log('a user is connected');
	}

	// receive join game request from client
	@SubscribeMessage('join')
	async handleJoinEvent(
		@MessageBody() { id, lvl, gameRoom }: { id: number, lvl: number, gameRoom?: string },
		@ConnectedSocket() client: Socket,
		) {
			let game, player, opponent;

			if (!gameRoom) {
				// find all existing games with state "PENDING" and level === lvl
				const matchingGames = await this.prisma.game.findMany({ 
					where: {
						state: GameState.PENDING,
						level: lvl,
					},
					include: {
						spectators: true
					}
				});
				// update this game by adding a new UserGame with id of user sent change state playing
				if (matchingGames && matchingGames[0])
				{
					const updatedGameDto: UpdateGameDto = {
						state: GameState.PLAYING, // PLAYING
						players: [
							{
								userId: id,
							},
						],
						playerSocketIds: matchingGames[0].playerSocketIds,
						spectators: matchingGames[0].spectators,
						spectatorSocketIds: matchingGames[0].spectatorSocketIds,
					};
					updatedGameDto.playerSocketIds.push(client.id);
					
					game = await this.gamesService.addPlayer(matchingGames[0].id, updatedGameDto);

				} else {
					// if no player in pending game state with same level has been found, we create a new game
					const createGameDto: CreateGameDto = {
						state: GameState.PENDING,
						level: lvl,
						players: [
							{
								userId: id,
							},
						],
						playerSocketIds: [client.id],
						spectators: [],
						spectatorSocketIds: [],
					};
					
					game = await this.gamesService.create(createGameDto);
					game = await this.gamesService.assignRoom(game.id, 'pong' + game.id);

				}
			} else {
				// if gameRoom is provided, then find the game based on the gameRoom
				game = await this.prisma.game.findUnique({
					where: { room: gameRoom }
				});

				const updatedGameDto: UpdateGameDto = {
					state: GameState.PLAYING,
					players: [
						{
							userId: id,
						},
					],
					playerSocketIds: game.playerSocketIds,
					spectators: game.spectators,
					spectatorSocketIds: game.spectatorSocketIds,
				};
				updatedGameDto.playerSocketIds.push(client.id);

				game = await this.gamesService.addPlayer(game.id, updatedGameDto);
			}

			player = await this.prisma.user.findUnique({
				where: { id: id },
			});

			// get the game to access the data of the player
			const currentGame = await this.prisma.game.findUnique({
				where: { room: game.room },
				include: { players: true }
			});

			// get the opponent if opponent is exist
			let opponentId: number | undefined;
			if (currentGame && currentGame.state === GameState.PLAYING) {
				opponentId = currentGame.players.find(p => p.userId !== id)?.userId;
				opponent = await this.prisma.user.findUnique({
					where: { id: opponentId },
				});
			}

			// send welcome message to player, and also send the opponent player's data (if any)
			client.emit('welcome', {
				message: `Hello ${player.name}, welcome to the game`,
				opponent: opponent,
				gameRoom: game.room,
			});
			
			// when the room already has 2 players, send a message to both players that they can start the game
			if (game.state === GameState.PLAYING) {
				// tell first player that second player has joined the game
				if (game && game.playerSocketIds) {
					game.playerSocketIds.forEach((socketId) => {
						if (socketId !== client.id) {
							this.io.to(socketId).emit('opponentJoin', {
								message: `${player.name} has joined the game`,
								opponent: player,
							});
						}
						this.io.to(socketId).emit('startGame', {
							message: `Let's start the game!`,
						});
					});
				}
			}
	}

	// receiving a startBall request to inform the server to start a calculation for the direction of the ball to the players
	@SubscribeMessage('startBall')
	async handleStartBallEvent(
		@MessageBody() { gameInfo, gameRoom }: { gameInfo: ServeInfo, gameRoom: string },
		@ConnectedSocket() client: Socket,
		) {
			// creating direction of the ball for the start of the game
			const dx = (gameInfo.initialDelta + gameInfo.level);
			const dy = 5 * (Math.random() * 2 - 1);

			// get the players in the room and send the ball direction to both players (horizontal direction is in reverse/mirror)
			const game = await this.prisma.game.findUnique({
				where: { room: gameRoom },
				include: { players: true }
			});

			let playerSocket, opponentSocket;
			if (game) {
				[playerSocket, opponentSocket] = game.playerSocketIds;
			}

			if (game && game.playerSocketIds) {
				game.playerSocketIds.forEach((socketId) => {
					this.io.to(socketId).emit('ballServe', {
						dx: (socketId === client.id ? dx : dx * -1),
						dy: dy,
					});
				});
			}

			if (playerSocket) {
				this.io.to(gameRoom).emit('ballServe', {
					dx: (playerSocket === client.id ? dx : dx * -1),
					dy: dy,
				});
			}
	}

	// receiving a updateScore request to inform the server that one side gains one points
	@SubscribeMessage('updateScore')
	async handleUpdateScorelEvent(
		@MessageBody() { gameInfo, gameRoom }: { gameInfo: ScoreInfo, gameRoom: string },
		@ConnectedSocket() client: Socket,
		) {
			const game = await this.prisma.game.findUnique({
				where: { room: gameRoom },
				include: { players: true },
			});

			let playerSocket, opponentSocket;
			if (game) {
				[playerSocket, opponentSocket] = game.playerSocketIds;
			}

			if (game && game.playerSocketIds) {
				game.playerSocketIds.forEach((socketId) => {
					this.io.to(socketId).emit('newScore', {
						pScore: (socketId === client.id ? gameInfo.playerScore : gameInfo.opponentScore + 1),
						oScore: (socketId === client.id ? gameInfo.opponentScore + 1 : gameInfo.playerScore),
					});
				});
			}

			if (playerSocket) {
				this.io.to(gameRoom).emit('newScore', {
					pScore: (playerSocket === client.id ? gameInfo.playerScore : gameInfo.opponentScore + 1),
					oScore: (playerSocket === client.id ? gameInfo.opponentScore + 1 : gameInfo.playerScore),
				});
			}
	}

	// receiving a ballCollision request to inform the server that the ball hit a paddle of the player and need a new ball direction
	@SubscribeMessage('ballCollision')
	async handleBallCollisionEvent(
		@MessageBody() { gameInfo, gameRoom }: { gameInfo: CollisionInfo, gameRoom: string },
		@ConnectedSocket() client: Socket,
		) {
			// creating a new direction of the ball after it hit a player paddle with ballCollision function

			// the area of the paddle where the ball hits (top/middle/bottom) affect the calculation of the new direction
			let collisionPoint = (gameInfo.y + (gameInfo.r / 2)) - (gameInfo.squareY + (gameInfo.squareHeight / 2));
			collisionPoint = collisionPoint / (gameInfo.squareHeight / 2);

			const angle = (Math.PI / 4) * collisionPoint;

			const dx = gameInfo.speed * Math.cos(angle);
			const dy = gameInfo.speed * Math.sin(angle);
			const s = gameInfo.speed + 0.5;

			const dist = (gameInfo.x > gameInfo.middleBoard ? gameInfo.x - gameInfo.middleBoard : gameInfo.middleBoard - (gameInfo.x - gameInfo.r));
			const opponentX = (gameInfo.x > gameInfo.middleBoard ? gameInfo.middleBoard - dist : gameInfo.middleBoard + dist);

			// get the players in the room and send the ball direction to both players (horizontal direction is in reverse/mirror)
			const game = await this.prisma.game.findUnique({
				where: { room: gameRoom },
				include: { players: true }
			});

			let playerSocket, opponentSocket;
			if (game) {
				[playerSocket, opponentSocket] = game.playerSocketIds;
			}

			if (game && game.playerSocketIds) {
				game.playerSocketIds.forEach((socketId) => {
					this.io.to(socketId).emit('ballLaunch', {
						dx: (socketId === client.id ? dx : dx * -1),
						dy: dy,
						x: (socketId === client.id ? gameInfo.x + gameInfo.r : opponentX - gameInfo.r),
						y: gameInfo.y,
						s: s,
					});
				});
			}

			if (playerSocket) {
				this.io.to(gameRoom).emit('ballLaunch', {
					dx: (playerSocket === client.id ? dx : dx * -1),
					dy: dy,
					x: (playerSocket === client.id ? gameInfo.x + gameInfo.r : opponentX - gameInfo.r),
					y: gameInfo.y,
					s: s,
				});
			}
	}

	// receiving a new position of the player paddle and send it to the other player (to sync the movement as an opponent movement)
	@SubscribeMessage('moveInput')
	async handleMoveInputEvent(
		@MessageBody() { y, gameRoom }: { y: number, gameRoom: string },
		@ConnectedSocket() client: Socket,
		) {
			const game = await this.prisma.game.findUnique({
				where: { room: gameRoom },
				include: { players: true },
			});

			let playerSocket, opponentSocket;
			if (game) {
				[playerSocket, opponentSocket] = game.playerSocketIds;
			}

			if (game && game.playerSocketIds) {
				game.playerSocketIds.forEach((socketId) => {
					if (socketId !== client.id) {
						this.io.to(socketId).emit('paddleMove', { y });
					}
				});
			}
			
			if (playerSocket && opponentSocket) {
				if (playerSocket === client.id) {
					this.io.to(gameRoom).emit('playerMove', { y });
				}
				if (opponentSocket === client.id) {
					this.io.to(gameRoom).emit('opponentMove', { y });
				}
			}
	}

	// receiving a request to pause the game
	@SubscribeMessage('pressPause')
	async handlePressPauseEvent(
		@MessageBody() gameRoom: string,
		@ConnectedSocket() client: Socket,
		) {
			const game = await this.prisma.game.findUnique({
				where: { room: gameRoom },
			});

			if (game && game.playerSocketIds) {
				game.playerSocketIds.forEach((socketId) => {
					if (socketId !== client.id) {
						this.io.to(socketId).emit('makePause', {
							message: `Receive makePause event`,
						});
					}
				});
			}

			this.io.to(gameRoom).emit('makePause', {
				message: `Receive makePause event`,
			});
	}

	// receiving a leave request, so that the player can be removed from the games array and room
	@SubscribeMessage('gameOver')
	async handleGameOverEvent(
		@MessageBody() { gameInfo, gameRoom }: { gameInfo: GameOverInfo, gameRoom: string },
		@ConnectedSocket() client: Socket,
		) {
			console.log('received the disconnect signal from ' + client.id);

			let game = await this.prisma.game.findUnique({
				where: { room: gameRoom },
			});

			if (game.state === GameState.PLAYING) {
				// change status of the game to FINISHED
				game = await this.gamesService.gameOver(game.id, GameState.FINISHED);
			}

			if (gameInfo.winner) {
				// assign playerId as the winnerId in the game
				game = await this.gamesService.assignWinner(game.id, gameInfo.playerId);
			}

			// update the userGame with the score of the winner
			const playerUser = await this.prisma.userGame.update({
				where: { userId_gameId: {
					userId: gameInfo.playerId, gameId: game.id
				}},
				data: { score: gameInfo.playerScore },
			});

			// update the userGame with the score of the opponent
			const currentGame = await this.prisma.game.findUnique({
				where: { room: gameRoom },
				include: { players: true }
			});

			const opponentId = currentGame.players.find(p => p.userId !== gameInfo.playerId)?.userId;

			let opponentUser;
			if (opponentId) {
				opponentUser = await this.prisma.userGame.update({
					where: { userId_gameId: {
						userId: opponentId, gameId: game.id
					}},
					data: { score: gameInfo.opponentScore },
				});
			}

			const player = await this.prisma.user.findUnique({
				where: { id : playerUser.userId }
			});

			const opponent = await this.prisma.user.findUnique({
				where: { id: opponentUser.userId }
			});
			
			const [playerSocket, opponentSocket] = game.playerSocketIds;

			let message;
			if (gameInfo.winner) {
				if (playerSocket === client.id) {
					message += player.name + ' wins!';
				} else {
					message += opponent.name + ' wins!';
				}
			} else {
				if (playerSocket === client.id) {
					message += opponent.name + ' has left the game!';
				} else {
					message += player.name + ' has left the game!';
				}
			}

			this.io.to(gameRoom).emit('endWatch', {
				message: message,
			})
	}

	/* -----> Spectator Mode <----- */

	@SubscribeMessage('spectatorJoin')
	async handleSpectatorJoinEvent(
		@MessageBody() { userId, gameRoom }: { userId: number, gameRoom: string },
		@ConnectedSocket() client: Socket,
		) {
		let game = await this.prisma.game.findUnique({
			where: { room: gameRoom }
		});

		const isSpectator = await this.prisma.spectatorGame.findFirst({
		  where: {
			gameId: game.id,
			userId: userId,
		  },
		});
		
		if (!isSpectator) {
			const updatedGameDto: UpdateGameDto = {
				spectators: [
					{
						userId: userId,
					}
				],
				spectatorSocketIds: game.spectatorSocketIds,
			};
			updatedGameDto.spectatorSocketIds.push(client.id);
	
			game = await this.gamesService.addSpectator(game.id, updatedGameDto);
		}

		const isSocketIdListed = game.spectatorSocketIds.includes(client.id);

		if (!isSocketIdListed) {
			const updatedGameDto: UpdateGameDto = {
				spectatorSocketIds: game.spectatorSocketIds,
			};
			updatedGameDto.spectatorSocketIds.push(client.id);

			game = await this.gamesService.updateSpectatorSocketId(game.id, updatedGameDto);
		}

		client.join(game.room);

		const spectator = await this.prisma.user.findUnique({
			where: { id: userId },
		});

		// get the game to access the data of the player
		const currentGame = await this.prisma.game.findUnique({
			where: { room: game.room },
			include: { players: true }
		});

		let player, opponent;
		if (currentGame) {
			[player, opponent] = currentGame.players;
		}

		client.emit('welcomeSpectator', {
			message: `Hello ${spectator.name}, welcome to the game`,
			player: player,
			opponent: opponent,
			gameRoom: game.room,
		});

		if (game && game.playerSocketIds && game.playerSocketIds[0] && player) {
			this.io.to(game.playerSocketIds[0]).emit('updateGame', { socketId: client.id });
		}
	}

	@SubscribeMessage('lastUpdatedInfo')
	async handleLastUpdatedInfoEvent(
		@MessageBody() { gameInfo, socketId, gameRoom }: { gameInfo: UpdatedInfo, socketId: string, gameRoom: string },
		@ConnectedSocket() client: Socket,
		) {
			const game = await this.prisma.game.findUnique({
				where: { room: gameRoom }
			});

			this.io.to(socketId).emit('currentGameInfo', {
				gameInfo: gameInfo,
			})

			if (game.state === GameState.PLAYING) {
				this.io.to(socketId).emit('startWatch', {
					message: `Everything's ready. Enjoy the match!`,
				});
			// } else if (game.state === GameState.FINISHED) {
			// 	this.io.to(socketId).emit('StopWatch', {
			// 		message: `Game has finished. Sorry you're too late :(`
			// 	});
			// 	client.leave(game.room);
			}
		}

	// receiving a leave gameRoom request from remaining player in the room
	@SubscribeMessage('leaveGameRoom')
	async handleLeaveGameRoomEvent(
		@MessageBody() { gameRoom }: {gameRoom: string },
		@ConnectedSocket() client: Socket,
		) {
		client.leave(gameRoom);
	}

	// receiving a disconnect request, when a connection of a player disrupted
	@SubscribeMessage('disconnect')
	async handleDisconnect(
		@ConnectedSocket() client: Socket,
		) {
			console.log('a user is disconnected');

			// if the client is part of the players, get the the game that is not FINISHED
			let playerGame = await this.prisma.game.findFirst({
				where: {
					state: {
						in: [GameState.PENDING, GameState.PLAYING],
					},
					playerSocketIds: {
						has: client.id,
					}
				}
			});

			// if the player is already inside a game
			if (playerGame) {		
				// send a message to other player in the room to stop the game
				if (playerGame.playerSocketIds) {
					playerGame.playerSocketIds.forEach((socketId) => {
						if (socketId !== client.id) {
							this.io.to(socketId).emit('stopGame', {
								message: `Sorry, your opponent has left!`,
							});
						}
					});
				}

				if (playerGame.state === GameState.PLAYING) {
					// change status of the game to finished
					console.log('change the state of the game');
					playerGame = await this.gamesService.gameOver(playerGame.id, GameState.FINISHED);
				} else {
					// if game.state is still PENDING, delete the game from database
					console.log('delete the curent game from database');
					await this.gamesService.remove(playerGame.id);
				}
			}

			// if the client is part of the spectator, get the game that is not FINISHED
			let spectatorGame = await this.prisma.game.findFirst({
				where: {
					state: {
						in: [GameState.PENDING, GameState.PLAYING],
					},
					spectatorSocketIds: {
						has: client.id,
					}
				}
			});

			// if client is in the list, then remove the client from the list and leave the gameRoom
			if (spectatorGame) {
				const updatedSpectatorSocketIds = spectatorGame.spectatorSocketIds.filter(id => id !== client.id);

				const updatedGameDto: UpdateGameDto = {
					spectatorSocketIds: updatedSpectatorSocketIds,
				}

				spectatorGame = await this.gamesService.updateSpectatorSocketId(spectatorGame.id, updatedGameDto);

				client.leave(spectatorGame.room);
			}

	}
}
