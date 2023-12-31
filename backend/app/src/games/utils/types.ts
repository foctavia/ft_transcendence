import { User } from "@prisma/client";

export type ServeInfo = {
	initialDelta: number;
	level: number;
}

export type CollisionInfo = {
	x: number;
	y: number;
	r: number;
	squareY: number;
	squareHeight: number;
	ballSpeed: number;
	middleBoard: number;
}

export type ScoreInfo = {
	playerScore: number;
	opponentScore: number;
}

export type GameOverInfo = {
	playerId: number;
	winner: number;
	playerScore: number;
	opponentScore: number;
}

export type UpdatedInfo = {
	x: number;
	y: number;
	dx: number;
	dy:number;
	s: number;
	playerY: number;
	opponentY: number;
	pScore: number;
	oScore: number;
}

export type LiveGamesInfo = {
	player?: User;
	opponent?: User;
	gameRoom: string;
}